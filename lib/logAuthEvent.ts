import 'server-only';
import { createSign } from 'node:crypto';

/**
 * Appends `[ISO timestamp, email, event]` to a Google Sheet so the owner can
 * build customer profiles later. NEVER logs passwords or any secret.
 *
 * Configure with three env vars (all optional — unset means this no-ops):
 *   GOOGLE_SA_EMAIL        service-account address (…@….iam.gserviceaccount.com)
 *   GOOGLE_SA_PRIVATE_KEY  its PEM private key (newlines as literal \n is fine)
 *   SIGNUP_SHEET_ID        the target spreadsheet's id (from its URL)
 * Optionally SIGNUP_SHEET_RANGE (default "Sheet1!A:C"). Share the sheet with the
 * service-account address as an Editor.
 *
 * Fire-and-forget: callers must not await this in a way that can fail the sign-in.
 */
export async function logAuthEvent(email: string, event: 'signup' | 'login'): Promise<void> {
  const saEmail = process.env.GOOGLE_SA_EMAIL;
  const saKey = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.SIGNUP_SHEET_ID;
  const range = process.env.SIGNUP_SHEET_RANGE || 'Sheet1!A:C';

  if (!saEmail || !saKey || !sheetId) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[logAuthEvent] skipped — GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY / SIGNUP_SHEET_ID not set');
    }
    return;
  }

  try {
    const token = await accessToken(saEmail, saKey);
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
      `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[new Date().toISOString(), email, event]] }),
    });
    if (!res.ok) {
      console.error('[logAuthEvent] Sheets append failed', res.status, await res.text());
    }
  } catch (e) {
    console.error('[logAuthEvent] error', e);
  }
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Sign a service-account JWT and exchange it for a short-lived access token. */
async function accessToken(saEmail: string, saKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: saEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(signer.sign(saKey))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}
