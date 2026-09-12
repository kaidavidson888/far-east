'use client';

import { useEffect, useRef } from 'react';
import { ROW_ANCHOR_X, SHELF_DEFAULTS, SHELF_MARGIN, rowScaleFor } from '@/lib/shelfPage';

/**
 * The shelf's stage, which measures its own width and hands two numbers to the
 * CSS: where the aligned right edge is, and how much to zoom the rows.
 *
 * Everything that meets the right edge — the header, the $240, the divider,
 * and each row's clouds — reads `--aligned-right`, which is the width less the
 * logo's margin, so the right margin mirrors the left at any width. The rows
 * block reads `--row-scale`, the zoom that lands its clouds on that edge, and
 * the stage's own height grows with it so the page scrolls to the last row.
 *
 * The values are set inline for first paint from the design's own width, so
 * the server-rendered page is already right at ~390px and only adjusts once
 * measured. A ResizeObserver keeps them current.
 */
export function ShelfStage({
  rowsTop,
  rowsHeight,
  bottom,
  children,
}: {
  rowsTop: number;
  rowsHeight: number;
  bottom: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const alignedRight = el.clientWidth - SHELF_MARGIN;
      const scale = rowScaleFor(alignedRight);
      el.style.setProperty('--aligned-right', `${alignedRight}px`);
      el.style.setProperty('--row-scale', String(scale));
      el.style.minHeight = `${Math.ceil(rowsTop + rowsHeight * scale + bottom)}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottom, rowsHeight, rowsTop]);

  return (
    <div
      ref={ref}
      className="shelf-stage"
      style={
        {
          minHeight: `${Math.ceil(rowsTop + rowsHeight * SHELF_DEFAULTS.rowScale + bottom)}px`,
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
