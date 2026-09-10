import { headers } from 'next/headers';
import type { LandingDevice } from './landing';

/**
 * Which form factor to lay the page out for, decided on the server.
 *
 * The landing page positions its elements differently on a phone and on a
 * desktop. Choosing on the client would mean rendering one arrangement and
 * then moving everything once JavaScript runs, so the reader sees the layout
 * jump; reading the User-Agent here means the HTML arrives already correct.
 *
 * The check is deliberately coarse — the layout only has two arrangements, so
 * the cost of a wrong guess is small, and the CSS is edge-anchored and fluid
 * either way, so a mis-detected device still gets a page that fits. `Mobile`
 * covers most phone browsers, including Firefox and Chrome on Android; the
 * named platforms cover the ones that omit it. iPadOS reports itself as a Mac
 * and lands on the desktop arrangement, which is what a tablet in landscape
 * should get anyway.
 */
const MOBILE_UA = /Android|iPhone|iPod|iPad|Windows Phone|IEMobile|Opera Mini|Mobile Safari|Mobile\//i;

export async function detectDevice(): Promise<LandingDevice> {
  const ua = (await headers()).get('user-agent') ?? '';
  return MOBILE_UA.test(ua) ? 'mobile' : 'desktop';
}

/** Dev-only `?device=mobile|desktop`, so either arrangement can be checked. */
export function deviceOverride(value: string | string[] | undefined): LandingDevice | null {
  if (process.env.NODE_ENV === 'production') return null;
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'mobile' || v === 'desktop' ? v : null;
}
