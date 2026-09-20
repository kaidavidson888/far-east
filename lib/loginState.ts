import 'server-only';
import { db } from './db';
import type { LoginStep } from './loginBox';

/**
 * WHERE ONE READER HAS GOT TO IN THE LOGIN BOX, AND WHO IS SHUT OUT.
 *
 * The owner's 2026-09-20 rebuild makes the login box a sequence, and two of
 * its rules cannot be kept in the browser:
 *
 *   "if the section involves a verification code resend the code up to 3 times"
 *   "on the third failure of the same section kick the user out of all login
 *    processes and fully block them from accessing the site for 30 minutes"
 *
 * A counter a reload resets is not a limit and a lockout a cleared cookie
 * lifts is not a lockout, so both live in Postgres — see
 * supabase/migrations/0007_login_flow.sql. The browser carries one thing: a
 * random token in an httpOnly cookie, which is the handle on its row and is
 * itself the secret, so nothing has to be signed.
 *
 * NOTHING SECRET IS STORED HERE. Not the password, which Supabase Auth bcrypts
 * into auth.users and this application never reads; and not the code, which
 * Supabase issues and checks. What a row records is only that a step was
 * passed. A verification code in an application table is a password in an
 * application table with a shorter life.
 */

export const LOGIN_MAX_FAILS = 3;
export const LOGIN_MAX_SENDS = 3;
export const LOGIN_BLOCK_MINUTES = 30;
/** How long a half-finished attempt is worth remembering. */
export const LOGIN_ATTEMPT_MINUTES = 30;
export const LOGIN_COOKIE = 'fe_login';
/**
 * THE DATABASE STOPS THE LOGIN; THIS COOKIE STOPS THE BROWSING, and they are
 * two different jobs. The `login_blocks` rows — keyed on the attempt's token
 * AND on the phone number or address the codes were going to — are what make a
 * block stick through a cleared cookie: the number stays locked out whatever
 * browser asks next. This cookie is what the owner's "fully block them from
 * accessing the site" needs, because the root layout can read it and draw the
 * red page with no database round trip on a reader who is not blocked.
 * Clearing it buys browsing back and buys nothing at the login.
 *
 * It holds the epoch millisecond the block lifts, so the page can say how long
 * is left without asking anything.
 */
export const LOGIN_BLOCK_COOKIE = 'fe_blocked';

export type LoginAttempt = {
  token: string;
  phone: string | null;
  email: string | null;
  stage: LoginStep | 'done';
  phoneOk: boolean;
  emailOk: boolean;
  returning: boolean;
  fails: number;
  sends: number;
};

type Row = {
  token: string;
  phone: string | null;
  email: string | null;
  stage: LoginStep | 'done';
  phone_ok: boolean;
  email_ok: boolean;
  returning_user: boolean;
  fails: number;
  sends: number;
};

const hydrate = (r: Row): LoginAttempt => ({
  token: r.token,
  phone: r.phone,
  email: r.email,
  stage: r.stage,
  phoneOk: r.phone_ok,
  emailOk: r.email_ok,
  returning: r.returning_user,
  fails: Number(r.fails),
  sends: Number(r.sends),
});

/** A handle nobody can guess: 256 bits, base 36. */
export function newLoginToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => n.toString(36).padStart(2, '0')).join('');
}

export async function startAttempt(token: string): Promise<LoginAttempt> {
  const sql = db();
  const [row] = await sql<Row[]>`
    INSERT INTO public.login_attempts (token, expires_at)
    VALUES (${token}, now() + make_interval(mins => ${LOGIN_ATTEMPT_MINUTES}))
    ON CONFLICT (token) DO UPDATE SET expires_at = excluded.expires_at
    RETURNING *
  `;
  return hydrate(row);
}

export async function readAttempt(token: string | undefined): Promise<LoginAttempt | null> {
  if (!token) return null;
  const sql = db();
  const [row] = await sql<Row[]>`
    SELECT * FROM public.login_attempts
    WHERE token = ${token} AND expires_at > now()
    LIMIT 1
  `;
  return row ? hydrate(row) : null;
}

/** Move an attempt on. Passing a new stage resets the section's counters. */
export async function advanceAttempt(token: string, to: Partial<{
  phone: string | null;
  email: string | null;
  stage: LoginStep | 'done';
  phoneOk: boolean;
  emailOk: boolean;
  returning: boolean;
}>): Promise<LoginAttempt | null> {
  const sql = db();
  const [row] = await sql<Row[]>`
    UPDATE public.login_attempts SET
      phone          = ${to.phone !== undefined ? to.phone : sql`phone`},
      email          = ${to.email !== undefined ? to.email : sql`email`},
      stage          = ${to.stage ?? sql`stage`},
      phone_ok       = ${to.phoneOk !== undefined ? to.phoneOk : sql`phone_ok`},
      email_ok       = ${to.emailOk !== undefined ? to.emailOk : sql`email_ok`},
      returning_user = ${to.returning !== undefined ? to.returning : sql`returning_user`},
      -- a new section starts with a clean slate: the owner's three are three
      -- failures of THE SAME section
      fails          = ${to.stage ? 0 : sql`fails`},
      sends          = ${to.stage ? 0 : sql`sends`}
    WHERE token = ${token} AND expires_at > now()
    RETURNING *
  `;
  return row ? hydrate(row) : null;
}

/** One more code went out for the section the attempt is standing on. */
export async function countSend(token: string): Promise<number> {
  const sql = db();
  const [row] = await sql<{ sends: number }[]>`
    UPDATE public.login_attempts SET sends = least(sends + 1, 4)
    WHERE token = ${token} AND expires_at > now()
    RETURNING sends
  `;
  return row ? Number(row.sends) : 0;
}

/**
 * A failure of the section the attempt is standing on. Returns the count AFTER
 * it — the caller blocks when it reaches LOGIN_MAX_FAILS.
 */
export async function countFail(token: string): Promise<number> {
  const sql = db();
  const [row] = await sql<{ fails: number }[]>`
    UPDATE public.login_attempts SET fails = least(fails + 1, ${LOGIN_MAX_FAILS})
    WHERE token = ${token} AND expires_at > now()
    RETURNING fails
  `;
  return row ? Number(row.fails) : 0;
}

export async function dropAttempt(token: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM public.login_attempts WHERE token = ${token}`;
}

/* ------------------------------------------------------------ the lockout */

/**
 * SHUT OUT, TWO WAYS AT ONCE.
 *
 * The owner asks for the reader to be blocked from the site, so the BROWSER is
 * turned away — which means the key has to be something the browser carries,
 * and that is its attempt token. But a cookie is cleared in two clicks and the
 * thing being defended is a verification code, so the contact the codes were
 * going to is blocked as well. Clearing cookies buys a fresh browser and the
 * same locked-out phone number.
 *
 * Not the IP: a carrier NAT puts a town behind one address, so blocking it
 * turns away people who did nothing — and of the three it is the easiest to
 * change.
 */
export async function blockLogin(keys: (string | null | undefined)[], reason: string): Promise<void> {
  const real = keys.filter((k): k is string => Boolean(k));
  if (!real.length) return;
  const sql = db();
  await sql`
    INSERT INTO public.login_blocks (key, until, reason)
    SELECT k, now() + make_interval(mins => ${LOGIN_BLOCK_MINUTES}), ${reason}
    FROM unnest(${real}::text[]) AS k
    ON CONFLICT (key) DO UPDATE
      SET until = excluded.until, reason = excluded.reason
  `;
}

/** When the block on any of these keys lifts, or null if none of them is blocked. */
export async function blockedUntil(keys: (string | null | undefined)[]): Promise<Date | null> {
  const real = keys.filter((k): k is string => Boolean(k));
  if (!real.length) return null;
  const sql = db();
  const [row] = await sql<{ until: Date }[]>`
    SELECT max(until) AS until FROM public.login_blocks
    WHERE key = ANY(${real}::text[]) AND until > now()
  `;
  return row?.until ?? null;
}

export const tokKey = (token: string | undefined) => (token ? `tok:${token}` : null);
export const phoneKey = (phone: string | null | undefined) => (phone ? `ph:${phone}` : null);
export const emailKey = (email: string | null | undefined) => (email ? `em:${email.toLowerCase()}` : null);

/** Scratch tables, swept from the read path rather than on a schedule. */
export async function sweepLoginState(): Promise<void> {
  const sql = db();
  await sql`SELECT public.sweep_login_state()`;
}

/**
 * Does an account already exist for this phone number?
 *
 * The phone's counterpart to `accountState`, and the same note applies: it
 * reads `auth.` directly, which the app can because it connects as the owner,
 * and it reads nothing about the password. It is what decides whether the box
 * asks for an email at all — the owner's "if their phone # is already
 * registered with an account skip the following text and go straight to
 * Password".
 */
export async function phoneRegistered(phone: string): Promise<boolean> {
  const sql = db();
  const [row] = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM auth.users WHERE phone = ${phone} LIMIT 1
  `;
  return Boolean(row);
}
