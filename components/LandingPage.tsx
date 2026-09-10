import { LANDING_ART, LANDING_HITS, LANDING_VIEWBOX } from '@/lib/landing';

/**
 * The mobile landing page, straight from the Figma export.
 *
 * The artwork is one SVG (text already outlined, so there is no font to load
 * and nothing to reflow) laid out at its own 390 x 844 aspect ratio, with a
 * transparent button over each thing that should be pressable. The hit areas
 * are fractions of the viewBox, so they stay on their marks at any width.
 *
 * The buttons do nothing yet — the destinations are still to come. They are
 * real <button>s rather than overlays so they are reachable by keyboard and
 * announced properly; `?hitboxes=1` outlines them in dev to check placement.
 */
export function LandingPage({ showHitboxes = false }: { showHitboxes?: boolean }) {
  const { w: W, h: H } = LANDING_VIEWBOX;
  const pct = (n: number) => `${n * 100}%`;

  return (
    <div className="landing">
      <div className="landing-frame">
        {/* decorative: every word in it is also a button below, so a screen
            reader gets the content from those rather than twice over */}
        <img className="landing-art" src={LANDING_ART} alt="" width={W} height={H} />

        {LANDING_HITS.map((hit) => (
          <button
            key={hit.id}
            type="button"
            className={`landing-hit${showHitboxes ? ' landing-hit-debug' : ''}`}
            aria-label={hit.label}
            style={{
              left: pct(hit.x / W),
              top: pct(hit.y / H),
              width: pct(hit.w / W),
              height: pct(hit.h / H),
            }}
          />
        ))}
      </div>
    </div>
  );
}
