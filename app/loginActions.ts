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
  advanceAttempt, blockLogin, blockedUntil, countFail, countSend, dropAttempt, emailKey,
  newLoginToken, phoneKey, phoneRegistered, readAttempt, startAttempt, sweepLoginState, tokKey,
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

const offline = (m: string | undefined) => !!m && /provider is disabled|logins are disabled|_provider_disabled|signups not allowed/i.test(m);
const mailerSpent = (m: string | undefined) => !!m && /over_email_send_rate_limit|email rate limit|over_sms_send_rate_limit|sms rate limit/i.test(m);

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
async function block(a: LoginAttempt, why: string): Promise<LoginStepResult> {
  await blockLogin([tokKey(a.token), phoneKey(a.phone), emailKey(a.email)], why);
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
 */
async function failed(a: LoginAttempt, say: string, resend?: () => Promise<void>): Promise<LoginStepResult> {
  const n = await countFail(a.token);
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
  const a = await attemptNow();
  const back = safeNext(next, '/landing');

  // already shut out, however they got here
  if (await blockedUntil([tokKey(a.token), phoneKey(a.phone), emailKey(a.email)])) {
    return { ok: false, blocked: true, error: SAY.blocked };
  }
  // the box's idea of where it is, checked against the server's
  if (a.stage !== step) return { ok: true, next: a.stage === 'done' ? 'done' : a.stage };

  const supabase = await createClient();
  const v = value.trim();

  switch (step) {
    /* ------------------------------------------------------------- PHONE # */
    case 'phone': {
      const phone = normalisePhone(v);
      if (!phone) return failed(a, SAY.phone);
      const returning = await phoneRegistered(phone);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        if (offline(error.message)) return { ok: false, error: SAY.provider };
        if (mailerSpent(error.message)) return { ok: false, error: SAY.spent };
        return failed(a, SAY.phone);
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
        return failed(a, SAY.code, async () => {
          await supabase.auth.signInWithOtp({ phone });
        });
      }
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
      if (!EMAIL_RE.test(email)) return failed(a, SAY.email);
      /*
       * The reader is signed in as the phone-only account this flow just made,
       * so the address is added to it rather than signed in with. updateUser
       * sends its confirmation to the NEW address, and with {{ .Token }} in the
       * "Change Email Address" template that confirmation is the six digits the
       * next section asks for.
       */
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        if (mailerSpent(error.message)) return { ok: false, error: SAY.spent };
        if (offline(error.message)) return { ok: false, error: SAY.provider };
        return failed(a, SAY.email);
      }
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
        return failed(a, SAY.code, async () => {
          await supabase.auth.updateUser({ email });
        });
      }
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
          if (offline(error.message)) return { ok: false, error: SAY.provider };
          return failed(a, SAY.password);
        }
        await logAuthEvent(a.phone, 'login');
      } else {
        /*
         * "If the account is new accept any submission and save it as a new
         * user profile" — so there is no length rule here, deliberately, and
         * the password is written onto the account the phone section made.
         */
        const { error } = await supabase.auth.updateUser({ password: value });
        if (error) return failed(a, SAY.password);
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
