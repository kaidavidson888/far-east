'use client';

import { useFormStatus } from 'react-dom';
import { signInWithGoogleAction } from '@/app/actions';

/**
 * Google's own mark, which is the one thing on this site drawn outside the
 * palette.
 *
 * That is deliberate and not a lapse: Google's branding terms require their
 * mark, in their four colours, on a button that offers their sign-in — a
 * monochrome G or a cinnabar one is not allowed. Everything else about the
 * button is the site's: square corners, the display face, the same height and
 * weight as every other button here.
 *
 * The paths are the standard four-colour G, 18px, as Google publishes it.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-block" disabled={pending}>
      <GoogleMark />
      {pending ? 'Taking you to Google…' : 'Continue with Google'}
    </button>
  );
}

/**
 * The way in that needs neither an email provider nor an SMS one.
 *
 * A form rather than a link, because the handshake has to write a cookie on
 * the way out — see signInWithGoogleAction. `next` rides along so a reader
 * sent here from a cigarette's page lands back on it, and comes back through
 * safeNext so it cannot be turned into a redirect off this site.
 */
export function GoogleButton({ next = '/favorites' }: { next?: string }) {
  return (
    <form action={signInWithGoogleAction}>
      <input type="hidden" name="next" value={next} />
      <Inner />
    </form>
  );
}
