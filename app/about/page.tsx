import type { Metadata } from 'next';
import { ABOUT_SPEC } from '@/lib/about';
import { detectDevice, deviceOverride } from '@/lib/device';
import { ArtworkPage } from '@/components/ArtworkPage';
import { SealButton } from '@/components/SealButton';

export const metadata: Metadata = {
  // the root layout appends " · Far East"
  title: 'About Us',
  description:
    'Far East NYC is a digital archive and non-profit project dedicated to the curation, ' +
    'review, and historical preservation of Asian tobacco products.',
};

/**
 * About Us.
 *
 * The form factor is resolved here, on the server, so the page arrives already
 * in the right arrangement instead of rearranging itself once JavaScript runs.
 *
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas and
 * `?device=mobile|desktop` forces either arrangement. The logo, the seal and
 * the three footer boxes are buttons with no destinations yet.
 */
export default async function AboutPage({
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
      spec={ABOUT_SPEC}
      device={device}
      showHitboxes={showHitboxes}
      overlay={<SealButton size={ABOUT_SPEC.sealSize} />}
      decorative={['seal']}
    />
  );
}
