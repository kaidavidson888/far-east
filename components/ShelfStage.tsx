'use client';

import { useEffect, useRef } from 'react';
import {
  CLOUD_RIGHT,
  ROW_ANCHOR_X,
  SHELF_DEFAULTS,
  SHELF_MARGIN,
  SHELF_MAX_WIDTH,
  rowScaleFor,
} from '@/lib/shelfPage';

/**
 * The shelf's stage, which measures its own width and hands two numbers to the
 * CSS: where the aligned right edge is, and how much to scale each row.
 *
 * Everything that meets the right edge — the header, the $240, the divider,
 * and each row's clouds — reads `--aligned-right`, which is the width less the
 * logo's margin, so the right margin mirrors the left at any phone width. The
 * rows also read `--row-scale`, the factor that lands their clouds on that
 * edge. Past SHELF_MAX_WIDTH the width is held, so the shelf becomes a column
 * on a desktop rather than scaling the packs up without bound.
 *
 * The values are set inline for first paint from the design's own width, so
 * the server-rendered page is already right at ~390px and only adjusts once
 * measured. A ResizeObserver keeps them current.
 */
export function ShelfStage({ minHeight, children }: { minHeight: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const w = Math.min(el.clientWidth, SHELF_MAX_WIDTH);
      const alignedRight = w - SHELF_MARGIN;
      el.style.setProperty('--aligned-right', `${alignedRight}px`);
      el.style.setProperty('--row-scale', String(rowScaleFor(alignedRight)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="shelf-stage"
      style={
        {
          minHeight: `${minHeight}px`,
          '--aligned-right': `${SHELF_DEFAULTS.alignedRight}px`,
          '--row-scale': String(SHELF_DEFAULTS.rowScale),
          '--shelf-anchor': `${ROW_ANCHOR_X}px`,
          '--shelf-margin': `${SHELF_MARGIN}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
