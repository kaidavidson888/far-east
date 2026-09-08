'use client';

import { useActionState, useEffect, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password';
type Kind = 'line' | 'label' | 'cloud';

const SHRINK_AFTER = 12;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(0.42, SHRINK_AFTER / len));

// per-row size of the typed text, relative to the baked label height
const TYPED_SCALE: Record<Row, number> = { email: 1.1, password: 1 };

/**
 * The login box overlay. Its visuals ARE the box baked into the frames: three
 * sprite windows per row (label · ☁ · dashed line) onto `blackbox.webp`, which
 * is that black content cropped from f100 — so it's pixel-exact with what
 * settle.webp fades out underneath. Transparent working inputs sit on the
 * dashes.
 *
 * Per-part opacity (unchanged): idle → lines 50, labels 50, ☁ 100. A text field
 * focused → all lines 100, the submit row 80, every other label/☁ 10, and the
 * red design outside the box drops to 20. A row with text → its label + ☁ 0.
 * The submit button hovered/focused → its whole row 100, nothing else moves.
 */
export function SplashLoginFields({
  box,
  onFieldFocus,
}: {
  box: Box;
  onFieldFocus?: (on: boolean) => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<Row | null>(null);
  const [submitActive, setSubmitActive] = useState(false);
  const [shown, setShown] = useState(false);

  const inField = focus === 'email' || focus === 'password';

  // the baked black vanishes instantly on latch; the form comes in right behind
  // it — one frame's grace so the settle paint lands first, then a quick fade
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => { onFieldFocus?.(inField); }, [inField, onFieldFocus]);

  const { parts } = SPLASH_GEOM;
  // where the form sits inside the red outline box, as a fraction of it
  const OX = box.w * -0.058;
  const OY = box.h * 0.004;
  const bx = (fx: number) => box.x + fx * box.w + OX;
  const by = (fy: number) => box.y + fy * box.h + OY;
  const labelSize = box.h * 0.075;

  const op = (kind: Kind, row: Row | 'submit'): number => {
    const rowTyped = (row === 'email' && email.length > 0) || (row === 'password' && pw.length > 0);
    if (kind === 'cloud') {
      if (row === 'submit') return submitActive ? 1 : inField ? 0.8 : 1;
      if (rowTyped) return 0;
      if (inField) return 0.1;
      return 1;
    }
    if (row === 'submit' && submitActive) return 1;
    if (row === 'submit' && inField) return 0.8;
    if (kind === 'line') return inField ? 1 : 0.5;
    if (rowTyped) return 0;
    if (inField) return 0.1;
    return 0.5;
  };

  // a window onto blackbox.webp: the rect [x0f,y0f]-[x1f,y1f] of the box. The
  // sprite is anchored to the window's own top-left (so the OX/OY nudge moves
  // the content with the window, not relative to it).
  const win = (key: string, x0f: number, y0f: number, x1f: number, y1f: number, o: number) => (
    <div
      key={key}
      aria-hidden
      style={{
        position: 'fixed', pointerEvents: 'none',
        left: bx(x0f), top: by(y0f), width: (x1f - x0f) * box.w, height: (y1f - y0f) * box.h,
        backgroundImage: 'url(/splash/blackbox.webp)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${box.w}px ${box.h}px`,
        backgroundPosition: `${-x0f * box.w}px ${-y0f * box.h}px`,
        opacity: o,
        transition: 'opacity 160ms ease',
      }}
    />
  );

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
        name={r} type={type} autoComplete={ac} required aria-label={label}
        value={value}
        onChange={(e) => set(e.target.value)}
        onFocus={() => setFocus(r)}
        onBlur={() => setFocus((f) => (f === r ? null : f))}
      />
    );
  };

  return (
    <>
      {/* while a text field is in use, the red design outside the box drops to
          20% — a soft hole in the veil keeps the whole ornate red frame lit */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: `rgba(252,252,252,${inField ? 0.8 : 0})`,
          WebkitMaskImage: `radial-gradient(ellipse ${box.w * 0.92}px ${box.h * 0.92}px at ${box.x + box.w / 2}px ${box.y + box.h / 2}px, rgba(0,0,0,0) 62%, rgba(0,0,0,1) 100%)`,
          maskImage: `radial-gradient(ellipse ${box.w * 0.92}px ${box.h * 0.92}px at ${box.x + box.w / 2}px ${box.y + box.h / 2}px, rgba(0,0,0,0) 62%, rgba(0,0,0,1) 100%)`,
          transition: 'background 240ms ease',
        }}
      />

      <div style={{ opacity: shown ? 1 : 0, transition: `opacity ${shown ? 120 : 0}ms ease` }}>
        {(['email', 'password', 'submit'] as const).flatMap((row) => {
          const p = parts[row];
          return [
            win(`${row}-label`, p.x0, p.y0, p.mid, p.y1, op('label', row)),
            win(`${row}-cloud`, p.mid, p.y0, p.cloudX1, p.y1, op('cloud', row)),
            win(`${row}-line`, p.x0, p.dY0, p.dashX1, p.dY1, op('line', row)),
          ];
        })}
      </div>

      <form className="splash-fields" action={action}>
        <input type="hidden" name="next" value="/" />

        {field('email', email, setEmail, 'email', 'email', 'Email')}
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

        {state?.error ? (
          <p
            className="splash-fields-error"
            style={{ position: 'fixed', left: box.x, top: box.y + box.h + 10, width: box.w }}
          >
            {state.error}
          </p>
        ) : null}
      </form>
    </>
  );
}
