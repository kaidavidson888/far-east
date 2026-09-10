import { currentUser } from '@/lib/auth';
import { detectDevice, deviceOverride } from '@/lib/device';
import { LANDING_SPEC } from '@/lib/landing';
import { ArtworkPage } from '@/components/ArtworkPage';
import { LogoMenu } from '@/components/LogoMenu';
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
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas,
 * `?nosplash=1` skips the sign-in splash, and `?device=mobile|desktop` forces
 * either arrangement. The buttons have no destinations yet.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const dev = process.env.NODE_ENV !== 'production';
  const showHitboxes = dev && params.hitboxes !== undefined;
  const hideSplash = dev && params.nosplash !== undefined;
  const device = deviceOverride(params.device) ?? (await detectDevice());

  return (
    <>
      {/* The splash IS the sign-in, so it would otherwise re-gate the reader on
          the very page its own button sends them to. */}
      {user || hideSplash ? null : <SplashScreen />}
      <ArtworkPage
        spec={LANDING_SPEC}
        device={device}
        showHitboxes={showHitboxes}
        overlay={<LogoMenu />}
        decorative={['logo']}
      />
    </>
  );
}
