import type { Metadata } from 'next';
import { PRIVACY_SPEC } from '@/lib/privacy';
import { detectDevice, deviceOverride } from '@/lib/device';
import { ArtworkPage } from '@/components/ArtworkPage';

export const metadata: Metadata = {
  // the root layout appends " · Far East"
  title: 'Privacy Policy',
  description:
    'How Far East NYC collects, uses, and safeguards your information when you use our website.',
};

/**
 * Privacy Policy.
 *
 * The form factor is resolved on the server, so the page arrives already in
 * the right arrangement instead of rearranging itself once JavaScript runs.
 *
 * Dev-only query flags: `?hitboxes=1` outlines the pressable areas and
 * `?device=mobile|desktop` forces either arrangement. The logo, the seal and
 * the three footer boxes are buttons with no destinations yet.
 */
export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const dev = process.env.NODE_ENV !== 'production';
  const showHitboxes = dev && params.hitboxes !== undefined;
  const device = deviceOverride(params.device) ?? (await detectDevice());

  return <ArtworkPage spec={PRIVACY_SPEC} device={device} showHitboxes={showHitboxes} />;
}
