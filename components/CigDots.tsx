'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import geometry from '@/lib/dotsmenu-geometry.json';
import { DOTS_GLYPH } from '@/lib/dotsGlyph';
import { useFrameScrub } from '@/lib/useFrameScrub';

/**
 * THE DOTS: three of the owner's spirals in a box the plus's size, and the
 * three words that used to hang under the mountain — the owner's 2026-09-20
 * ask, "another button within a box outline mirrored from the magnifying
 * glass button … on press the dots will turn 90 degrees so they are
 * horizontal then grow into the saved, offers and recommended buttons".
 *
 * It is the glass's twin: placed by `layoutMenu` in CigScroller on the other
 * side of the plus, on the same line, in the same box, at the same scale, and
 * built the same way — an outer box in screen px, an inner one carrying the
 * zoom. What comes out of it is the grow menu's own machinery: frames baked
 * by `npm run build:dotsmenu`, scrubbed on a canvas by the shared
 * `useFrameScrub`, ink branching out of the button's outline and writing
 * SAVED, OFFERS and RECOMMENDED as it reaches them.
 *
 * THREE THINGS ARE ITS OWN:
 *
 * THE MARK TURNS. The dots are drawn as a column and stored as a row (see
 * lib/dotsGlyph.ts), so the button stands them upright with a quarter turn at
 * rest and drops it on press. It turns over the length of the unfolding, so
 * the turn and the growth read as one movement.
 *
 * IT GROWS TO THE APEX AND THEN THE CONNECTOR WINDS BACK IN. 124 frames: 100
 * of growth, ending with the three words written and every branch at full
 * reach, then 24 in which the REACH — the branch that ties all this to the
 * button — and everything sprouted off it withdraw into the outline, leaving
 * the spine down the left, the three feeders and the words standing. That
 * last frame is the resting state (the owner's "leave the other branches
 * connected to the words and the one on the left"), and coming back is the
 * whole run in reverse at the scrub's own 2x.
 *
 * ONLY TWO THINGS CLOSE IT — pressing the dots again, or another menu opening
 * beside it. A hand on the row does NOT, which is where it parts company with
 * the tag menu and the search: the owner named those two and no others.
 */
const FRAMES = geometry.frames;
const VIEW = geometry.frame;
const HIT = geometry.logoHit;

/**
 * How far the drawing reaches to the LEFT of the button's own left edge, in
 * the menu's design px — which is where all of it is now. `REACH` is the
 * canvas's edge, which `layoutMenu` keeps on the page.
 */
export const DOTS_REACH = HIT.x;

type DotsBox = {
  id: string;
  label: string;
  part?: string;
  inert?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};
const BOXES = geometry.boxes as DotsBox[];

/**
 * …and how far the WORDS reach that way: 196 design px against the ink's 218,
 * the difference being the spine and its curls. Nothing reads it today — the
 * glass keeps its place under them, by the owner's word — but it is the
 * measure anything that has to reason about where the lettering lands wants,
 * and it is one line from the geometry rather than a number to be rediscovered.
 */
export const DOTS_WORDS = HIT.x - Math.min(...BOXES.map((b) => b.x));

/**
 * How far the drawing reaches above and below the line the ink leaves the
 * button on (its middle), which is what it is scaled about. The taller of the
 * two is what has to fit between the red frame's foot and the plus's top —
 * see `dotsDraw` in CigScroller.
 */
export const DOTS_RISE = Math.max(HIT.y + HIT.h / 2, VIEW.h - HIT.y - HIT.h / 2);

const src = (i: number) => `${geometry.dir}/f${String(i).padStart(3, '0')}.webp`;

/** Half strength under the pointer, a quarter while it is held — the grow menu's own. */
const DIM = 0.5;
const HELD = 0.25;

export function CigDots({
  open,
  place,
  slides,
  onOpenChange,
}: {
  open: boolean;
  /**
   * Where the box goes, in screen px, the scale it is drawn at, and `draw` —
   * how much of that scale the DRAWING takes. The button is always the plus's
   * size (it is the plus's mirror), but the words hang three lines deep off a
   * line with the red frame close above and the plus's line close below, and
   * they scale with the framed pack: at the widest pack in the catalogue they
   * are twice the size they are at the narrowest and run into both. `draw` is
   * the room there is, measured by `layoutMenu`, and it is 1 for nine packs
   * in ten.
   */
  place: { left: number; top: number; s: number; draw: number } | null;
  /** whether its moves are animated yet — see `menuSlides` in CigScroller */
  slides: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /**
   * WHICH WORD THE POINTER IS ON, IN A REF AS WELL AS IN STATE. `decorate` is
   * handed to the scrub and must not change identity on a hover — every one
   * of the hook's callbacks hangs off it — so it reads the ref, and the state
   * is only what asks for the repaint.
   */
  const [on, setOn] = useState<string | null>(null);
  /**
   * HELD IS ITS OWN PIECE OF STATE, and that is not tidiness. Chrome focuses
   * a button on pointerdown, so `onFocus` fires immediately after — and while
   * the two were one object, focusing put `held` back to false in the same
   * breath as the press set it, and the word never reached its quarter
   * strength. Focus says WHICH word; the pointer says whether it is down.
   */
  const [held, setHeld] = useState(false);
  const touchedRef = useRef<{ id: string | null; held: boolean }>({ id: on, held });
  touchedRef.current = { id: on, held };

  /**
   * THE DIM IS CUT OUT OF THE FRAME, NOT PAINTED OVER IT.
   *
   * The grow menu clears a word's rect and draws the frame back into it at
   * half alpha. The same answer is one operation here: `destination-out` at
   * 0.5 takes half the coverage off everything in that rect, so the ink comes
   * out at half strength and the paper around it stays transparent — which it
   * must, because this canvas lies over the moving row and a white scrim
   * would put an opaque box on top of the packs. Nothing is baked, so the two
   * states cannot drift apart.
   */
  const decorate = useCallback((ctx: CanvasRenderingContext2D) => {
    const touched = touchedRef.current;
    const box = BOXES.find((b) => b.id === touched.id);
    if (!box) return;
    const k = VIEW.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${1 - (touched.held ? HELD : DIM)})`;
    ctx.fillRect(box.x * k, box.y * k, box.w * k, box.h * k);
    ctx.restore();
  }, []);

  const { canvasRef, phase, enter, retract, paint } = useFrameScrub({
    frames: FRAMES,
    frameMs: geometry.frameMs,
    src,
    preload: true,
    decorate,
  });

  // the page owns whether it is out; the scrub is told which way to run
  const was = useRef(open);
  useEffect(() => {
    if (was.current === open) return;
    was.current = open;
    if (open) enter();
    else retract();
  }, [enter, open, retract]);

  // a hover is a repaint of the frame it is already on
  useEffect(() => {
    paint();
  }, [held, on, paint]);

  const press = useCallback(() => onOpenChange(!open), [onOpenChange, open]);
  const g = DOTS_GLYPH;
  /*
   * THE DRAWING IS SCALED ABOUT THE BUTTON'S LEFT EDGE AT ITS MIDDLE — the
   * point the ink leaves from, so that wherever `draw` lands the first stroke
   * still comes out of the same place on the button. `mid` takes a y in the
   * canvas's own px and gives it in the button's, with that point fixed.
   */
  const draw = place?.draw ?? 1;
  const mid = (y: number) => (y - HIT.y - HIT.h / 2) * draw + HIT.h / 2;

  return (
    <div
      className="cig-dots"
      data-open={open ? '' : undefined}
      data-shut={phase === 'idle' ? '' : undefined}
      data-placed={place ? '' : undefined}
      data-slides={slides ? '' : undefined}
      style={
        place
          ? ({ left: `${place.left}px`, top: `${place.top}px`, '--cig-menu-zoom': place.s } as React.CSSProperties)
          : undefined
      }
    >
      <div className="cig-dots-scale">
        {/* The canvas carries the words and the ink that writes them. The
            button stands on it at `logoHit`, so the canvas begins that far
            above and to the left of the button's own corner. */}
        <canvas
          ref={canvasRef}
          className="cig-dots-canvas"
          width={VIEW.w * VIEW.scale}
          height={VIEW.h * VIEW.scale}
          style={{
            left: `${+(-HIT.x * draw).toFixed(2)}px`,
            top: `${+mid(0).toFixed(2)}px`,
            width: `${+(VIEW.w * draw).toFixed(2)}px`,
            height: `${+(VIEW.h * draw).toFixed(2)}px`,
          }}
          aria-hidden="true"
        />

        <button
          type="button"
          className="cig-dots-toggle"
          aria-expanded={open}
          aria-label={open ? 'Close the shelf menu' : 'Saved, offers and recommended'}
          onClick={press}
          onKeyDown={(e) => {
            if (open && e.key === 'Escape') {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
        >
          <span className="cig-dots-mark" aria-hidden="true">
            <svg viewBox={g.viewBox} width={g.width} height={g.height} focusable="false">
              <path d={g.d} fill="currentColor" fillRule={g.fillRule} />
            </svg>
          </span>
        </button>

        {/* THE WORDS, each a real control over the canvas's own drawing of it,
            at the box the bake measured. `inert` while the menu is shut: an
            invisible button that can still be pressed or tabbed to is the
            trap the bar and the tag grid were both fixed for. */}
        <div className="cig-dots-words" inert={!open}>
          {BOXES.map((b) => (
            <button
              key={b.id}
              type="button"
              className="cig-dots-box"
              // `saved` is the attribute this word carried under the mountain,
              // so CigScroller's capture-phase listener spins the row for it
              // with no change at all. OFFERS and RECOMMENDED are drawn,
              // hoverable and going nowhere, as they have always been — and
              // NOT `disabled`, which would stop them answering the pointer.
              data-part={b.part}
              data-inert={b.inert ? '' : undefined}
              aria-label={b.label}
              style={{
                left: `${+((b.x - HIT.x) * draw).toFixed(2)}px`,
                top: `${+mid(b.y).toFixed(2)}px`,
                width: `${+(b.w * draw).toFixed(2)}px`,
                height: `${+(b.h * draw).toFixed(2)}px`,
              }}
              onPointerEnter={() => setOn(b.id)}
              onPointerDown={() => {
                setOn(b.id);
                setHeld(true);
              }}
              onPointerUp={() => setHeld(false)}
              onPointerLeave={() => {
                setOn((was) => (was === b.id ? null : was));
                setHeld(false);
              }}
              onPointerCancel={() => setHeld(false)}
              onFocus={() => setOn(b.id)}
              onBlur={() => {
                setOn((was) => (was === b.id ? null : was));
                setHeld(false);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
