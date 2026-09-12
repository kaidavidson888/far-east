import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { safeNext } from '@/lib/siteUrl';
import { detectDevice, deviceOverride } from '@/lib/device';
import { LANDING_SPEC } from '@/lib/landing';
import { ArtworkPage } from '@/components/ArtworkPage';
import { LogoMenu } from '@/components/LogoMenu';
import { PRESSABLE } from '@/lib/cigPages';
import { CigScroller } from '@/components/CigScroller';
import { SealButton } from '@/components/SealButton';
import { SplashScreen } from '@/components/SplashScreen';

/**
 * The landing page.
 *
 * The previous marketing homepage — hero, lead product, picks, recent reviews,
 * Instagram band — is not gone, just not here: `git show 16dfe04:app/page.tsx`
 * has it, and it can be restored or moved to its own route on request.
 *
 * The form factor is resolved here, on the server, so the page arrives already
 * in the right arrangement instead of rearranging itself once JavaScript runs.
 *
 * THIS IS ALSO THE SIGN-IN SCREEN. A signed-out reader who reaches for
 * something that needs an account — the bookmark on a cigarette's page, the
 * shelf button in the catalogue — is sent here rather than to /login, because
 * the splash's box IS the login form. They arrive at `/?next=<where they
 * were>` and are put back there once they are in. Somebody who is already
 * signed in has nothing to do here and goes straight through.
 *
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas,
 * `?nosplash=1` skips the sign-in splash, and `?device=mobile|desktop` forces
 * either arrangement. The buttons have no destinations yet.
 */
/**
 * What came back wrong, in words a reader can act on. Only 'mismatch' reaches
 * here today: they typed one address and then chose a different Google account
 * at the prompt, so nothing was signed in and nothing was changed.
 */
const TROUBLE: Record<string, string> = {
  mismatch: 'That is not the address you started with. Nothing has been changed — try again.',
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  // '' rather than a page, so an ordinary visit to / stays on /
  const next = safeNext(params.next, '');
  if (user && next) redirect(next);
  // Something the reader needs told, from a round trip that ended here rather
  // than where it meant to — see app/auth/callback/route.ts.
  const notice = typeof params.error === 'string' ? (TROUBLE[params.error] ?? null) : null;
  const dev = process.env.NODE_ENV !== 'production';
  const showHitboxes = dev && params.hitboxes !== undefined;
  const hideSplash = dev && params.nosplash !== undefined;
  const device = deviceOverride(params.device) ?? (await detectDevice());

  return (
    <>
      {/* The splash IS the sign-in, so it would otherwise re-gate the reader on
          the very page its own button sends them to. */}
      {user || hideSplash ? null : <SplashScreen next={next} notice={notice} />}
      <ArtworkPage
        spec={LANDING_SPEC}
        device={device}
        showHitboxes={showHitboxes}
        overlay={<><CigScroller withPages={PRESSABLE} /><LogoMenu /><SealButton size={LANDING_SPEC.sealSize} /></>}
        decorative={['logo']}
      hide={['seal']}
      />
    </>
  );
}
