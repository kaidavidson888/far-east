'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { togglePackAction } from '@/app/actions';
import { cardAmount, cardQuantityFrame, type ShelfEntry } from '@/lib/shelfGrid';
import { CigQuantity } from './CigQuantity';
import { ShelfClouds } from './ShelfClouds';
import { ShelfComment } from './ShelfComment';
import { ShelfRating } from './ShelfRating';

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
/** Which of the pack's two menus is out; one at a time, and never two. */
type Menu = 'rating' | 'editor' | null;

/**
 * HOW LONG EACH ONE TAKES TO LEAVE once it has been told to, which is what
 * the next has to wait for — the landing row's `MENU_EXIT_MS`, for the
 * owner's "a menu will close itself before a new one can open".
 *
 * THEY ARE NOT THE SAME, because the two menus do not leave the same way.
 * The rating's sigils fade while the cloud star SLIDES back to the middle
 * of the pack, and the slide is the longer of the two — the tag menu's own
 * 380. The editor has nothing that slides since the owner had its square
 * disappear rather than stand aside: the rectangle fades out and the square
 * fades back in AFTER it, one behind the other, so it costs two fades.
 *
 * Every figure is the one the stylesheet animates by. A second copy would
 * drift, and the drift would show as exactly the overlap this rule exists
 * to prevent.
 */
const SLIDE_MS = 380;
const FADE_MS = 160;
const MENU_EXIT_MS: Record<Exclude<Menu, null>, number> = {
  rating: SLIDE_MS,
  editor: FADE_MS * 2,
};

export function ShelfWheelControls({
  entry: { pack, amount, unit, rating, note },
  bookmark,
  button,
  packRef,
  starTop,
}: {
  entry: ShelfEntry;
  bookmark: { mark: { width: number; height: number }; d: string };
  button: number;
  /** how far under the pack's image the star's own line falls */
  starTop: number;
  /** the pack's own element: the wheels open at the width of its outline */
  packRef: React.RefObject<HTMLElement | null>;
}) {
  const [saved, setSaved] = useState(true);
  /**
   * ONE MENU AT A TIME, AND THE NEXT WAITS FOR THE LAST TO GO — the landing
   * row's rule, which the owner asked for here too ("Have the same
   * parameters as the landing page button triangle where a menu will close
   * itself before a new one can open"). `request` below is `CigScroller`'s,
   * ported rather than reinvented, and the reason it is ONE piece of state
   * is the same: two booleans can both be true however carefully the code is
   * written, and this pair cannot.
   *
   * IT RESETS WITH THE PACK, because these controls only exist while the
   * wheel is at rest on one and are unmounted the moment it moves — so a
   * menu cannot be left standing beside a pack it was not opened on.
   */
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const ratingOpen = openMenu === 'rating';
  const noteOpen = openMenu === 'editor';
  /** What is still on its way out, and what is to follow it. */
  const leavingRef = useRef<Menu>(null);
  const nextRef = useRef<Menu>(null);
  const waitRef = useRef(0);
  useEffect(() => () => window.clearTimeout(waitRef.current), []);

  const request = useCallback((next: Menu) => {
    // Asked back while it is still leaving: turn it around at once rather
    // than waiting for it to finish going. Every part of both menus is a
    // transition that reverses from wherever it has reached, so this reads
    // as one movement — and a reader pressing the same button twice means it.
    if (next !== null && next === leavingRef.current) {
      window.clearTimeout(waitRef.current);
      leavingRef.current = null;
      nextRef.current = null;
      setOpenMenu(next);
      return;
    }
    // Something is already on its way out: whatever is asked for now goes
    // after it, replacing anything queued. The wait is NOT restarted — the
    // one that is leaving has been leaving all this time.
    if (leavingRef.current) {
      nextRef.current = next;
      return;
    }
    if (openMenu === next) return;
    if (openMenu === null) {
      setOpenMenu(next);
      return;
    }
    // close what is out and hold the next until it has gone. The timer is set
    // HERE and not inside the updater: React may run an updater twice, and it
    // is not the place for a side effect.
    leavingRef.current = openMenu;
    nextRef.current = next;
    setOpenMenu(null);
    window.clearTimeout(waitRef.current);
    waitRef.current = window.setTimeout(() => {
      leavingRef.current = null;
      const queued = nextRef.current;
      nextRef.current = null;
      if (queued) setOpenMenu(queued);
    }, MENU_EXIT_MS[openMenu]);
  }, [openMenu]);

  /**
   * CLOSING "ME", NOT "WHATEVER IS OPEN". A save is in flight across a
   * round trip, and the reader can press the cloud star while it is: by the
   * time the editor's `onClose` runs, the rating may be the menu that is
   * out, and a plain `request(null)` — captured, with a `request` frozen at
   * the render where the editor was open — would shut the sigils the reader
   * had just asked for. Both the current state and the current `request`
   * are read off refs, so this closes the editor only if the editor is
   * still what is open.
   */
  const openRef = useRef<Menu>(openMenu);
  openRef.current = openMenu;
  const requestRef = useRef(request);
  requestRef.current = request;
  const closeEditor = useCallback(() => {
    if (openRef.current === 'editor') requestRef.current(null);
  }, []);

  /**
   * WHETHER THE STAR HAS FINISHED STANDING DOWN. "After moving its opacity
   * should be 25%" is a sequence, and a sequence is a second state rather
   * than a `transition-delay` — a delay belongs to the destination of a
   * transition, so it also made LEAVING the hover wait 380ms and left the
   * button glowing behind the pointer.
   */
  const [stood, setStood] = useState(false);
  useEffect(() => {
    if (!ratingOpen) { setStood(false); return undefined; }
    const t = window.setTimeout(() => setStood(true), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [ratingOpen]);

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
      {/*
        THE THREE ARE THE LANDING PAGE'S TRIANGLE NOW (the owner's
        2026-09-21: "move the star button down and aligned with the middle of
        the cig image so it is the same as the triangle of buttons on the
        landing page"). Its glass and dots share an upper line with the plus
        centred below them, and that is what this is — the editor and the
        favourite above, the clouds centred on the pack's own axis below.

        It would not fit when the three first went in: two lines of these
        squares cannot live in a 35px gap, which is what the gap was then.
        Half-size neighbours pushed the packs apart, and there is room now.

        THE OUTER TWO HAVE NOT MOVED. They stand where the first and third of
        the row stood, so the gap between them is the three slots the row had
        less their own width — 3 x the button.
      */}
      <div
        className="shelf-wheel-row"
        /* THE EDITOR COVERS THIS WHOLE LINE once it is open — it runs edge
           to edge of the pack's outline now — so the two controls under it
           go out of reach rather than staying tabbable behind a black
           rectangle. The editor's own square is hidden there anyway. */
        inert={noteOpen}
        data-shut={noteOpen ? '' : undefined}
        style={{ '--btn': `${button}px` } as React.CSSProperties}
      >
        {/* THE TEXT EDITOR'S SQUARE. Shut, it carries the two marks that
            make a row of the login box: the vertical dashed rule and the
            horizontal one the letters sit on, standing the same margin off
            the box and aligned on their bottom edges — and the bottom one
            BLINKS under the pointer (the owner's 2026-09-22).

            Open, it stands down to the outline's left edge as the cloud
            star does and is its outline alone: its marks have gone into the
            rectangle, where the owner placed them. */}
        <button
          type="button"
          className="shelf-wheel-btn shelf-wheel-note"
          data-open={noteOpen ? '' : undefined}
          aria-expanded={noteOpen}
          aria-label={noteOpen
            ? `Close the comment on ${pack.name}`
            : `Leave a comment on ${pack.name}`}
          onClick={() => request(noteOpen ? null : 'editor')}
        >
          <i className="shelf-wheel-caret" aria-hidden />
          <i className="shelf-wheel-underline" aria-hidden />
        </button>

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
      </div>

      {/*
        THE STAR, on the pack's own axis and a line below the pair — until it
        is pressed. Then it STANDS DOWN TO THE LEFT (the owner's 2026-09-22:
        "have the button keep its outline and move to have its left edge
        aligned with the cig image outlines left edge after moving its
        opacity should be 25%"), which clears the line for the five sigils.

        THE QUARTER STRENGTH IS ON THE ELEMENT, and it is the one place on
        this page where that is right. Everywhere else the opacity is in a
        colour, so that a line going faint does not take its mark with it —
        here it is the whole control receding, outline and clouds together,
        because it has handed the line over to the row it just opened.
      */}
      <div
        className="shelf-wheel-star"
        data-open={ratingOpen ? '' : undefined}
        data-stood={stood ? '' : undefined}
        style={{ '--btn': `${button}px`, '--star-top': `${starTop.toFixed(2)}px` } as React.CSSProperties}
      >
        <ShelfClouds
          label={`Rate ${pack.name}`}
          className="shelf-wheel-btn"
          open={ratingOpen}
          onPress={(want) => request(want ? 'rating' : null)}
        />
      </div>

      {/* the text editor the square opens into, on the square's own line */}
      <ShelfComment
        packId={pack.id}
        name={pack.name}
        note={note}
        open={noteOpen}
        button={button}
        onClose={closeEditor}
      />

      {/* the five sigils, filling the run from the stood-down star's right
          edge to the pack outline's right edge */}
      <ShelfRating
        packId={pack.id}
        name={pack.name}
        rating={rating}
        open={ratingOpen}
        button={button}
        starTop={starTop}
      />

      {/* the number, centred on the pack, one margin off its right edge */}
      <div className="shelf-wheel-amount" style={{ '--btn': `${button}px` } as React.CSSProperties}>
        <span ref={countRef} className="shelf-wheel-btn shelf-wheel-count">
          {/* A PACK WITH NO AMOUNT SET READS 0 (the owner's 2026-09-21), not
              an empty box: the shelf holds it, so the honest answer to "how
              many" is none rather than nothing. */}
          <span aria-hidden>{says ?? 0}</span>
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
