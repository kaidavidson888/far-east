/**
 * Phone numbers for the splash's sign-in row.
 *
 * Supabase Auth wants E.164 — a leading + and country code, digits only — so
 * this is both the validator and the normaliser: it returns the E.164 form of
 * anything it accepts and null for anything it does not. The form flashes the
 * box red and clears the row on null, and the server action re-checks with the
 * same function, because a server action is a public endpoint.
 *
 * A bare ten-digit number is read as US/Canada, matching the rest of the site
 * (dates are pinned to America/New_York). Anything else has to carry its own
 * country code, since guessing one would sign people up under a number that is
 * not theirs.
 */
export function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  let e164: string;
  // A NANP area code never starts 0 or 1, so a bare ten digits that do are
  // not a US number with the country code left off — they are a typo, or a
  // number from somewhere else with its + missing.
  const nanp = /^[2-9]\d{9}$/;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (nanp.test(digits)) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1') && nanp.test(digits.slice(1))) e164 = `+${digits}`;
  else return null;

  // E.164: + then 8 to 15 digits, never starting 0.
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}
