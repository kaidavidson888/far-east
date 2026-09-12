'use client';

import geometry from '@/lib/seal-geometry.json';
import { useFrameScrub } from '@/lib/useFrameScrub';

/**
 * The seal, which animates when you approach it.
 *
 * Hovering it — or pressing it, on a touch screen — fills the mark with red
 * cloud filigree and inverts it to a black ground. Taking the pointer away
 * before it has finished turns it straight around from wherever it got to,
 * and coming back picks up from there. Pressing it commits: it skips to the
 * last frame and stays, whatever the pointer does afterwards.
 *
 * The canvas covers the page's own seal rather than replacing it, the way
 * the logo menu covers the logo: the animation's first frame IS the seal, at
 * the same 45px square in the same corner, so at rest the canvas paints
 * nothing and the page's sharper vector shows through.
 *
 * It goes nowhere yet — the destination is still to come — so it is a button
 * rather than a link.
 */
const { frames: FRAMES, frameMs, scale: SCALE, placement } = geometry;

const src = (i: number) => `/seal/frames/f${String(i).padStart(3, '0')}.webp`;

export function SealButton({ size = placement.w }: { size?: number }) {
  // 1.8MB of frames: fetched when someone actually reaches for it, not on
  // every page load. The run starts immediately and they arrive underneath.
  const scrub = useFrameScrub({ frames: FRAMES, frameMs, src, preload: false, eager: 1 });

  return (
    <div
      className="seal-button"
      data-phase={scrub.phase}
      style={{
        right: `${placement.right}px`,
        top: `${placement.top}px`,
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <canvas
        ref={scrub.canvasRef}
        className="seal-button-canvas"
        width={size * SCALE}
        height={size * SCALE}
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-hidden="true"
      />
      <button
        type="button"
        className="seal-button-hit"
        aria-label="Seal"
        aria-expanded={scrub.phase === 'open'}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') scrub.enter();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') scrub.leave();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          scrub.press();
        }}
      />
    </div>
  );
}
