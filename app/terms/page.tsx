import type { Metadata } from 'next';
import { TERMS_SPEC } from '@/lib/terms';
import { detectDevice, deviceOverride } from '@/lib/device';
import { ArtworkPage } from '@/components/ArtworkPage';
import { SealButton } from '@/components/SealButton';

export const metadata: Metadata = {
  // the root layout appends " · Far East"
  title: 'Terms of Service',
  description: 'The terms you agree to when you access or use Far East NYC.',
};

/**
 * Terms of Service.
 *
 * The form factor is resolved on the server, so the page arrives already in
 * the right arrangement instead of rearranging itself once JavaScript runs.
 *
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas and
 * `?device=mobile|desktop` forces either arrangement. The logo, the seal and
 * the three footer boxes are buttons with no destinations yet.
 */
export default async function TermsPage({
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
      spec={TERMS_SPEC}
      device={device}
      showHitboxes={showHitboxes}
      overlay={<SealButton size={TERMS_SPEC.sealSize} />}
      hide={['seal']}
    />
  );
}
