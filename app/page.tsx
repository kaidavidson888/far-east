import { currentUser } from '@/lib/auth';
import { LandingPage } from '@/components/LandingPage';
import { SplashScreen } from '@/components/SplashScreen';

/**
 * The landing page.
 *
 * The previous marketing homepage — hero, lead product, picks, recent reviews,
 * Instagram band — is not gone, just not here: `git show 16dfe04:app/page.tsx`
 * has it, and it can be restored or moved to its own route on request.
 *
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas, and
 * `?nosplash=1` skips the sign-in splash, which otherwise covers this page for
 * anyone signed out. The buttons have no destinations yet.
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

  return (
    <>
      {/* The splash IS the sign-in, so it would otherwise re-gate the reader on
          the very page its own button sends them to. */}
      {user || hideSplash ? null : <SplashScreen />}
      <LandingPage showHitboxes={showHitboxes} />
    </>
  );
}
