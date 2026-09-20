import type { Metadata } from 'next';
import { LANDING_SPEC } from '@/lib/landing';
import { detectDevice, deviceOverride } from '@/lib/device';
import { ArtworkPage } from '@/components/ArtworkPage';
import { LogoMenu } from '@/components/LogoMenu';
import { PRESSABLE } from '@/lib/cigPages';
import { CigScroller } from '@/components/CigScroller';
import { SealButton } from '@/components/SealButton';
import { CornerSeal } from '@/components/CornerSeal';
import { SigilMark } from '@/components/SigilMark';
import { currentUser } from '@/lib/auth';
import { bigShares } from '@/lib/db';

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
  // the number in the outline beside the sigil; a signed-out reader has none
  const user = await currentUser();
  const shares = user ? await bigShares(user.id) : 0;

  // the seal, then the tile with the outline and its number: one entry each,
  // so each takes its own turn arriving when the plus opens the line
  const marks = [
    <SealButton key="seal" size={LANDING_SPEC.sealSize} placed={false} />,
    <SigilMark key="sigil" count={shares} />,
  ];

  return (
    <ArtworkPage
      spec={LANDING_SPEC}
      device={device}
      showHitboxes={showHitboxes}
      overlay={<><CigScroller withPages={PRESSABLE} marks={marks} /><LogoMenu menu="grow" /><CornerSeal /></>}
      decorative={['logo']}
    />
  );
}
