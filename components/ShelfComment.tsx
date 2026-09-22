'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { setPackNoteAction } from '@/app/actions';
import { CARD_COMMENT, EDITOR, NOTE_MAX } from '@/lib/shelfGrid';

/**
 * THE LARGER TEXT EDITOR (the owner's 2026-09-22, in two asks).
 *
 * "the text editor button should move to align its left edge with the left
 * edge of the cig image outline and a rectangle that is white with the same
 * opacity as the outline of the cig images should appear with the dashed
 * lines turned white and the bottom one should disappear and the vertical one
 * should be 10px away from the edge of the rectangle on all edges in the top
 * left corner. Have the text 'leave a comment <3' in all lowercase be written
 * at 25% opacity in white as well. Have a sigil … 10 px away from the edge of
 * the previously mentioned text … scaled to be the same height as the
 * vertical dashed line … have the typed text begin 10 px away from the
 * vertical dashed line and make it the same height as the line."
 *
 * Then: "when the text editor opens have the original outline button
 * disappear and have the text editor fit between both edges of the cig image
 * outline. Make sure the typed text bottom edge is aligned with the bottom
 * edge of the dashed line. make the rectangle expand by a row as a new row of
 * text is written. Max character cap on comment is 150 characters."
 *
 * TEN PIXELS, FOUR TIMES, AND IT IS THE SAME TEN: the vertical rule stands 10
 * inside the rectangle on the left, the top and the foot — which is what sets
 * the box's height at ONE row — the run begins 10 past the rule, and the ☁
 * waits 10 past the prompt.
 *
 * THE TYPE SITS ON THE RULE. Its baseline is the rule's foot and its ascent
 * is the rule's height, so the top of a letter meets the top of the rule and
 * the bottom of the word meets the bottom of it. See `EDITOR.asc`: it used to
 * hang from its ink top with the face's whole band one rule high, which left
 * a word without descenders floating two pixels above the foot.
 *
 * IT GROWS BY A ROW AT A TIME, and a row is one whole band of the face, so a
 * descender can never touch the ascender under it. At one row the box is the
 * height it always was; every row after adds exactly one band.
 *
 * THE BUTTON IS GONE WHILE IT IS OPEN, so there are three ways out and each
 * is one a reader would reach for: the ☁ (or Enter) sends and shuts, Escape
 * shuts without sending, and pressing the cloud star shuts it by asking for
 * the other menu — see `request` in ShelfWheelControls.
 *
 * THE ☁ IS THE CARET AND THE SUBMIT IN ONE MARK, the login box's arrangement
 * and the search bar's: it stands where the next letter will go — its TIP,
 * which is its left edge, being the point the site's own cursor is hotspotted
 * on — it blinks while the field has the caret, and pressing it sends.
 *
 * WHILE THE PROMPT IS SHOWING, THE PROMPT IS STANDING WHERE THE TEXT WILL GO,
 * so the ☁ waits one prompt and one gap past it and moves back to the first
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
  onClose,
}: {
  packId: string;
  name: string;
  /** what the database holds for this reader and this pack, '' for nothing */
  note: string;
  /** whether the text editor is the menu that is out */
  open: boolean;
  button: number;
  /** asked to shut — on Escape, and once a comment has actually been stored */
  onClose?: () => void;
}) {
  const [text, setText] = useState(note);
  const [live, setLive] = useState(false);
  const [refused, setRefused] = useState(false);
  const [, start] = useTransition();

  const field = useRef<HTMLTextAreaElement | null>(null);
  const prompt = useRef<HTMLSpanElement | null>(null);
  const mirror = useRef<HTMLElement | null>(null);
  const home = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLElement | null>(null);
  /** bumped when the field scrolls, which moves the mark without changing it */
  const [scrolled, setScrolled] = useState(0);
  /** where the ☁ stands: how far along its row, and which row that is */
  const [caret, setCaret] = useState({ x: 0, row: 0 });
  /** how many rows the run takes, which is what the rectangle is tall */
  const [rows, setRows] = useState(1);
  /** the column's width, watched so a resize rewraps rather than clipping */
  const [width, setWidth] = useState(0);
  /** the rejection flash's own timer, cleared if the pack is scrolled away */
  const flash = useRef(0);
  useEffect(() => () => window.clearTimeout(flash.current), []);
  const form = useRef<HTMLFormElement | null>(null);

  /**
   * THE WHEEL UNDER THIS EDITOR MUST NOT SEE A WHEEL EVENT.
   *
   * The shelf's stage owns a `{passive: false}` wheel listener and one notch
   * steps the pack — which unmounts these controls and takes an unsent
   * comment with them. The field is exactly as tall as its own text and
   * never scrolls, so there is nothing here for a wheel to do, and the
   * honest answer is to stop it.
   *
   * IT HAS TO BE A NATIVE LISTENER ON THIS ELEMENT. React registers `wheel`
   * at the ROOT, which is ABOVE the stage, so a synthetic `onWheel` here
   * would run after the stage had already acted — and React's is passive
   * besides (the gotcha this file's stylesheet already records). Same
   * arrangement `CigQuantity` uses, and for the same reason.
   */
  useEffect(() => {
    const el = form.current;
    if (!el) return undefined;
    const stop = (e: WheelEvent) => { e.stopPropagation(); e.preventDefault(); };
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  /**
   * AND FOCUS COMES INTO THE EDITOR WHEN IT OPENS — onto the FORM, not the
   * field. The form is where Escape is heard, so a reader who opens the
   * editor and thinks better of it can leave; and because it is not the
   * field, the prompt is still standing to be read, which is the whole
   * reason nothing is focused into. The row that held the opening square
   * goes `inert` at the same moment, so without this focus would land on
   * <body> and Escape would be heard by nobody.
   */
  useEffect(() => {
    if (open) form.current?.focus({ preventScroll: true });
  }, [open]);

  const showing = !live && !text;

  /**
   * WHERE THE ☁ STANDS AND HOW MANY ROWS THERE ARE, measured off one MIRROR
   * — a hidden copy of the run laid out at the field's own width, in the
   * field's own font, so it wraps in exactly the same places. Measuring
   * rather than counting characters is the only thing that can be right
   * about a line that WRAPS, which is what "a new row of text is written"
   * means.
   *
   * IT IS MEASURED BETWEEN TWO MARKS, one before the run and one after it,
   * and that is what makes it exact. An empty inline-block sits with its
   * BOTTOM on the baseline, so its top is a baseline-offset above the line
   * it is on, not the line's top — taken against the mirror's own box that
   * read as four fifths of a row and rounded to a whole one, and the ☁
   * stood a row too low at every length. Taken against a mark laid out the
   * SAME WAY on the first row, the offset is in both and cancels.
   *
   * THE ROW COUNT IS THE CARET'S OWN ROW PLUS ONE, not the mirror's height
   * over the row: one measurement, so the box cannot be a row shorter than
   * the mark standing in it.
   *
   * With the prompt showing there is nothing typed to measure, so the mark
   * waits a prompt and a gap past the start, which is the ask's other case.
   */
  useLayoutEffect(() => {
    if (!open) return;
    if (showing) {
      setCaret({ x: (prompt.current?.getBoundingClientRect().width ?? 0) + EDITOR.pad, row: 0 });
      setRows(1);
      return;
    }
    const m = mirror.current;
    const a = home.current;
    const b = tip.current;
    if (!m || !a || !b) return;
    const from = a.getBoundingClientRect();
    const to = b.getBoundingClientRect();
    const row = parseFloat(getComputedStyle(m).lineHeight) || 1;
    const line = Math.max(0, Math.round((to.top - from.top) / row));
    setCaret({ x: Math.max(0, to.left - from.left), row: line });
    setRows(line + 1);
  }, [open, showing, text, scrolled, button, width]);

  /**
   * AND IT IS MEASURED AGAIN WHENEVER THE COLUMN CHANGES WIDTH. The editor
   * is as wide as the pack, and the pack is sized off the VIEWPORT — so a
   * window resized narrower rewraps the run while `--rows` still says what
   * it said, and the field is `overflow: hidden` at exactly that many rows:
   * the reader's own last line would be cut off the bottom of the box with
   * nothing to say so. None of the effect's other dependencies can see a
   * resize, `button` least of all — it is a constant.
   */
  useEffect(() => {
    const el = form.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const send = () => {
    const out = text.trim().slice(0, NOTE_MAX);
    /*
     * A SUBMIT THAT CHANGES NOTHING WRITES NOTHING. Pressing the ☁ is the
     * ordinary way to put the editor away, so it is pressed on an untouched
     * one all the time — and an unguarded upsert would then stamp `note_at`
     * with today for a comment written last Monday, and would put a pack
     * BACK on the shelf that the favourite had just taken off. Nothing to
     * say means nothing to save.
     */
    if (out === note) { onClose?.(); return; }
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
        window.clearTimeout(flash.current);
        flash.current = window.setTimeout(() => setRefused(false), REJECT_MS);
        return;
      }
      setText(answer.note);
      onClose?.();
    });
  };

  return (
    <form
      className="shelf-comment"
      ref={form}
      data-open={open ? '' : undefined}
      data-refused={refused ? '' : undefined}
      /* shut, it is not there at all: out of the tab order, out of the
         accessibility tree and taking no pointer, as every shut menu on
         this site is */
      inert={!open}
      tabIndex={-1}
      style={{ '--btn': `${button}px`, '--rows': rows } as React.CSSProperties}
      onSubmit={(e) => { e.preventDefault(); send(); }}
      /* A PRESS IN HERE IS NOT A PRESS ON THE WHEEL. The stage turns any
         press it sees into a drag past six pixels, captures the pointer —
         which kills the selection being made — and stops resting, which
         unmounts this editor and the comment in it. It is NOT
         `preventDefault`, which is what the quantity stripes do: that
         would also stop the field taking the caret. */
      onPointerDown={(e) => e.stopPropagation()}
      /* AND A KEY IN HERE BELONGS TO THE FIELD. The stage's arrow keys step
         the pack, so ArrowUp to move between the rows of a comment would
         throw the comment away — the one thing this control must never do.
         Every key is stopped, here rather than on the field, so it covers
         the form's own focus as well. */
      onKeyDown={(e) => {
        e.stopPropagation();
        // Enter sends — but not while an IME has a candidate open, where
        // it is the reader choosing a character and not submitting.
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          send();
        }
        if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
      }}
    >
      {/* THE TRANSFER FUNCTION THAT PUTS THE DASHED RULE BACK AT FULL
          STRENGTH. The mark is two device pixels by ten, so the browser's
          downscale of the drawn dashes leaves no row solid; this multiplies
          what survives and clips the rest, which takes each dash to 255 and
          each gap to nothing. Its slope and intercept were measured off the
          rendered profile — see the stylesheet.

          ONE INSTANCE ONLY, and that holds because only the pack the wheel
          has stopped on carries controls. */}
      <svg className="shelf-comment-defs" aria-hidden focusable="false">
        <filter id="shelf-ink-solid" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncA type="linear" slope="2.5" intercept="-0.15" />
          </feComponentTransfer>
        </filter>
      </svg>

      {/* THE VERTICAL DASHED RULE, white and in the corner. It is the login
          box's own sprite at the scale the square set it, so the dashes are
          the same dashes; only its colour and its place have changed. The
          mask is on its `::before` so the filter above can reach it. */}
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

      {/* A TEXTAREA, BUT ENTER STILL SENDS. The rows come from WRAPPING —
          "as a new row of text is written" — not from a reader pressing
          Enter, and Enter was made the send in the ask before this one. */}
      <textarea
        ref={field}
        className="shelf-comment-field"
        value={text}
        rows={1}
        maxLength={NOTE_MAX}
        aria-label={`Leave a comment on ${name}`}
        autoComplete="off"
        onFocus={() => setLive(true)}
        onBlur={() => setLive(false)}
        onChange={(e) => setText(e.target.value.replace(/[\r\n]+/g, ' '))}
        onScroll={() => setScrolled((n) => n + 1)}
      />

      {/* the run again, laid out unseen at the field's own width, with the
          place the next letter goes marked at the end of it */}
      <i className="shelf-comment-mirror" ref={mirror} aria-hidden>
        <i className="shelf-comment-tip" ref={home} />
        {text}
        <i className="shelf-comment-tip" ref={tip} />
      </i>

      {/* THE ☁: the caret, and the send. Solid at three quarters until the
          reader is in the field, then full and blinking. */}
      <button
        type="submit"
        className="shelf-comment-send"
        style={{
          '--caret-x': `${caret.x.toFixed(2)}px`,
          '--caret-row': caret.row,
        } as React.CSSProperties}
        data-live={live ? '' : undefined}
        aria-label={`Save your comment on ${name}`}
      >
        <i aria-hidden />
      </button>
    </form>
  );
}
