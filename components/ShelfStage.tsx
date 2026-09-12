'use client';

import { useEffect, useRef } from 'react';
import {
  CAPTION_DEFAULT,
  ROW_ANCHOR_X,
  SHELF_DEFAULTS,
  SHELF_HEADER,
  SHELF_LOGO,
  SHELF_MARGIN,
  fitCaption,
  rowScaleFor,
} from '@/lib/shelfPage';

/**
 * The shelf's stage, which measures what the CSS cannot know and hands it
 * down: where the aligned right edge is, how much to zoom the rows, how big
 * the logo is, and how wide the price really is.
 *
 * Everything that meets the right edge — the header, the $240, the divider —
 * reads `--aligned-right`, which is the width less the logo's margin, so the
 * right margin mirrors the left at any width. The rows block reads
 * `--row-scale`, and the stage's own height grows with it so the page scrolls
 * to the last row.
 *
 * THE LOGO IS SIZED TO THE TOP PACK. Its width on screen is the first pack's
 * rule width times the zoom; the height follows the mark's own proportion,
 * held to what the header has room for (SHELF_LOGO.maxHeight); and it is
 * placed so its centre stays exactly where the landing page draws it — the
 * owner's "use its current centre of mass as a guide". Set as real width and
 * height rather than a transform, so the vector rasterises sharp at the size
 * it shows at. Whole pixels throughout.
 *
 * THE HEADER IS MEASURED IN THE PAGE'S OWN FACES. The caption's box takes the
 * price's width and the caption is fitted inside it to a 3px clearance. Two
 * of those characters — `$` and `#` — are not in the owner's face and come
 * from the fallback, whose widths the ink table can only estimate; measured
 * here on a canvas with the elements' own computed fonts, once the fonts are
 * loaded, the margins come out exact. The table's figures are the first paint.
 *
 * A ResizeObserver keeps the width-dependent values current.
 */
function logoVars(topPackWidth: number | null, scale: number) {
  let w = topPackWidth ? Math.round(topPackWidth * scale) : SHELF_LOGO.w;
  let h = Math.round((w * SHELF_LOGO.h) / SHELF_LOGO.w);
  if (h > SHELF_LOGO.maxHeight) {
    h = SHELF_LOGO.maxHeight;
    w = Math.round((h * SHELF_LOGO.w) / SHELF_LOGO.h);
  }
  return {
    '--logo-w': `${w}px`,
    '--logo-h': `${h}px`,
    '--logo-left': `${Math.round(SHELF_LOGO.centreX - w / 2)}px`,
    '--logo-top': `${Math.round(SHELF_LOGO.centreY - h / 2)}px`,
  };
}

/**
 * The caption fitted to the box from its REAL ink at its real size.
 *
 * A first pass sizes it from the run's width per em; but type set small does
 * not scale down exactly from type set large (hinting, rounding), and the
 * difference was 1.7px of a 3px margin. So the run is measured again at the
 * size the first pass chose, the size corrected by the ratio, and the run
 * centred on the ink it actually has — its measured ascent placing it
 * vertically, not the table's.
 */
function captionVars(boxWidth: number, captionEm: number, measure: (size: number) => TextMetrics) {
  const { box, caption, baseline } = SHELF_HEADER;
  const innerW = boxWidth - box.stroke * 2;
  const innerH = box.height - box.stroke * 2;
  const roomW = innerW - caption.clearance * 2;
  const roomH = innerH - caption.clearance * 2;

  let size = fitCaption(boxWidth, captionEm).size;
  let m = measure(size);
  const inkW = () => m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const inkH = () => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  // correct for what the small size actually draws, on whichever side binds
  size = +(size * Math.min(roomW / inkW(), roomH / inkH())).toFixed(2);
  m = measure(size);

  const left = +((innerW - inkW()) / 2 - m.actualBoundingBoxLeft).toFixed(2);
  const top = +((innerH - inkH()) / 2 - (baseline * size - m.actualBoundingBoxAscent)).toFixed(2);
  return {
    '--price-w': `${boxWidth}px`,
    '--caption-size': `${size}px`,
    '--caption-left': `${left}px`,
    '--caption-top': `${top}px`,
  };
}

export function ShelfStage({
  rowsTop,
  rowsHeight,
  bottom,
  topPackWidth,
  children,
}: {
  rowsTop: number;
  rowsHeight: number;
  bottom: number;
  topPackWidth: number | null;
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
      for (const [k, v] of Object.entries(logoVars(topPackWidth, scale))) el.style.setProperty(k, v);
      el.style.minHeight = `${Math.ceil(rowsTop + rowsHeight * scale + bottom)}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottom, rowsHeight, rowsTop, topPackWidth]);

  // the header, once the faces are in: the price's real ink width, and the
  // caption fitted to it with its real fallback glyphs
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const priceEl = el.querySelector<HTMLElement>('.shelf-price');
      const captionEl = el.querySelector<HTMLElement>('.shelf-header-box .shelf-type');
      const ctx = document.createElement('canvas').getContext('2d');
      if (!priceEl || !captionEl || !ctx) return;
      const font = (e: HTMLElement, size: number) => {
        const cs = getComputedStyle(e);
        return `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      };
      ctx.font = font(priceEl, SHELF_HEADER.price.size);
      const p = ctx.measureText(SHELF_HEADER.price.text);
      const priceInk = p.actualBoundingBoxLeft + p.actualBoundingBoxRight;
      const boxWidth = Math.round(priceInk + SHELF_HEADER.price.stroke);
      ctx.font = font(captionEl, 100);
      const c = ctx.measureText(SHELF_HEADER.caption.text);
      const captionEm = (c.actualBoundingBoxLeft + c.actualBoundingBoxRight) / 100;
      const measure = (size: number) => {
        ctx.font = font(captionEl, size);
        return ctx.measureText(SHELF_HEADER.caption.text);
      };
      for (const [k, v] of Object.entries(captionVars(boxWidth, captionEm, measure))) el.style.setProperty(k, v);
    };
    document.fonts.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, []);

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
          ...logoVars(topPackWidth, SHELF_DEFAULTS.rowScale),
          '--price-w': `${SHELF_HEADER.box.width}px`,
          '--caption-size': `${CAPTION_DEFAULT.size}px`,
          '--caption-left': `${CAPTION_DEFAULT.left}px`,
          '--caption-top': `${CAPTION_DEFAULT.top}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
