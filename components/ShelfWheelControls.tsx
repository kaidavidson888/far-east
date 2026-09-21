'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { togglePackAction } from '@/app/actions';
import { cardAmount, cardQuantityFrame, type ShelfEntry } from '@/lib/shelfGrid';
import { CigQuantity } from './CigQuantity';
import { ShelfClouds } from './ShelfClouds';

/**
 * WHAT STANDS UNDER THE PACK THE WHEEL HAS STOPPED ON.
 *
 * The owner's 2026-09-21: "Make the bottom 2 buttons and the favorite button
 * appear under the selected pack in the wheel after it fully stops spinning
 * … Have the three on this pack be equidistant vertically between the
 * selected pack and the pack half appeared on the bottom. Have the number
 * selector appear on the right of the selected pack after it fully stops
 * spinning with an equal margin between its left edge and the pack outline
 * to the top edge of the grouping of the other 3 buttons and the bottom edge
 * of the pack outline."
 *
 * So there is ONE margin and it does two jobs: the three stand a margin under
 * the pack and a margin above the next, which is what keeps them equidistant,
 * and the number square stands that same margin off the pack's right edge.
 * It is `WHEEL_MARGIN` — the drawing's own 35 — and the PACK is what gives to
 * make room for it, since the pitch is fixed at half the screen.
 *
 * ONE ROW OF THREE. The landing page's three are an inverted triangle — the
 * glass and the dots on an upper line with the plus centred below, about
 * 100px from top to bottom — and two lines of mountain-button-sized squares
 * cannot fit a 35px gap. Asked, the owner chose the row, which keeps the
 * button's size and the equidistant rule exactly.
 *
 * THE FAVOURITE STARTS PRESSED ("start the favorited button in its pressed
 * version because the pack is already selected"). Every pack on this wheel
 * is on the shelf, so the bookmark's resting state here is the saved one;
 * pressing it takes the pack off and pressing again puts it back.
 *
 * THE COMMENT SQUARE IS A BUTTON AND NOTHING ELSE YET. The owner: "the text
 * editor square will act as a button to open a larger text editor but i will
 * give instructions on that construction after u are done". So it carries
 * the dashed rule and takes a press; what it opens comes next.
 */
export function ShelfWheelControls({
  entry: { pack, amount, unit },
  bookmark,
  button,
  packRef,
}: {
  entry: ShelfEntry;
  bookmark: { mark: { width: number; height: number }; d: string };
  button: number;
  /** the pack's own element: the wheels open at the width of its outline */
  packRef: React.RefObject<HTMLElement | null>;
}) {
  const [saved, setSaved] = useState(true);
  const countRef = useRef<HTMLSpanElement | null>(null);
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);

  // THE WHEELS STILL OPEN OUT OF THE NUMBER, at the pack outline's width and
  // out of its own top-left corner — the owner's earlier ask, which this
  // redraw did not retract. The width has to be measured: a pack is sized by
  // its height, so how wide its outline comes out is that pack's own.
  useEffect(() => {
    const el = packRef.current;
    const box = countRef.current;
    if (!el || !box) return undefined;
    const read = () => {
      const p = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (!p.width || !b.width) return;
      const rule = parseFloat(getComputedStyle(el).getPropertyValue('--pack-rule')) || 0;
      // it opens rightward from a box that already stands right of the pack,
      // so it is held to the room actually left on the page
      const right = window.innerWidth - b.left - 10;
      setRoom((was) => {
        const next = { w: Math.min(p.width + rule * 2, right), h: p.height };
        return was && Math.abs(was.w - next.w) < 0.5 && Math.abs(was.h - next.h) < 0.5 ? was : next;
      });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    ro.observe(box);
    return () => ro.disconnect();
  }, [packRef]);

  const frame = useMemo(
    () => (room ? cardQuantityFrame(room.w, { w: button, h: button }, room.h) : null),
    [room, button],
  );

  const says = cardAmount(amount, unit);
  const unitWord = unit === 'C' ? 'carton' : 'pack';
  const has = amount && unit ? `${amount} ${unitWord}${amount === 1 ? '' : 's'}` : null;

  return (
    <>
      {/* the three, in the gap under the pack */}
      <div className="shelf-wheel-row" style={{ '--btn': `${button}px` } as React.CSSProperties}>
        <ShelfClouds label={`Open the clouds on ${pack.name}`} className="shelf-wheel-btn" />

        <form action={togglePackAction} className="shelf-wheel-form">
          <input type="hidden" name="pack" value={pack.id} />
          <button
            type="submit"
            className="shelf-wheel-btn shelf-wheel-mark"
            data-saved={saved ? '' : undefined}
            aria-pressed={saved}
            aria-label={saved
              ? `Take ${pack.name} off the shelf`
              : `Put ${pack.name} back on the shelf`}
            onClick={() => setSaved((v) => !v)}
          >
            <svg
              viewBox={`0 0 ${bookmark.mark.width} ${bookmark.mark.height}`}
              aria-hidden="true"
              focusable="false"
              preserveAspectRatio="xMidYMid meet"
            >
              <path d={bookmark.d} fill="currentColor" />
            </svg>
          </button>
        </form>

        <button
          type="button"
          className="shelf-wheel-btn shelf-wheel-note"
          aria-label={`Leave a comment on ${pack.name}`}
        >
          {/* the login box's own dashed rule, kept where it stood relative to
              the left edge when this was a bar */}
          <i className="shelf-wheel-caret" aria-hidden />
        </button>
      </div>

      {/* the number, centred on the pack, one margin off its right edge */}
      <div className="shelf-wheel-amount" style={{ '--btn': `${button}px` } as React.CSSProperties}>
        <span ref={countRef} className="shelf-wheel-btn shelf-wheel-count">
          <span aria-hidden>{says ?? ''}</span>
          <span className="sr-only">
            {has ? `${pack.name}: ${has}, ${says} in packs` : `${pack.name}: no amount set`}
          </span>
        </span>
        {frame ? (
          <CigQuantity id={pack.id} name={pack.name} amount={amount} unit={unit} frame={frame} />
        ) : null}
      </div>
    </>
  );
}
