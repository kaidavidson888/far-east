'use client';

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import {
  LOGIN_BOX, LOGIN_LABEL, LOGIN_ROW, LOGIN_TYPE, OLD_BOX_W,
  fitRow, loginBoxRect, type LoginStep,
} from '@/lib/loginBox';
import INK from '@/scripts/assets/far-east-ink.json';
import { buildLoginInk, wordInk, type LoginInk } from '@/lib/loginInk';
import { SPLASH_GEOM, splashAsset } from '@/lib/splashFrames';

/**
 * THE LOGIN BOX: ONE LONG ROW IN A RED RECTANGLE (the owner's 2026-09-20 ask).
 *
 * The square with three rows in it is gone. What is here is one row of it, at
 * its own scale and margins, in a rectangle the height of the landing page's
 * 遠東 logo and three of the old box long — see lib/loginBox.ts for where every
 * number comes from.
 *
 * Inside, in the order the owner listed them:
 *   - THE PERPENDICULAR LEFT DASHED RULE, and only that: the horizontal line
 *     is not drawn any more, because the typing draws it.
 *   - THE WORD, which alternates: PHONE # · VERIFICATION CODE · EMAIL ·
 *     VERIFICATION CODE · PASSWORD. It is written by tendrils out of the black
 *     outline and taken back into it the same way — lib/loginInk.ts.
 *   - A PIECE OF DASHED LINE UNDER EVERY LETTER TYPED, the width of that
 *     letter. The gaps are the letters' own bearings.
 *   - THE ☁, standing where the next letter will go, and the submit button.
 *
 * A failed submission floods the rectangle red and empties it, which is the
 * rejection the box already had, moved to the new shape.
 */

/** What a step's submission comes back as. */
export type LoginStepResult =
  /** on: where to go next, or 'done' when they are in */
  | { ok: true; next: LoginStep | 'done' }
  /** off: the rectangle flashes and what was typed goes */
  | { ok: false; error?: string };

const REJECT_MS = 500;
/** Where a line-height:1 box puts its baseline, measured in Chrome. */
const BASELINE = 0.825;
/** The reverse runs at twice the forward pace, as every scrub on this site does. */
const REVERSE_RATE = 2;

type Phase = 'rest' | 'in' | 'out';

export function SplashLoginRow({
  centre,
  step,
  onStep,
  submit,
  notice = null,
  onFieldFocus,
  onReady,
  live = true,
}: {
  /** the middle of the frame's own box, so the animation still converges on it */
  centre: { x: number; y: number };
  step: LoginStep;
  onStep: (next: LoginStep | 'done') => void;
  submit: (step: LoginStep, value: string) => Promise<LoginStepResult>;
  notice?: string | null;
  onFieldFocus?: (on: boolean) => void;
  onReady?: () => void;
  /** false while the animation is still running: drawn, but nothing to type into */
  live?: boolean;
}) {
  const [vw, setVw] = useState(0);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [pieces, setPieces] = useState<{ x: number; w: number }[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const read = () => setVw(document.documentElement.clientWidth || window.innerWidth);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const rect = useMemo(
    () => loginBoxRect(vw || LOGIN_BOX.w + 24, centre.x, centre.y),
    [vw, centre.x, centre.y],
  );

  /* ---------------------------------------------------------------- the ink */

  /**
   * The canvas is the whole inside of the black outline, and the word's own
   * line sits where the row's ink does. The network is grown per word and
   * cached: a step can be come back to (a wrong code is asked for again) and
   * regrowing it would deal a different hand of tendrils each time.
   */
  const view = useMemo(
    () => ({ w: rect.w - 2 * (LOGIN_BOX.rule + LOGIN_BOX.inner), h: LOGIN_BOX.h - 2 * (LOGIN_BOX.rule + LOGIN_BOX.inner) }),
    [rect.w],
  );
  /** the canvas's own corner inside the rectangle, so the ink can work in box px */
  const origin = useMemo(
    () => ({ x: LOGIN_BOX.rule + LOGIN_BOX.inner, y: LOGIN_BOX.rule + LOGIN_BOX.inner }),
    [],
  );
  const inks = useRef(new Map<string, LoginInk>());
  const inkFor = useCallback((s: LoginStep) => {
    const key = `${s}:${view.w}`;
    const had = inks.current.get(key);
    if (had) return had;
    // one seed per word, so a word grows the same tendrils every time it is
    // asked for and coming back to a step is coming back to the same picture
    const seed = 20260920 + [...LOGIN_LABEL[s]].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973;
    const made = buildLoginInk(LOGIN_LABEL[s], view, origin, seed);
    inks.current.set(key, made);
    return made;
  }, [origin, view]);

  /**
   * The scrub. `shown` is the word on the canvas; when `step` moves on, the
   * shown word runs backwards (the tendrils reach out, gather it up and carry
   * it into the outline), the word is swapped at 0, and the new one runs
   * forward. One network, both directions.
   */
  const [shown, setShown] = useState<LoginStep>(step);
  const stateRef = useRef<{ t: number; phase: Phase; shown: LoginStep }>({ t: 0, phase: 'in', shown: step });
  const wantRef = useRef<LoginStep>(step);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => { wantRef.current = step; }, [step]);

  const paintInk = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ss = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(view.w * ss);
    const h = Math.round(view.h * ss);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    inkFor(stateRef.current.shown).draw(ctx, stateRef.current.t, ss);
  }, [inkFor, view.h, view.w]);

  useEffect(() => {
    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const st = stateRef.current;
      /*
       * NOTHING IS WRITTEN UNTIL THE BOX IS LIVE. The row is mounted for the
       * whole four seconds of the splash so that the rectangle can fade up
       * with everything else, and a run started at mount would be over before
       * the reader could see the box at all — the first word would simply be
       * there. Held at 0, the tendrils leave the outline and write PHONE # as
       * the box arrives, which is the point of them.
       */
      if (!live) { lastRef.current = 0; return; }
      const dt = lastRef.current ? Math.min(250, ts - lastRef.current) : 16;
      lastRef.current = ts;
      const run = inkFor(st.shown).ms;
      let moved = false;
      if (st.shown !== wantRef.current && st.phase !== 'out') { st.phase = 'out'; }
      if (st.phase === 'out') {
        st.t -= (dt / run) * REVERSE_RATE;
        moved = true;
        if (st.t <= 0) {
          st.t = 0;
          st.shown = wantRef.current;
          st.phase = 'in';
          setShown(st.shown);
        }
      } else if (st.t < 1) {
        st.t = Math.min(1, st.t + dt / run);
        moved = true;
        if (st.t >= 1) st.phase = 'rest';
      }
      if (moved) paintInk();
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inkFor, live, paintInk]);

  // redraw when the rectangle is re-measured (a resize rebuilds the network)
  useLayoutEffect(() => { paintInk(); }, [paintInk]);

  /*
   * THE WORD IS RASTERED WITH THE OWNER'S FACE, so it has to wait for it. The
   * file is preloaded in the document head and usually arrives first, but a
   * canvas asked for a font it has not got draws the fallback and caches the
   * result — which would leave the box's prompt set in the wrong letterform
   * for the life of the page. Everything grown is thrown away and redrawn once
   * the face is really there.
   */
  useEffect(() => {
    let alive = true;
    void document.fonts.ready.then(() => {
      if (!alive) return;
      inks.current.clear();
      paintInk();
    });
    return () => { alive = false; };
  }, [paintInk]);

  /* -------------------------------------------------- what has been typed */

  const shownValue = step === 'password' ? '•'.repeat(value.length) : value;
  /*
   * WHAT IS TYPED IS AS TALL AS THE RULE BESIDE IT, shrunk when the run gets
   * too long for the line — the owner's "make the size of the typed characters
   * the same height as the altered vertical dashed line", by the same `fitRow`
   * the prompt is set with, so the answer arrives at exactly the size the
   * prompt left. The masked password measures its bullets rather than its
   * letters, because the bullets are what is on the line.
   */
  const typed = fitRow(shownValue || ' ', INK);
  const typedSize = typed.size;

  /**
   * WHERE EVERY LETTER'S INK STARTS AND STOPS, measured with the field's own
   * font — which is what the pieces of dashed line are cut to, and where the ☁
   * stands. `actualBoundingBox*` is the ink, not the advance: a piece cut to
   * the advance would meet its neighbour and the row would draw one continuous
   * rule instead of a dashed one.
   */
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = `700 ${typedSize}px ${getComputedStyle(el).fontFamily}`;
    const out: { x: number; w: number }[] = [];
    let pen = 0;
    for (const ch of shownValue) {
      const m = ctx.measureText(ch);
      const l = m.actualBoundingBoxLeft ?? 0;
      const r = m.actualBoundingBoxRight ?? m.width;
      if (r + l > 0.2) out.push({ x: pen - l, w: l + r });
      pen += m.width;
    }
    setPieces(out);
    setCaret(pen);
  }, [shownValue, typedSize]);

  /* ----------------------------------------------------------- submitting */

  const reject = useCallback((msg?: string) => {
    setValue('');
    setError(msg ?? null);
    setRejected(true);
    clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => setRejected(false), REJECT_MS);
  }, []);

  useEffect(() => () => clearTimeout(rejectTimer.current), []);
  useEffect(() => { onFieldFocus?.(focused); }, [focused, onFieldFocus]);
  useLayoutEffect(() => { if (live) onReady?.(); }, [live, onReady]);

  const send = useCallback(async () => {
    if (busy || !live) return;
    const v = value.trim();
    if (!v) { reject(); return; }
    setBusy(true);
    try {
      const res = await submit(step, v);
      if (res.ok) {
        setValue('');
        setError(null);
        onStep(res.next);
      } else {
        reject(res.error);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, live, onStep, reject, step, submit, value]);

  /* ------------------------------------------------------------- the row */

  const R = LOGIN_BOX.rule;
  const IN = R + LOGIN_BOX.inner;
  const label = LOGIN_LABEL[step];
  const ink = wordInk(label);
  // the word steps aside for the caret: while the field has focus or anything
  // is typed, the row is the reader's, not the prompt's
  const wordOut = focused || value.length > 0;
  const dashTop = LOGIN_ROW.dashY;
  const textLeft = LOGIN_ROW.textX;
  /*
   * THE ☁ STANDS WHERE THE NEXT LETTER WILL GO (the owner's "a sigil which
   * left edge should line up with where the next instance of typed text will
   * be") — and while the word is still being shown, the word is standing in
   * that very place, so the ☁ waits one space past the end of it, which is
   * where the old box drew it. Typing, or even reaching for the field, takes
   * the word away and the ☁ slides back to the first letter's place. It is
   * the word that gives way, never the mark: the mark is the one saying where
   * the reader is.
   */
  /*
   * THE ☁ KEEPS THE SIZE IT IS DRAWN AT. It was scaled with the type for an
   * hour, at the 2.013-of-the-ink-height the old row draws it at, and the two
   * asks then fight: at that proportion the mark is 107px wide and PHONE # at
   * the rule's full height leaves 52 for it, so either the mark is clamped on
   * top of the word or the word comes down a fifth and stops being "the same
   * height as the altered vertical dashed line", which is the instruction.
   * The instruction is about the TYPE, so the type gets the height and the
   * mark stays the ornament it was drawn as. LOGIN_ROW.sigilOfType is kept
   * beside it for the day that is wanted the other way round.
   */
  const sigilW = LOGIN_ROW.sigilDrawn;
  const sigilH = sigilW * LOGIN_ROW.sigilAspect;
  const SPACE = (320 / 1000) * ink.size;
  const caretX = Math.min(
    LOGIN_ROW.lineX1 - sigilW,
    textLeft + (wordOut ? caret : ink.w + SPACE),
  );

  return (
    <div
      className="login-row"
      data-live={live ? '' : undefined}
      style={{
        left: rect.x, top: rect.y, width: rect.w, height: rect.h,
        borderWidth: R,
        '--login-rule': `${R}px`,
      } as React.CSSProperties}
    >
      {/* "a second rectangle outline on the inner edge of the red one this one
          in black" — the reservoir the word's ink comes out of and goes back
          into. It is a border rather than ink on the canvas because it never
          changes, and a border draws on whole pixels. */}
      <div className="login-row-inner" style={{ inset: R, borderWidth: LOGIN_BOX.inner }} />

      {/* the word, and the tendrils that write it */}
      <canvas
        ref={canvasRef}
        className="login-row-ink"
        aria-hidden
        data-out={wordOut ? '' : undefined}
        style={{ left: IN, top: IN, width: view.w, height: view.h }}
      />

      {/* THE PERPENDICULAR LEFT DASHED RULE — the one mark of the old row's
          dashes that is still drawn, shown through its own window onto
          blackbox.webp at the scale it was drawn at, so it is the hand-drawn
          mark rather than a CSS dashed border beside it.

          IT IS EXTENDED, NOT STRETCHED (the owner's "extend the vertical
          dashed line so the top and bottom margins match the left margins").
          A dashed line made longer gains dashes; it does not gain longer
          dashes. So the drawn tile is repeated down the new length and the
          last one is clipped, which keeps the dash length, the gaps and the
          wander the mark was drawn with. Scaling the window in Y instead
          would have stretched every dash by five and three quarters. */}
      <span
        className="login-row-rule"
        aria-hidden
        style={{
          left: LOGIN_ROW.ruleX,
          top: LOGIN_ROW.ruleTop,
          width: LOGIN_ROW.ruleW,
          height: LOGIN_ROW.ruleH,
        }}
      >
        {Array.from({ length: Math.ceil(LOGIN_ROW.ruleH / LOGIN_ROW.ruleTile) }, (_, i) => (
          <span
            key={i}
            style={{
              top: i * LOGIN_ROW.ruleTile,
              width: LOGIN_ROW.ruleW,
              height: LOGIN_ROW.ruleTile,
              backgroundImage: `url(${splashAsset('blackbox.webp')})`,
              backgroundSize: `${OLD_BOX_W}px ${OLD_BOX_W}px`,
              backgroundPosition:
                `${-SPLASH_GEOM.parts.email.x0 * OLD_BOX_W}px ${-SPLASH_GEOM.parts.email.y0 * OLD_BOX_W}px`,
            }}
          />
        ))}
      </span>

      {/* a piece of line under each letter, the width of that letter */}
      <div className="login-row-dashes" aria-hidden style={{ left: textLeft, top: dashTop, height: LOGIN_ROW.dashStroke }}>
        {pieces.map((p, i) => (
          <span key={i} style={{ left: p.x, width: p.w, height: LOGIN_ROW.dashStroke }} />
        ))}
      </div>

      <form
        className="login-row-form"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <input
          ref={inputRef}
          className="splash-field-input login-row-input"
          style={{
            // WHAT IS TYPED SITS ON THE WORD'S OWN BASELINE, so the prompt and
            // the answer are the same line of type rather than two lines a
            // pixel apart. A line-height:1 box puts its baseline at 0.825 of
            // the size, measured in Chrome — the figure the shelf places all
            // its type by.
            left: textLeft,
            top: LOGIN_TYPE.baseline - typedSize * BASELINE,
            width: LOGIN_ROW.lineX1 - textLeft,
            height: typedSize,
            fontSize: typedSize,
          }}
          type={step === 'password' ? 'password' : 'text'}
          inputMode={step === 'phone' ? 'tel' : step === 'email' ? 'email' : step === 'password' ? 'text' : 'numeric'}
          autoComplete={
            step === 'phone' ? 'tel'
              : step === 'email' ? 'email'
                : step === 'password' ? 'current-password' : 'one-time-code'
          }
          enterKeyHint="go"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={label}
          value={value}
          disabled={!live}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* THE ☁ IS THE SUBMIT BUTTON and it stands where the next letter will
            go — the owner's "a sigil which left edge should line up with where
            the next instance of typed text will be" and "the sigil will act as
            a submit button for each section". */}
        <button
          type="submit"
          className="login-row-sigil-hit"
          style={{
            left: caretX,
            top: dashTop - sigilH,
            width: sigilW,
            height: sigilH,
          }}
          disabled={!live || busy}
        >
          <span
            key={shownValue}
            className="login-row-sigil"
            data-miss={rejected ? '' : undefined}
            data-blink={focused && !rejected ? '' : undefined}
          />
          <span className="sr-only">Submit</span>
        </button>
      </form>

      {/* the rejection the box already had, in the new shape: the whole
          rectangle floods with the artwork's own red for half a second */}
      <div className="login-row-flash" aria-hidden data-on={rejected ? '' : undefined} />

      {error || notice ? (
        <p className="splash-fields-error login-row-say">{error ?? notice}</p>
      ) : null}
      <span aria-live="polite" className="sr-only">{shown === step ? label : ''}</span>
    </div>
  );
}
