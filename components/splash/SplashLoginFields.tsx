'use client';

import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { splashAuthAction, type SplashAuthState } from '@/app/actions';
import { SPLASH_GEOM, SPLASH_FORM, splashAsset } from '@/lib/splashFrames';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password';
type Kind = 'line' | 'label' | 'cloud';

// Matches EMAIL_RE in app/actions.ts, which re-checks it server-side.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REJECT_MS = 500;

const SHRINK_AFTER = 12;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(0.42, SHRINK_AFTER / len));

// per-row size of the typed text, relative to the baked label height
const TYPED_SCALE: Record<Row, number> = { email: 1.1, password: 1 };

/**
 * The login box overlay. Its visuals ARE the box baked into the frames: three
 * sprite windows per row (label · ☁ · dashed line) onto `blackbox.webp`, which
 * is that black content cropped from f100 — so it's pixel-exact with the black
 * still baked into the frame underneath. It renders at full opacity on its very
 * first painted frame and reports back through `onReady`; the parent then drops
 * the baked black on the *next* frame, so there is exactly one frame where both
 * are on screen and the handover is invisible. Transparent working inputs sit on
 * the dashes.
 *
 * Per-part opacity (unchanged): idle → lines 50, labels 50, ☁ 100. A text field
 * focused → all lines 100, the submit row 80, every other label/☁ 10, and the
 * red design outside the box drops to 20. A row with text → its label + ☁ 0.
 * The submit button hovered/focused → its whole row 100, nothing else moves.
 */
export function SplashLoginFields({
  box,
  onFieldFocus,
  onReady,
  live = true,
}: {
  box: Box;
  onFieldFocus?: (on: boolean) => void;
  onReady?: () => void;
  /** false while the animation is still running: the same windows, drawn the
   *  same way, but with nothing to type into and no veil. */
  live?: boolean;
}) {
  const [state, action] = useActionState<SplashAuthState, FormData>(splashAuthAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<Row | null>(null);
  const [submitActive, setSubmitActive] = useState(false);
  const [rejected, setRejected] = useState(false);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const inField = focus === 'email' || focus === 'password';

  // A rejected field fills the box red for half a second and takes its own row
  // with it, so the reader is left looking at one empty line to try again on:
  // the EMAIL line for an address that is not an address, the PASSWORD line for
  // a password that does not match an account that already exists.
  const reject = useCallback((row: Row) => {
    if (row === 'email') setEmail('');
    else setPw('');
    setRejected(true);
    clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => setRejected(false), REJECT_MS);
  }, []);

  useEffect(() => () => clearTimeout(rejectTimer.current), []);

  // The server re-checks the address, and only it can know the password is
  // wrong — either way the form answers the same way.
  useEffect(() => {
    if (state?.badEmail) reject('email');
    else if (state?.badPassword) reject('password');
  }, [state, reject]);

  // After the commit but before the browser paints — so by the time this fires
  // the form is in the DOM and *will* be in this frame. The parent hands the
  // baked black one more frame, then drops it.
  useLayoutEffect(() => { if (live) onReady?.(); }, [live, onReady]);

  useEffect(() => { onFieldFocus?.(inField); }, [inField, onFieldFocus]);

  const { parts } = SPLASH_GEOM;
  // Owner-tuned position inside the red outline box. Note this deliberately
  // does NOT sit on top of the black still baked into the frame, so the single
  // handover frame carries a brief doubled-text ghost at this offset.
  const OX = box.w * SPLASH_FORM.ox;
  const OY = box.h * SPLASH_FORM.oy;
  const bx = (fx: number) => box.x + fx * box.w + OX;
  const by = (fy: number) => box.y + fy * box.h + OY;
  const labelSize = box.h * 0.075;

  const op = (kind: Kind, row: Row | 'submit'): number => {
    const rowTyped = (row === 'email' && email.length > 0) || (row === 'password' && pw.length > 0);
    if (kind === 'cloud') {
      if (row === 'submit') return submitActive ? 1 : inField ? 0.8 : 1;
      if (rowTyped) return 0;
      if (inField) return 0.1;
      return SPLASH_FORM.idle.cloud;
    }
    if (row === 'submit' && submitActive) return 1;
    if (row === 'submit' && inField) return 0.8;
    if (kind === 'line') return inField ? 1 : SPLASH_FORM.idle.line;
    if (rowTyped) return 0;
    if (inField) return 0.1;
    return SPLASH_FORM.idle.label;
  };

  // a window onto blackbox.webp: the rect [x0f,y0f]-[x1f,y1f] of the box. The
  // sprite is anchored to the window's own top-left (so the OX/OY nudge moves
  // the content with the window, not relative to it). dx shifts where the
  // window sits without changing what it shows.
  const win = (
    key: string, x0f: number, y0f: number, x1f: number, y1f: number,
    o: number, dx = 0,
  ) => (
    <div
      key={key}
      aria-hidden
      style={{
        position: 'fixed', pointerEvents: 'none',
        left: bx(x0f + dx), top: by(y0f), width: (x1f - x0f) * box.w, height: (y1f - y0f) * box.h,
        backgroundImage: `url(${splashAsset('blackbox.webp')})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${box.w}px ${box.h}px`,
        backgroundPosition: `${-x0f * box.w}px ${-y0f * box.h}px`,
        opacity: o,
        transition: 'opacity 160ms ease',
      }}
    />
  );

  // The EMAIL row's label is supplied artwork, not a slice of the baked sprite:
  // same left edge and cap height as the word it replaces, width from its own
  // aspect, and the same opacity rules as any other label.
  const emailLabel = (o: number) => {
    const g = SPLASH_GEOM.emailLabel;
    return (
      <div
        key="email-label"
        aria-hidden
        style={{
          position: 'fixed', pointerEvents: 'none',
          left: bx(g.x0), top: by(g.y0), width: g.w * box.w, height: g.h * box.h,
          backgroundImage: `url(${splashAsset('phone-label.webp')})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
          opacity: o,
          transition: 'opacity 160ms ease',
        }}
      />
    );
  };

  const field = (r: Row, value: string, set: (v: string) => void, type: string, ac: string, label: string) => {
    const p = parts[r];
    const size = labelSize * TYPED_SCALE[r] * fit(value.length);
    return (
      <input
        key={r}
        className="splash-field-input"
        style={{
          position: 'fixed',
          left: bx(p.x0),
          top: by(p.dY0) - size - Math.max(1, size * 0.06),
          width: bx(p.dashX1) - bx(p.x0),
          height: size, fontSize: size, lineHeight: 1,
        }}
        name={r} type={type} autoComplete={ac} aria-label={label}
        inputMode={r === 'email' ? 'email' : undefined}
        value={value}
        onChange={(e) => set(e.target.value)}
        onFocus={() => setFocus(r)}
        onBlur={() => setFocus((f) => (f === r ? null : f))}
      />
    );
  };

  const windows = (
    <div>
      {(['email', 'password', 'submit'] as const).flatMap((row) => {
        const p = parts[row];
        return [
          row === 'email'
            ? emailLabel(op('label', row))
            : win(`${row}-label`, p.labelX0, p.y0, p.mid, p.y1, op('label', row)),
          win(`${row}-cloud`, p.mid, p.y0, p.cloudX1, p.y1, op('cloud', row),
            'cloudDx' in p ? p.cloudDx : 0),
          win(`${row}-line`, p.x0, p.dY0, p.dashX1, p.dY1, op('line', row)),
          // the dashed vertical rule that opens the row — same sprite, same
          // window machinery, same line opacity, so it reads as one mark with
          // the dashes it meets
          win(`${row}-rule`, p.x0, p.y0, p.ruleX1, p.dY0, op('line', row)),
        ];
      })}
    </div>
  );

  // One tree shape either way — the windows always sit in the same slot — so at
  // the hand-off React reconciles them in place rather than tearing them down
  // and building them again.
  return (
    <>
      {/* while a text field is in use, the red design outside the box drops to
          20% — a soft hole in the veil keeps the whole ornate red frame lit */}
      {!live ? null : <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: `rgba(252,252,252,${inField ? 0.8 : 0})`,
          WebkitMaskImage: `radial-gradient(ellipse ${box.w * 0.92}px ${box.h * 0.92}px at ${box.x + box.w / 2}px ${box.y + box.h / 2}px, rgba(0,0,0,0) 62%, rgba(0,0,0,1) 100%)`,
          maskImage: `radial-gradient(ellipse ${box.w * 0.92}px ${box.h * 0.92}px at ${box.x + box.w / 2}px ${box.y + box.h / 2}px, rgba(0,0,0,0) 62%, rgba(0,0,0,1) 100%)`,
          transition: 'background 240ms ease',
        }}
      />}

      {windows}

      {!live ? null : <form
        className="splash-fields"
        action={action}
        // our own check runs instead of the browser's, which would otherwise
        // block the submit with a bubble before the box could flash
        noValidate
        onSubmit={(e) => {
          if (!EMAIL_RE.test(email.trim())) {
            e.preventDefault();
            reject('email');
          }
        }}
      >
        {field('email', email, setEmail, 'text', 'email', 'Email')}
        {field('password', pw, setPw, 'password', 'current-password', 'Password')}

        <button
          type="submit"
          className="splash-field-submit"
          style={{
            position: 'fixed',
            left: bx(parts.submit.x0), top: by(parts.submit.y0),
            width: bx(parts.submit.dashX1) - bx(parts.submit.x0),
            height: by(parts.submit.dY1) - by(parts.submit.y0),
          }}
          onPointerEnter={() => setSubmitActive(true)}
          onPointerLeave={() => setSubmitActive(false)}
          onFocus={() => setSubmitActive(true)}
          onBlur={() => setSubmitActive(false)}
        >
          <span className="sr-only">Create account or log in</span>
        </button>

        {state?.error || state?.ok ? (
          <p
            className="splash-fields-error"
            style={{ position: 'fixed', left: box.x, top: box.y + box.h + 10, width: box.w }}
          >
            {state.error ?? state.ok}
          </p>
        ) : null}
      </form>}

      {/* Owner's call, and a deliberate exception to the spec's "red is never an
          error colour": a rejected field floods the box with the splash's own
          red, right out to the outline's own footprint so no paper shows at the edge. */}
      {!live ? null : <div
        aria-hidden
        style={{
          position: 'fixed',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          background: '#FF0000',
          opacity: rejected ? 1 : 0,
          transition: rejected ? 'none' : 'opacity 150ms ease',
          pointerEvents: 'none',
        }}
      />}
    </>
  );
}
