'use client';

import { useEffect, useRef } from 'react';
import {
  DESIGN_ALIGNED_RIGHT,
  DESIGN_WIDTH,
  PRICE_BOX,
  SHELF_HEADER,
  SHELF_MARGIN,
  columnPitch,
  gridHeight,
  shelfFit,
  shelfTopShift,
  type PriceMetrics,
  type ShelfFit,
} from '@/lib/shelfPage';

/**
 * The shelf's stage, which measures what the CSS cannot know and hands it
 * down: where the aligned right edge is, where the grid starts, how much it
 * is zoomed and how many columns it has, how big the logo is, and where the
 * price and its box sit.
 *
 * The divider reads `--aligned-right`, which is the width less the logo's
 * margin, so the right margin mirrors the left at any width. The rows read
 * `--rows-left`, `--row-scale`, `--cols` and the two pitches from `shelfFit`,
 * which puts the grid between the logo's right edge and the $ sign (see
 * shelfPage.ts) — two entries to a line, or one on a phone — and each row finds
 * its own column and line from its index in the stylesheet. The stage's height
 * grows with the zoom and the line count so the page scrolls to the last line.
 *
 * THE LOGO COMES OUT OF THE SAME FIT. It is sized to the top pack about its
 * own centre, and because the grid's zoom and the logo's width depend on each
 * other, one solve gives both. Set as real width and height rather than a
 * transform, so the vector rasterises sharp at the size it shows at.
 *
 * THE PRICE'S BOX COMES OUT OF IT TOO: the logo's band, its top on the logo's
 * and its right edge on the aligned margin, where the red line ends
 * (PRICE_BOX). The stage hands down the box's place and size and the price's
 * size and origin — the origin worked back from where the INK has to sit, by
 * the run's bearing and the stroke's outer half.
 *
 * THE WHOLE PAGE THEN COMES DOWN BY `--shelf-top` — whatever puts the logo's
 * top on the same margin its left holds (shelfTopShift). Every top-anchored
 * thing adds it, and the stage's height grows by it.
 *
 * THE PRICE IS MEASURED IN THE PAGE'S OWN FACE. The box is sized round the
 * run's ink, and the ink table is a whole-unit estimate at 1000 upem whose
 * width is the run's advance, not its ink; measured here on a canvas with the
 * element's own computed font once the faces are loaded, the margins come out
 * exact — and the measurement goes back into the fit, since the $ sign's left
 * edge is where the grid ends. The table's figures are the first paint.
 */
function fitVars(fit: ShelfFit, pitch: number, rowWidth: number, price: PriceMetrics) {
  const shift = shelfTopShift(fit);
  const { box } = fit;
  const stroke = SHELF_HEADER.price.strokeEm * box.size;
  // the ink, stroke included, centred inside the rule: the box's edges are
  // whole pixels, so the fraction its rounding leaves over is split between
  // the two sides rather than all landing on one. Then the element's origin
  // from the ink: the run starts its bearing right of the origin, and the
  // stroke paints half its width outside the ink.
  const inkW = (price.em + SHELF_HEADER.price.strokeEm) * box.size;
  const inkH = (price.asc + price.desc + SHELF_HEADER.price.strokeEm) * box.size;
  const inkLeft = box.left + PRICE_BOX.rule + (box.width - 2 * PRICE_BOX.rule - inkW) / 2;
  const inkTop = box.top + PRICE_BOX.rule + (box.height - 2 * PRICE_BOX.rule - inkH) / 2;
  const left = inkLeft + stroke / 2 - price.lsb * box.size;
  const top = inkTop + stroke / 2 + (price.asc - SHELF_HEADER.baseline) * box.size;
  return {
    '--shelf-top': `${shift}px`,
    '--row-scale': String(fit.scale),
    '--rows-left': `${fit.rowsLeft}px`,
    '--cols': String(fit.cols),
    '--col-pitch': `${columnPitch(rowWidth)}px`,
    '--row-pitch': `${pitch}px`,
    '--logo-w': `${fit.logo.w}px`,
    '--logo-h': `${fit.logo.h}px`,
    '--logo-left': `${fit.logo.left}px`,
    '--logo-top': `${fit.logo.top + shift}px`,
    '--price-box-left': `${box.left}px`,
    '--price-box-top': `${box.top + shift}px`,
    '--price-box-w': `${box.width}px`,
    '--price-box-h': `${box.height}px`,
    '--price-size': `${box.size}px`,
    '--price-left': `${left.toFixed(2)}px`,
    '--price-top': `${(top + shift).toFixed(2)}px`,
  };
}

export function ShelfStage({
  rowsTop,
  rowHeight,
  pitch,
  count,
  bottom,
  topPackWidth,
  rowWidth,
  bodyWidth,
  children,
}: {
  rowsTop: number;
  rowHeight: number;
  pitch: number;
  count: number;
  bottom: number;
  topPackWidth: number | null;
  /** The row's width in row px — it grows with the widest pack on the shelf. */
  rowWidth: number;
  /** The row's width to the panel's edge, sigils excluded — what the line is fitted by. */
  bodyWidth: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  /** The price run's ink — the table's figures until the face is measured. */
  const priceRef = useRef<PriceMetrics>(SHELF_HEADER.price.table);
  const applyRef = useRef<() => void>(() => {});

  const minHeightFor = (fit: ShelfFit) =>
    `${Math.ceil(shelfTopShift(fit) + rowsTop + gridHeight(count, fit.cols, rowHeight, pitch) * fit.scale + bottom)}px`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const width = el.clientWidth;
      const fit = shelfFit(width, priceRef.current, topPackWidth, rowWidth, bodyWidth);
      el.style.setProperty('--aligned-right', `${width - SHELF_MARGIN}px`);
      for (const [k, v] of Object.entries(fitVars(fit, pitch, rowWidth, priceRef.current))) el.style.setProperty(k, v);
      el.dataset.fit = fit.mode;
      el.style.minHeight = minHeightFor(fit);
    };
    applyRef.current = apply;
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
    // minHeightFor closes over the same props this effect lists
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottom, count, pitch, rowHeight, rowsTop, topPackWidth, rowWidth, bodyWidth]);

  // the price's real ink, once the face is in — then the fit again, because
  // the $ sign's left edge is where the grid ends
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const priceEl = el.querySelector<HTMLElement>('.shelf-price');
      const ctx = document.createElement('canvas').getContext('2d');
      if (!priceEl || !ctx) return;
      const cs = getComputedStyle(priceEl);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
      const m = ctx.measureText(SHELF_HEADER.price.text);
      // actualBoundingBoxLeft runs leftward from the origin, so a run that
      // starts right of its origin — every run in this face — reports it negative
      priceRef.current = {
        em: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 100,
        asc: m.actualBoundingBoxAscent / 100,
        desc: m.actualBoundingBoxDescent / 100,
        lsb: -m.actualBoundingBoxLeft / 100,
      };
      applyRef.current();
    };
    document.fonts.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, []);

  const first = shelfFit(DESIGN_WIDTH, SHELF_HEADER.price.table, topPackWidth, rowWidth, bodyWidth);

  return (
    <div
      ref={ref}
      className="shelf-stage"
      data-fit={first.mode}
      style={
        {
          minHeight: minHeightFor(first),
          '--aligned-right': `${DESIGN_ALIGNED_RIGHT}px`,
          '--shelf-margin': `${SHELF_MARGIN}px`,
          ...fitVars(first, pitch, rowWidth, SHELF_HEADER.price.table),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
