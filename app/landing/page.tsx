import type { Metadata } from 'next';
import { LANDING_SPEC } from '@/lib/landing';
import { detectDevice, deviceOverride } from '@/lib/device';
import { ArtworkPage } from '@/components/ArtworkPage';
import { LogoMenu } from '@/components/LogoMenu';
import cigpages from '@/lib/cigpages.json';
import { CigScroller } from '@/components/CigScroller';
import { SealButton } from '@/components/SealButton';

export const metadata: Metadata = {
  // the root layout appends " · Far East"
  title: 'Landing',
};

/**
 * The landing page on its own, with no sign-in splash over it.
 *
 * `/` shows the same artwork behind the splash, which gates it for anyone
 * signed out; this route is the way in when you just want the page — for
 * review, for linking to, and for the splash's own button to land on.
 *
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas and
 * `?device=mobile|desktop` forces either arrangement.
 */
export default async function LandingRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const dev = process.env.NODE_ENV !== 'production';
  const showHitboxes = dev && params.hitboxes !== undefined;
  const device = deviceOverride(params.device) ?? (await detectDevice());

  return (
    <ArtworkPage
      spec={LANDING_SPEC}
      device={device}
      showHitboxes={showHitboxes}
      overlay={<><CigScroller withPages={cigpages.pages.map((p) => p.id)} /><LogoMenu /><SealButton size={LANDING_SPEC.sealSize} /></>}
      decorative={['logo']}
      hide={['seal']}
    />
  );
}
