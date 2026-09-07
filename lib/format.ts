/**
 * Dates are formatted on the server and passed down as strings, so the client
 * never re-formats them in a different locale or timezone.
 *
 * The timezone is pinned rather than left to the host: on Vercel the server
 * runs in UTC, so an unpinned "generated at" timestamp would be several hours
 * off for a US reader.
 */
const TZ = process.env.SITE_TIMEZONE ?? 'America/New_York';

const DATE: Intl.DateTimeFormatOptions = {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ,
};
const MOMENT: Intl.DateTimeFormatOptions = {
  ...DATE, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
};

/** "August 26, 2026" */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', DATE);
}

/** "August 26, 2026 at 8:59 AM EDT" */
export function formatMoment(iso: string) {
  // en-US gives "August 26, 2026 at 8:59 AM EDT" on modern runtimes, but older
  // ones emit a comma instead of "at". Normalise so both read the same.
  const s = new Date(iso).toLocaleString('en-US', MOMENT);
  return s.includes(' at ') ? s : s.replace(/, (\d)/, ' at $1');
}
