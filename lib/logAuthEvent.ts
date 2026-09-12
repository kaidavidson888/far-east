import 'server-only';
import { after } from 'next/server';

/**
 * Records a signup/login so the owner can build customer profiles later.
 * NEVER logs passwords or anything secret — just the email, a timestamp and
 * which event it was.
 *
 * Delivery is a POST to a Google Apps Script web app bound to the sheet
 * (SIGNUP_WEBHOOK_URL) — no service account or key to manage. To set it up:
 *
 *   1. Open the sheet → Extensions → Apps Script, paste:
 *        function doPost(e) {
 *          const d = JSON.parse(e.postData.contents);
 *          SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
 *            .appendRow([d.ts, d.email, d.event]);
 *          return ContentService.createTextOutput('ok');
 *        }
 *   2. Deploy → New deployment → Web app → Execute as "Me",
 *      Access "Anyone" → copy the /exec URL.
 *   3. Put it in SIGNUP_WEBHOOK_URL (and, ideally, SIGNUP_WEBHOOK_SECRET —
 *      then check `d.secret` in doPost).
 *
 * Fire-and-forget via next/server `after`, so it can never delay or fail a
 * sign-in.
 */
export function logAuthEvent(email: string, event: 'signup' | 'login'): void {
  const url = process.env.SIGNUP_WEBHOOK_URL;
  if (!url) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[logAuthEvent] skipped — SIGNUP_WEBHOOK_URL not set');
    }
    return;
  }
  after(async () => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ts: new Date().toISOString(),
          email,
          event,
          secret: process.env.SIGNUP_WEBHOOK_SECRET ?? '',
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) console.error('[logAuthEvent] webhook returned', res.status);
    } catch (e) {
      console.error('[logAuthEvent] webhook error', e);
    }
  });
}
