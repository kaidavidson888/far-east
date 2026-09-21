'use client';

import { useEffect, useRef, useState } from 'react';
import { CARD_COMMENT } from '@/lib/shelfGrid';

/**
 * THE COMMENT BAR, WHICH IS NOW A BUTTON YOU CAN TYPE IN.
 *
 * The owner's 2026-09-21, in their words: "For the leave a comment bar make
 * it into a button after the previous steps and make it so the text is only
 * visible on user hover. by default have a vertical dashed line like in the
 * login bar that is the same height as the cloud star with the same margins
 * that the L in the text currently has with the left edge of the rectangle.
 * have it start at 50% opacity and be black. On user hover or click have it
 * turn white on click turn it 100% opacity and have it start to blink[.] have
 * the users typed text start to the left of the dashed line with the same
 * margin between them the line has with the rectangle[,] and make the typed
 * text the same height as the line".
 *
 * So the bar has three states and one mark:
 *
 *   AT REST   a solid red bar with the dashed rule alone, black at half
 *             strength, standing where the L of the phrase used to.
 *   HOVERED   the bar fills black (the page's one hover rule), the phrase
 *             appears in white, and the rule goes white.
 *   TYPING    the rule is white at full strength and blinks, the phrase steps
 *             aside, and what is typed runs from the same left margin with
 *             the rule kept one margin past its end.
 *
 * THE RULE IS A CARET AND THE TEXT IS WHAT MOVES IT. The run is measured on a
 * canvas in the field's own font — the search bar's way, `measureText`, since
 * all that is wanted here is the pen position. (The login row measures each
 * letter's ink instead, because it also cuts a piece of dash under every
 * letter; there is no such line here.)
 *
 * NOTHING IS SAVED YET, AND THAT IS NOT AN OVERSIGHT: `pack_favorites` has no
 * column to keep a note in, so persisting this needs a migration and the
 * owner applying it. The typing is real, the text lives as long as the page
 * does, and the field says as much to a screen reader.
 */
export function ShelfCardComment({ name }: { name: string }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const runRef = useRef<HTMLSpanElement | null>(null);

  // WHERE THE RULE STANDS: one margin past the end of the run, and at the
  // start when there is nothing. Measured on a canvas with the field's own
  // computed font, so it follows a resize and a font swap without a guess.
  useEffect(() => {
    const el = runRef.current;
    if (!el) return;
    if (!text) { setCaret(0); return; }
    const cs = getComputedStyle(el);
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return;
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    setCaret(c.measureText(text).width);
  }, [text, open]);

  return (
    <div
      className="shelf-card-comment"
      data-open={open ? '' : undefined}
      data-typed={text ? '' : undefined}
      style={{ '--run': `${caret.toFixed(2)}px` } as React.CSSProperties}
    >
      {/* The field is the control and it is the whole bar. It carries no
          visible text of its own — the caret and the run below are drawn —
          because a real input cannot be given a hand-drawn caret. */}
      <input
        ref={fieldRef}
        className="shelf-card-comment-field"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Leave a comment on ${name} (not saved yet)`}
        autoComplete="off"
        spellCheck={false}
      />
      {/* the drawing's own words, shown only under the pointer and only while
          there is nothing typed to show instead */}
      <span className="shelf-card-comment-say" aria-hidden>{CARD_COMMENT}</span>
      {/* what has been typed, at the caret's own height */}
      <span className="shelf-card-comment-run" ref={runRef} aria-hidden>{text}</span>
      {/* THE RULE. Keyed on the text so the blink restarts solid on every
          keystroke, which is what a real caret does — the search bar's and
          the login row's own trick, and the same keyframe. Where it stands
          is the stylesheet's, off `--run`: one margin from the rectangle
          with nothing typed, and one margin past the run once there is. */}
      <span className="shelf-card-comment-caret" aria-hidden>
        <i key={text} data-blink={open ? '' : undefined} />
      </span>
    </div>
  );
}
