import {
  LANDING_CLUSTER,
  LANDING_CLUSTER_PLACEMENT,
  LANDING_MIN_HEIGHT,
  LANDING_PARTS,
  type LandingDevice,
  type LandingPart,
  type Placement,
} from '@/lib/landing';

/**
 * The landing page.
 *
 * Each mark is its own SVG, positioned against the viewport's edges so the
 * design's margins hold at any width — 24px to the seal at the top, 30 to its
 * right, 46 to the logo on the left, 67 under the square at the foot. The
 * artwork is not scaled to fit, because that would scale those margins with
 * it; the elements keep their drawn size and the space between them flexes.
 *
 * `device` decides the arrangement and comes from the server, so the page
 * arrives already laid out rather than rearranging itself after hydration.
 *
 * The words are real <button>s wrapping their own artwork, so they are
 * reachable by keyboard and announced properly. The cloud and the square are
 * decoration and are marked as such. `?hitboxes=1` outlines everything in dev.
 */
function styleFor(p: Placement, w: number, h: number): React.CSSProperties {
  return {
    width: `${w}px`,
    height: `${h}px`,
    ...(p.left !== undefined ? { left: `${p.left}px` } : null),
    ...(p.right !== undefined ? { right: `${p.right}px` } : null),
    ...(p.top !== undefined ? { top: `${p.top}px` } : null),
    ...(p.bottom !== undefined ? { bottom: `${p.bottom}px` } : null),
    ...(p.centreX ? { left: '50%', transform: `translateX(-${w / 2}px)` } : null),
  };
}

function Mark({ part, debug }: { part: LandingPart; debug: boolean }) {
  return (
    <img
      className={`landing-mark${debug ? ' landing-debug' : ''}`}
      src={part.src}
      alt=""
      width={part.w}
      height={part.h}
      draggable={false}
    />
  );
}

export function LandingPage({
  device,
  showHitboxes = false,
}: {
  device: LandingDevice;
  showHitboxes?: boolean;
}) {
  const loose = LANDING_PARTS.filter((p) => !p.inCluster);
  const cluster = LANDING_PARTS.filter((p) => p.inCluster);
  const clusterPlacement = LANDING_CLUSTER_PLACEMENT[device];

  return (
    <div className="landing" data-device={device}>
      <div className="landing-stage" style={{ minHeight: `${LANDING_MIN_HEIGHT}px` }}>
        {loose.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`landing-hit${showHitboxes ? ' landing-hit-debug' : ''}`}
            aria-label={p.label}
            style={styleFor(p.placement![device], p.w, p.h)}
          >
            <Mark part={p} debug={false} />
          </button>
        ))}

        <div
          className="landing-cluster"
          style={styleFor(clusterPlacement, LANDING_CLUSTER.w, LANDING_CLUSTER.h)}
        >
          {cluster.map((p) =>
            p.pressable ? (
              <button
                key={p.id}
                type="button"
                className={`landing-hit${showHitboxes ? ' landing-hit-debug' : ''}`}
                aria-label={p.label}
                style={{
                  left: `${p.inCluster!.left}px`,
                  top: `${p.inCluster!.top}px`,
                  width: `${p.w}px`,
                  height: `${p.h}px`,
                }}
              >
                <Mark part={p} debug={false} />
              </button>
            ) : (
              <div
                key={p.id}
                className={`landing-decor${showHitboxes ? ' landing-hit-debug' : ''}`}
                aria-hidden="true"
                style={{
                  left: `${p.inCluster!.left}px`,
                  top: `${p.inCluster!.top}px`,
                  width: `${p.w}px`,
                  height: `${p.h}px`,
                }}
              >
                <Mark part={p} debug={false} />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
