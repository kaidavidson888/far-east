'use client';

import { useEffect, useRef } from 'react';
import {
  CAPTION_DEFAULT,
  DESIGN_ALIGNED_RIGHT,
  SHELF_HEADER,
  SHELF_MARGIN,
  fitCaption,
  shelfFit,
  type ShelfFit,
} from '@/lib/shelfPage';

/**
 * The shelf's stage, which measures what the CSS cannot know and hands it
 * down: where the aligned right edge is, where the rows start and how much
 * they are zoomed, how big the logo is, and how wide the price really is.
 *
 * Everything that meets the right edge — the header, the $240, the divider —
 * reads `--aligned-right`, which is the width less the logo's margin, so the
 * right margin mirrors the left at any width. The rows block reads
 * `--rows-left` and `--row-scale` from `shelfFit`, which puts the rows between
 * the logo's right edge and the caption box's left edge (see shelfPage.ts),
 * and the stage's own height grows with the zoom so the page scrolls to the
 * last row.
 *
 * THE LOGO COMES OUT OF THE SAME FIT. It is sized to the top pack about its
 * own centre, and because the rows' zoom and the logo's width depend on each
 * other, one solve gives both. Set as real width and height rather than a
 * transform, so the vector rasterises sharp at the size it shows at.
 *
 * THE HEADER IS MEASURED IN THE PAGE'S OWN FACES. The caption's box takes the
 * price's width and the caption is fitted inside it to a 3px clearance. `$`
 * and `#` come from the fallback face, whose widths the ink table can only
 * estimate; measured here on a canvas with the elements' own computed fonts,
 * once the fonts are loaded, the margins come out exact — and the price's
 * measured width goes back into the fit, since the caption box's left edge is
 * where the rows end. The table's figures are the first paint.
 */
function fitVars(fit: ShelfFit) {
  return {
    '--row-scale': String(fit.scale),
    '--rows-left': `${fit.rowsLeft}px`,
    '--logo-w': `${fit.logo.w}px`,
    '--logo-h': `${fit.logo.h}px`,
    '--logo-left': `${fit.logo.left}px`,
    '--logo-top': `${fit.logo.top}px`,
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
  /** The price box's width — the table's figure until the faces are measured. */
  const priceWRef = useRef(SHELF_HEADER.box.width);
  const applyRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const alignedRight = el.clientWidth - SHELF_MARGIN;
      const fit = shelfFit(alignedRight, priceWRef.current, topPackWidth);
      el.style.setProperty('--aligned-right', `${alignedRight}px`);
      for (const [k, v] of Object.entries(fitVars(fit))) el.style.setProperty(k, v);
      el.dataset.fit = fit.mode;
      el.style.minHeight = `${Math.ceil(rowsTop + rowsHeight * fit.scale + bottom)}px`;
    };
    applyRef.current = apply;
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottom, rowsHeight, rowsTop, topPackWidth]);

  // the header, once the faces are in: the price's real ink width, and the
  // caption fitted to it with its real fallback glyphs — then the fit again,
  // because the caption box's left edge is where the rows end
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
      const measureAt = (size: number) => {
        ctx.font = font(captionEl, size);
        return ctx.measureText(SHELF_HEADER.caption.text);
      };
      for (const [k, v] of Object.entries(captionVars(boxWidth, captionEm, measureAt))) el.style.setProperty(k, v);
      priceWRef.current = boxWidth;
      applyRef.current();
    };
    document.fonts.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, []);

  const first = shelfFit(DESIGN_ALIGNED_RIGHT, SHELF_HEADER.box.width, topPackWidth);

  return (
    <div
      ref={ref}
      className="shelf-stage"
      data-fit={first.mode}
      style={
        {
          minHeight: `${Math.ceil(rowsTop + rowsHeight * first.scale + bottom)}px`,
          '--aligned-right': `${DESIGN_ALIGNED_RIGHT}px`,
          '--shelf-margin': `${SHELF_MARGIN}px`,
          ...fitVars(first),
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
