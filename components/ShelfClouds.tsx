'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SHELF_CLOUDS, SHELF_CLOUD_VIEW } from '@/lib/shelfClouds';

/**
 * THE FIVE CLOUDS, AND THEY OPEN.
 *
 * The owner's 2026-09-20 ask, with two drawings: "in the outline on the bottom
 * include the svg of the clouds together but in red and make it into a button
 * that on hover or click sees the clouds open up within the outline into the
 * second image."
 *
 * The two drawings are two poses of ONE object — every one of the ten paths
 * rasterises to the same area — so `npm run build:shelfclouds` pairs them,
 * finds the turn that carries each cloud onto its partner, and proves it on
 * the pixels (96.9% mean overlap). What is animated here is therefore five
 * marks TRAVELLING AND TURNING, not two pictures cross-fading: the clouds
 * open, which is what was asked for, where a cross-fade would read as one
 * drawing being swapped for another.
 *
 * IT IS DRIVEN BY ONE NUMBER AND RUN ON ITS OWN CLOCK. Every cloud's
 * transform interpolates on `t`, so hovering away part-way turns it round
 * from wherever it had reached rather than snapping — the same rule the
 * landing menu opens by. A press latches it open; pressing again closes it.
 *
 * A reader who has asked for less motion gets the two poses without the
 * travel: the transform still lands, it simply arrives in one step.
 */

/** How long the clouds take to open, and to gather again. */
const OPEN_MS = 520;
const SHUT_MS = 420;

export function ShelfClouds({
  size,
  label,
  onPress,
  className,
}: {
  /** the square the clouds open inside, in px */
  size: number;
  label: string;
  onPress?: () => void;
  className?: string;
}) {
  const [t, setT] = useState(0);
  const want = useRef(0);
  const at = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const latched = useRef(false);

  const run = useCallback(() => {
    if (raf.current) return;
    const tick = (ts: number) => {
      const dt = last.current ? Math.min(120, ts - last.current) : 16;
      last.current = ts;
      const to = want.current;
      const span = to > at.current ? OPEN_MS : SHUT_MS;
      const step = dt / span;
      at.current = to > at.current
        ? Math.min(to, at.current + step)
        : Math.max(to, at.current - step);
      setT(at.current);
      if (at.current !== to) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = 0;
        last.current = 0;
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  const aim = useCallback((to: number) => {
    want.current = to;
    if (typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      at.current = to;
      setT(to);
      return;
    }
    run();
  }, [run]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // `ease` is only the shape of the travel; `t` itself stays linear so that
  // turning round part-way picks up exactly where it had got to
  const u = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  const half = SHELF_CLOUD_VIEW / 2;

  return (
    <button
      type="button"
      className={`shelf-clouds${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-label={label}
      aria-expanded={t > 0.5}
      onPointerEnter={() => { if (!latched.current) aim(1); }}
      onPointerLeave={() => { if (!latched.current) aim(0); }}
      onFocus={() => { if (!latched.current) aim(1); }}
      onBlur={() => { if (!latched.current) aim(0); }}
      onClick={() => {
        latched.current = !latched.current;
        aim(latched.current ? 1 : 0);
        onPress?.();
      }}
    >
      <svg
        viewBox={`0 0 ${SHELF_CLOUD_VIEW} ${SHELF_CLOUD_VIEW}`}
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        {SHELF_CLOUDS.map((c, i) => {
          const x = c.shut.x + (c.open.x - c.shut.x) * u;
          const y = c.shut.y + (c.open.y - c.shut.y) * u;
          const a = c.shut.a + (c.open.a - c.shut.a) * u;
          return (
            <g
              key={i}
              transform={
                `translate(${(half + x).toFixed(3)} ${(half + y).toFixed(3)}) `
                + `rotate(${a.toFixed(3)}) `
                + `translate(${(-c.origin.x).toFixed(3)} ${(-c.origin.y).toFixed(3)})`
              }
            >
              <path d={c.d} fill="currentColor" />
            </g>
          );
        })}
      </svg>
    </button>
  );
}
