'use server';

import { cookies } from 'next/headers';
import { EMAIL_RE } from '@/lib/authPolicy';
import { normalisePhone } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { safeNext } from '@/lib/siteUrl';
import type { LoginStep } from '@/lib/loginBox';
import {
  LOGIN_ATTEMPT_MINUTES, LOGIN_BLOCK_COOKIE, LOGIN_BLOCK_MINUTES, LOGIN_COOKIE, LOGIN_MAX_FAILS,
  LOGIN_MAX_SENDS,
  advanceAttempt, blockLogin, blockedUntil, contactLoad, countSend, dropAttempt, emailKey,
  newLoginToken, phoneKey, phoneRegistered, readAttempt, releaseTry, reserveTry, startAttempt,
  sweepLoginState, tokKey,
  type LoginAttempt,
} from '@/lib/loginState';

/**
 * THE LOGIN BOX, ONE SECTION AT A TIME (the owner's 2026-09-20 rebuild).
 *
 * PHONE # -> VERIFICATION CODE -> (EMAIL -> VERIFICATION CODE, only for a
 * number nobody has an account on) -> PASSWORD. The box shows one word at a
 * time and this decides which word comes next.
 *
 * THE SERVER DECIDES WHICH SECTION IS LIVE, NOT THE BOX. Every call carries
 * the step the box thinks it is on, and it is treated as a hint and checked
 * against the attempt's own row: a server action is a public endpoint, and a
 * box that could name its own step could name 'password' first.
 *
 * WHAT IS STORED AND WHAT IS NOT. The attempt's row (lib/loginState.ts) holds
 * where the reader has got to, how many codes have gone out and how many
 * attempts have failed — nothing else. The password goes to Supabase Auth and
 * nowhere else, exactly as it does on the old box; the code is issued and
 * checked by Supabase and never lands in a table of ours; and logAuthEvent
 * still takes a contact and an event and nothing more.
 *
 * WHAT THIS NEEDS IN THE SUPABASE DASHBOARD, and it will not work without it:
 *   - Authentication -> Providers -> Phone ON, with Twilio's Account SID, Auth
 *     Token and Message Service SID filled in there. THOSE CREDENTIALS DO NOT
 *     BELONG IN THIS REPO, which is public.
 *   - Authentication -> Providers -> Email ON, and custom SMTP configured.
 *     Supabase's shared mailer is capped at a couple of messages an hour and
 *     answers over_email_send_rate_limit past that, creating nothing — which
 *     for a verification code means a reader who simply never gets one.
 *   - The "Change Email Address" template must carry {{ .Token }}, or the
 *     email section sends a link where the box is asking for six digits.
 */

export type LoginStepResult =
  | { ok: true; next: LoginStep | 'done'; go?: string }
  | { ok: false; error?: string; blocked?: true };

/** Everything the box may be told, in words a reader can act on. */
const SAY = {
  phone: 'That does not look like a phone number.',
  email: 'That does not look like an email address.',
  code: 'That code is not right. A new one is on its way.',
  spent: 'Too many codes for one number. Try again later.',
  password: 'That password does not match this number.',
  provider: 'Sign-in is switched off at the moment. Nothing you typed is the problem.',
  blocked: 'Too many tries.',
} as const;

/*
 * WHOSE FAULT WAS IT? Only a mistake the reader made may spend one of their
 * three tries. A provider switched off, a mailer out of credit, Supabase's own
 * rate limit or a network fault are none of their doing, and counting those
 * meant a reader could be shut out of the site for half an hour by an outage
 * — three presses of a button that was never going to work.
 *
 * It reads `code` first and the message only as a fallback, because the
 * message is prose and changes between GoTrue releases where the code does not.
 */
type AuthErr = { message?: string; code?: string; status?: number };

const offline = (e: AuthErr | null | undefined) => {
  if (!e) return false;
  const c = e.code ?? '';
  return /_provider_disabled|signup_disabled/.test(c)
    || /provider is disabled|logins are disabled|signups not allowed/i.test(e.message ?? '');
};
const mailerSpent = (e: AuthErr | null | undefined) => {
  if (!e) return false;
  const c = e.code ?? '';
  return /over_(email|sms)_send_rate_limit|over_request_rate_limit/.test(c)
    || /rate limit/i.test(e.message ?? '');
};
/** Ours or the provider's, never the reader's: says so and spends no try. */
const notTheirFault = (e: AuthErr | null | undefined) =>
  offline(e) || mailerSpent(e) || (e?.status !== undefined && e.status >= 500);

/* -------------------------------------------------------------- the handle */

/**
 * The attempt this browser is on, made if it has none. The token is httpOnly
 * and lasts exactly as long as the row it points at: a stale cookie names a
 * swept row and simply starts again at PHONE #.
 */
async function attemptNow(): Promise<LoginAttempt> {
  const jar = await cookies();
  const had = jar.get(LOGIN_COOKIE)?.value;
  const open = await readAttempt(had);
  if (open) return open;
  const token = newLoginToken();
  jar.set(LOGIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: LOGIN_ATTEMPT_MINUTES * 60,
  });
  return startAttempt(token);
}

/*
 * Shutting a reader out for half an hour takes both keys — see
 * LOGIN_BLOCK_COOKIE in lib/loginState.ts for which one does which job. (The
 * name lives there rather than here because a 'use server' module may only
 * export async functions: a const exported from one silently strips every
 * export the module has, which is why lib/authPolicy.ts exists too.)
 */
/*
 * ONLY A CONTACT THE ATTEMPT HAS PROVED IS BLOCKED.
 *
 * Blocking whatever was typed lets a stranger shut any number out of the site
 * for half an hour, and text it three times on the way — type a victim's
 * number, fail the code three times, and the number is locked with nothing
 * proved about it. A contact is only blocked once the attempt has passed its
 * code (`phoneOk` / `emailOk`), which still covers the case the lockout is
 * really for: brute force at the PASSWORD step, which cannot be reached
 * without proving the phone. Guessing a code without owning the number blocks
 * the browser and nothing else.
 */
async function block(a: LoginAttempt, why: string): Promise<LoginStepResult> {
  await blockLogin(
    [tokKey(a.token), a.phoneOk ? phoneKey(a.phone) : null, a.emailOk ? emailKey(a.email) : null],
    why,
  );
  const jar = await cookies();
  jar.set(LOGIN_BLOCK_COOKIE, String(Date.now() + LOGIN_BLOCK_MINUTES * 60_000), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: LOGIN_BLOCK_MINUTES * 60,
  });
  await dropAttempt(a.token);
  return { ok: false, blocked: true, error: SAY.blocked };
}

/**
 * A failed section. The third one blocks — the owner's "on the third failure
 * of the same section kick the user out of all login processes" — and the two
 * before it send a fresh code where a code is what the section wants.
 *
 * THE TRY WAS ALREADY TAKEN, before Supabase was called (`reserveTry`), so
 * `n` is handed in. Counting it here instead left the whole round trip open:
 * six requests fired together all read the count at zero, all got a guess
 * checked, and the third failure only landed once every one of them had been
 * tried.
 */
async function failed(
  a: LoginAttempt, n: number, say: string, resend?: () => Promise<void>,
): Promise<LoginStepResult> {
  if (n >= LOGIN_MAX_FAILS) return block(a, `three failures at ${a.stage}`);
  if (resend && a.sends < LOGIN_MAX_SENDS) {
    await resend();
    await countSend(a.token);
  }
  return { ok: false, error: say };
}

/* ---------------------------------------------------------------- the flow */

export async function loginStepAction(
  step: LoginStep,
  value: string,
  next: string,
): Promise<LoginStepResult> {
  await sweepLoginState();
  const back = safeNext(next, '/landing');

  /*
   * THE BROWSER'S OWN BLOCK IS READ BEFORE ANYTHING IS MINTED. attemptNow()
   * starts a fresh attempt with a fresh token when the cookie names an
   * expired row — so asking after it had already thrown away the very token
   * the block was written against, and the `tok:` key never turned anyone
   * away. Read it off the cookie first and return without minting.
   */
  const had = (await cookies()).get(LOGIN_COOKIE)?.value;
  if (await blockedUntil([tokKey(had)])) {
    return { ok: false, blocked: true, error: SAY.blocked };
  }
  const a = await attemptNow();
  if (await blockedUntil([phoneKey(a.phone), emailKey(a.email)])) {
    return { ok: false, blocked: true, error: SAY.blocked };
  }
  // the box's idea of where it is, checked against the server's
  if (a.stage !== step) return { ok: true, next: a.stage === 'done' ? 'done' : a.stage };

  /*
   * ONE OF THE THREE TRIES IS TAKEN NOW, not after Supabase answers, and it is
   * given back if the section is passed. Without this, requests fired together
   * all read the count at zero and every one of them got a guess in.
   */
  const tries = await reserveTry(a.token, step);
  // nothing left to reserve: the tries are spent, and nothing is guessed
  if (tries >= LOGIN_MAX_FAILS) return block(a, `three failures at ${step}`);

  const supabase = await createClient();
  const v = value.trim();

  switch (step) {
    /* ------------------------------------------------------------- PHONE # */
    case 'phone': {
      const phone = normalisePhone(v);
      if (!phone) return failed(a, tries, SAY.phone);
      /*
       * THE NUMBER'S OWN BLOCK IS CHECKED BEFORE A TEXT IS SENT. It could not
       * be checked at the top, because until this step there is no number to
       * check — and asking afterwards means a locked-out number is texted
       * again on every attempt.
       */
      if (await blockedUntil([phoneKey(phone)])) {
        return { ok: false, blocked: true, error: SAY.blocked };
      }
      /*
       * AND THE NUMBER'S OWN TALLY, not just this browser's. The counters hang
       * off a cookie, so dropping it started a fresh attempt with three fresh
       * tries and the block never landed. Summed across every unexpired
       * attempt that named this number, a new cookie inherits what the number
       * has already spent.
       */
      const load = await contactLoad(phone, null);
      if (load.fails >= LOGIN_MAX_FAILS) {
        return block({ ...a, phone, phoneOk: true }, 'the number has spent its tries');
      }
      if (load.sends > LOGIN_MAX_SENDS) return { ok: false, error: SAY.spent };
      const returning = await phoneRegistered(phone);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        if (notTheirFault(error)) {
          await releaseTry(a.token);
          return { ok: false, error: mailerSpent(error) ? SAY.spent : SAY.provider };
        }
        return failed(a, tries, SAY.phone);
      }
      await advanceAttempt(a.token, { phone, returning, stage: 'phoneCode' });
      await countSend(a.token);
      return { ok: true, next: 'phoneCode' };
    }

    /* --------------------------------------------- the phone's code */
    case 'phoneCode': {
      if (!a.phone) return { ok: true, next: 'phone' };
      const phone = a.phone;
      const { error } = await supabase.auth.verifyOtp({ phone, token: v, type: 'sms' });
      if (error) {
        if (notTheirFault(error)) {
          await releaseTry(a.token);
          return { ok: false, error: mailerSpent(error) ? SAY.spent : SAY.provider };
        }
        return failed(a, tries, SAY.code, async () => {
          await supabase.auth.signInWithOtp({ phone });
        });
      }
      await releaseTry(a.token);
      /*
       * THE NUMBER IS THEIRS. What happens to the session that verifying just
       * created is the difference between the two paths:
       *
       *   RETURNING — signed straight back out. The owner's rule is that a
       *     returning reader gets past only on a password matching this
       *     number, and leaving them signed in while the box asks for one
       *     would make the password a formality they could walk away from.
       *   NEW — kept. The account is being made right now and the next two
       *     sections (the address, then the password) are written onto it with
       *     updateUser, which needs a session. An abandoned attempt leaves a
       *     phone-only account, which migration 0004 already names properly.
       */
      if (a.returning) {
        await supabase.auth.signOut();
        await advanceAttempt(a.token, { phoneOk: true, stage: 'password' });
        return { ok: true, next: 'password' };
      }
      await advanceAttempt(a.token, { phoneOk: true, stage: 'email' });
      return { ok: true, next: 'email' };
    }

    /* --------------------------------------------------------------- EMAIL */
    case 'email': {
      const email = v.toLowerCase();
      if (!EMAIL_RE.test(email)) return failed(a, tries, SAY.email);
      if (await blockedUntil([emailKey(email)])) {
        return { ok: false, blocked: true, error: SAY.blocked };
      }
      /*
       * The reader is signed in as the phone-only account this flow just made,
       * so the address is added to it rather than signed in with. updateUser
       * sends its confirmation to the NEW address, and with {{ .Token }} in the
       * "Change Email Address" template that confirmation is the six digits the
       * next section asks for.
       */
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        if (notTheirFault(error)) {
          await releaseTry(a.token);
          return { ok: false, error: mailerSpent(error) ? SAY.spent : SAY.provider };
        }
        return failed(a, tries, SAY.email);
      }
      await releaseTry(a.token);
      await advanceAttempt(a.token, { email, stage: 'emailCode' });
      await countSend(a.token);
      return { ok: true, next: 'emailCode' };
    }

    /* ------------------------------------------- the address's code */
    case 'emailCode': {
      if (!a.email) return { ok: true, next: 'email' };
      const email = a.email;
      const { error } = await supabase.auth.verifyOtp({ email, token: v, type: 'email_change' });
      if (error) {
        if (notTheirFault(error)) {
          await releaseTry(a.token);
          return { ok: false, error: mailerSpent(error) ? SAY.spent : SAY.provider };
        }
        return failed(a, tries, SAY.code, async () => {
          await supabase.auth.updateUser({ email });
        });
      }
      await releaseTry(a.token);
      await advanceAttempt(a.token, { emailOk: true, stage: 'password' });
      return { ok: true, next: 'password' };
    }

    /* ------------------------------------------------------------ PASSWORD */
    case 'password': {
      if (!a.phone || !a.phoneOk) return { ok: true, next: 'phone' };
      if (a.returning) {
        /*
         * "if a returning user obviously only allow a password submission that
         * matches the phone number used to log in" — so the pair is checked
         * together, against the number this attempt proved, and a password
         * that belongs to some other account gets nowhere.
         */
        const { error } = await supabase.auth.signInWithPassword({ phone: a.phone, password: value });
        if (error) {
          if (notTheirFault(error)) {
            await releaseTry(a.token);
            return { ok: false, error: SAY.provider };
          }
          return failed(a, tries, SAY.password);
        }
        await logAuthEvent(a.phone, 'login');
      } else {
        /*
         * "If the account is new accept any submission and save it as a new
         * user profile" — so there is no length rule here, deliberately, and
         * the password is written onto the account the phone section made.
         */
        const { error } = await supabase.auth.updateUser({ password: value });
        if (error) {
          if (notTheirFault(error)) {
            await releaseTry(a.token);
            return { ok: false, error: SAY.provider };
          }
          return failed(a, tries, SAY.password);
        }
        await logAuthEvent(a.email ?? a.phone, 'signup');
      }
      await dropAttempt(a.token);
      const jar = await cookies();
      jar.delete(LOGIN_COOKIE);
      return { ok: true, next: 'done', go: back };
    }

    default:
      return { ok: true, next: 'phone' };
  }
}

/** Where the box should start when it is drawn — an attempt may be half done. */
export async function loginStageAction(): Promise<{ stage: LoginStep; blocked: boolean }> {
  const jar = await cookies();
  const a = await readAttempt(jar.get(LOGIN_COOKIE)?.value);
  const until = jar.get(LOGIN_BLOCK_COOKIE)?.value;
  const blocked = Boolean(until && Number(until) > Date.now());
  const stage = a && a.stage !== 'done' ? a.stage : 'phone';
  return { stage, blocked };
}
