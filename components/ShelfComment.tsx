'use client';

import { useLayoutEffect, useRef, useState, useTransition } from 'react';
import { setPackNoteAction } from '@/app/actions';
import { CARD_COMMENT, EDITOR, NOTE_MAX } from '@/lib/shelfGrid';

/**
 * THE LARGER TEXT EDITOR (the owner's 2026-09-22, which is the construction
 * they said they would specify once the square was a button).
 *
 * "the text editor button should move to align its left edge with the left
 * edge of the cig image outline and a rectangle that is white with the same
 * opacity as the outline of the cig images should appear with the dashed
 * lines turned white and the bottom one should disappear and the vertical one
 * should be 10px away from the edge of the rectangle on all edges in the top
 * left corner. Have the text 'leave a comment <3' in all lowercase be written
 * at 25% opacity in white as well. Have a sigil with the red with black fill
 * coloring 10 px away from the edge of the previously mentioned text have it
 * scaled to be the same height as the vertical dashed line. have the sigil be
 * solid until the user interacts with the editor then have the sigil blink
 * and have the edge with the tip be aligned vertically with where the users
 * typed text will appear from. have the typed text begin 10 px away from the
 * vertical dashed line and make it the same height as the line."
 *
 * TEN PIXELS, FOUR TIMES, AND IT IS THE SAME TEN. The rule stands 10 inside
 * the rectangle on the left, the top and the foot — so the rectangle's height
 * is the rule's plus twenty, which is how "10px away from the edge on all
 * edges" can be true of a mark in a corner. The run begins 10 past the rule
 * and the ☁ waits 10 past the prompt.
 *
 * THE MARKS MOVED OUT OF THE SQUARE RATHER THAN BEING DRAWN AGAIN. The owner
 * placed the vertical rule against THE RECTANGLE, so there is one of it, and
 * the button it came from is its outline alone while the editor is open —
 * the same thing the cloud star does when it stands down for the sigils.
 *
 * THE ☁ IS THE CARET AND THE SUBMIT BUTTON, which is the login box's own
 * arrangement and the search bar's: it stands where the next letter will go,
 * it blinks while the field has the caret, and pressing it sends. Its TIP —
 * the tail, the point the site's own cursor is hotspotted on — is its left
 * edge, which is what "the edge with the tip aligned … with where the users
 * typed text will appear from" names.
 *
 * WHILE THE PROMPT IS SHOWING, THE PROMPT IS STANDING WHERE THE TEXT WILL GO,
 * so the ☁ waits one prompt and one gap past it and slides back to the first
 * letter's place when the reader arrives. It is the word that gives way,
 * never the mark — the login row's rule, said again.
 *
 * NOTHING IS FOCUSED WHEN IT OPENS, deliberately: "when the user clicks into
 * the text editor" is a second act after the press that opened it, and the
 * prompt is there to be read in between.
 */

/** How long a refused save floods the rectangle — the login box's own. */
const REJECT_MS = 500;

export function ShelfComment({
  packId,
  name,
  note,
  open,
  button,
  onSaved,
}: {
  packId: string;
  name: string;
  /** what the database holds for this reader and this pack, '' for nothing */
  note: string;
  /** whether the text editor button is latched open */
  open: boolean;
  button: number;
  /** told when a comment has actually been stored, so the editor can shut */
  onSaved?: (note: string) => void;
}) {
  const [text, setText] = useState(note);
  const [live, setLive] = useState(false);
  const [refused, setRefused] = useState(false);
  const [, start] = useTransition();

  const field = useRef<HTMLInputElement | null>(null);
  const prompt = useRef<HTMLSpanElement | null>(null);
  const mirror = useRef<HTMLElement | null>(null);
  /** bumped when the field scrolls, which moves the mark without changing it */
  const [scrolled, setScrolled] = useState(0);
  /** how far the ☁ stands from where the run begins, in px */
  const [caret, setCaret] = useState(0);

  const showing = !live && !text;

  /**
   * WHERE THE ☁ STANDS, measured rather than computed from a font string.
   *
   * Two cases, and they are the ask's own two: with the prompt showing it
   * waits a prompt and a gap past the start, and once the reader is in the
   * field it stands at the end of what has been typed. The run is measured
   * off a MIRROR — a hidden copy of the value set in the field's own font,
   * so there is no font string to assemble and get wrong — and the field's
   * `scrollLeft` is taken off it, which is what keeps the mark with the text
   * rather than running off the end of a field that has begun to scroll.
   */
  useLayoutEffect(() => {
    if (!open) return;
    if (showing) {
      setCaret((prompt.current?.getBoundingClientRect().width ?? 0) + EDITOR.pad);
      return;
    }
    const run = mirror.current?.getBoundingClientRect().width ?? 0;
    const el = field.current;
    const room = el?.clientWidth ?? 0;
    setCaret(Math.max(0, Math.min(run - (el?.scrollLeft ?? 0), room)));
  }, [open, showing, text, scrolled, button]);

  const send = () => {
    const out = text.trim().slice(0, NOTE_MAX);
    start(async () => {
      const answer = await setPackNoteAction(packId, out);
      if (answer.note === null) {
        /*
         * IT KEEPS WHAT WAS TYPED. The search bar deletes a query that found
         * nothing because there is nothing there worth keeping; a comment is
         * the reader's own writing, and throwing it away on a failed save
         * would be the worst thing this control could do. The rectangle
         * floods red instead — the login box's own rejection.
         */
        setRefused(true);
        window.setTimeout(() => setRefused(false), REJECT_MS);
        return;
      }
      setText(answer.note);
      onSaved?.(answer.note);
    });
  };

  return (
    <form
      className="shelf-comment"
      data-open={open ? '' : undefined}
      data-refused={refused ? '' : undefined}
      /* shut, it is not there at all: out of the tab order, out of the
         accessibility tree and taking no pointer, as every shut menu on
         this site is */
      inert={!open}
      style={{ '--btn': `${button}px` } as React.CSSProperties}
      onSubmit={(e) => { e.preventDefault(); send(); }}
    >
      {/* THE VERTICAL DASHED RULE, white now and standing in the corner. It
          is the login box's own sprite at the scale the square set it, so
          the dashes are the same dashes; only its colour and its place have
          changed. */}
      <i className="shelf-comment-caret" aria-hidden />

      {/* the prompt, in the owner's own words and their own lower case */}
      <span
        className="shelf-comment-prompt"
        ref={prompt}
        aria-hidden
        data-gone={showing ? undefined : ''}
      >
        {CARD_COMMENT.toLowerCase()}
      </span>

      <input
        ref={field}
        className="shelf-comment-field"
        type="text"
        value={text}
        maxLength={NOTE_MAX}
        aria-label={`Leave a comment on ${name}`}
        autoComplete="off"
        onFocus={() => setLive(true)}
        onBlur={() => setLive(false)}
        onChange={(e) => setText(e.target.value)}
        onScroll={() => setScrolled((n) => n + 1)}
      />

      {/* the run again, hidden, so the ☁ can be put at the end of it */}
      <i className="shelf-comment-mirror" ref={mirror} aria-hidden>{text}</i>

      {/* THE ☁: the caret, and the send. Solid at three quarters until the
          reader is in the field, then full and blinking. */}
      <button
        type="submit"
        className="shelf-comment-send"
        style={{ '--caret-x': `${caret.toFixed(2)}px` } as React.CSSProperties}
        data-live={live ? '' : undefined}
        aria-label={`Save your comment on ${name}`}
      >
        <i aria-hidden />
      </button>
    </form>
  );
}
