import type { ArtDevice, ArtPageSpec, ArtPart, ArtPlacement } from '@/lib/artpage';
import { ArtPartButton } from './ArtPartButton';

/**
 * Renders a page built from a supplied design image.
 *
 * Each mark is its own SVG positioned against the viewport's edges, so the
 * design's margins hold in real pixels at any width and the space between
 * elements flexes instead. `device` decides the arrangement and comes from
 * the server, so the page arrives already laid out rather than rearranging
 * itself after hydration.
 *
 * Pressable marks are real <button>s wrapping their own artwork, so they are
 * reachable by keyboard and announced properly; the rest are marked
 * decorative. `showHitboxes` outlines everything in dev.
 */
function styleFor(p: ArtPlacement, w: number, h: number): React.CSSProperties {
  return {
    width: `${w}px`,
    height: `${h}px`,
    ...(p.left !== undefined ? { left: `${p.left}px` } : null),
    ...(p.right !== undefined ? { right: `${p.right}px` } : null),
    ...(p.top !== undefined ? { top: `${p.top}px` } : null),
    ...(p.bottom !== undefined ? { bottom: `${p.bottom}px` } : null),
    // Round the centring offset. An odd-width mark centred exactly lands on
    // a half pixel, and the browser resamples the whole bitmap to draw it
    // there — the softness that costs is far more visible than the half
    // pixel of asymmetry avoiding it introduces.
    ...(p.centreX ? { left: '50%', transform: `translateX(-${Math.round(w / 2)}px)` } : null),
  };
}

const boxStyle = (part: ArtPart): React.CSSProperties => ({
  left: `${part.inCluster!.left}px`,
  top: `${part.inCluster!.top}px`,
  width: `${part.w}px`,
  height: `${part.h}px`,
});

function Mark({ part }: { part: ArtPart }) {
  return (
    <img
      className="artpage-mark"
      src={part.src}
      alt=""
      width={part.w}
      height={part.h}
      draggable={false}
    />
  );
}

function Placed({
  part,
  style,
  showHitboxes,
}: {
  part: ArtPart;
  style: React.CSSProperties;
  showHitboxes: boolean;
}) {
  const debug = showHitboxes ? ' artpage-hit-debug' : '';
  if (!part.pressable) {
    return (
      <div className={`artpage-decor${debug}`} aria-hidden="true" style={style}>
        <Mark part={part} />
      </div>
    );
  }
  // the footer row reacts to hover and to being pressed, so it needs state
  if (part.current || part.hoverSrc) {
    return (
      <ArtPartButton part={part} style={style} className={`artpage-hit${debug}`}>
        <Mark part={part} />
      </ArtPartButton>
    );
  }
  if (part.href) {
    return (
      <a className={`artpage-hit${debug}`} href={part.href} aria-label={part.label} style={style}>
        <Mark part={part} />
      </a>
    );
  }
  return (
    <button type="button" className={`artpage-hit${debug}`} aria-label={part.label} style={style}>
      <Mark part={part} />
    </button>
  );
}

export function ArtworkPage({
  spec,
  device,
  showHitboxes = false,
  overlay,
  decorative,
}: {
  spec: ArtPageSpec;
  device: ArtDevice;
  showHitboxes?: boolean;
  /** Anything that positions itself against the stage — the logo menu does. */
  overlay?: React.ReactNode;
  /**
   * Parts to draw but not make pressable, because the overlay provides the
   * control instead. The logo menu covers the logo with its own button, and
   * two buttons on one mark would be announced twice.
   */
  decorative?: string[];
}) {
  const parts = decorative?.length
    ? spec.parts.map((p) => (decorative.includes(p.id) ? { ...p, pressable: false } : p))
    : spec.parts;
  const loose = parts.filter((p) => !p.inCluster);
  const clustered = parts.filter((p) => p.inCluster);

  return (
    <div
      className="artpage"
      data-device={device}
      style={
        {
          '--artpage-bg': spec.background,
          '--artpage-focus': spec.focus,
        } as React.CSSProperties
      }
    >
      <div className="artpage-stage" style={{ minHeight: `${spec.minHeight}px` }}>
        {loose.map((p) => (
          <Placed
            key={p.id}
            part={p}
            style={styleFor(p.placement![device], p.w, p.h)}
            showHitboxes={showHitboxes}
          />
        ))}

        {spec.cluster ? (
          <div
            className="artpage-cluster"
            style={styleFor(spec.cluster.placement[device], spec.cluster.w, spec.cluster.h)}
          >
            {clustered.map((p) => (
              <Placed key={p.id} part={p} style={boxStyle(p)} showHitboxes={showHitboxes} />
            ))}
          </div>
        ) : null}

        {overlay}
      </div>
    </div>
  );
}
