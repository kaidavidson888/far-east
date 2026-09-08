'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password';
type Kind = 'line' | 'label' | 'cloud';

const SHRINK_AFTER = 12;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(0.42, SHRINK_AFTER / len));

// the vector form sits inside the baked red box, not flush to it; a hair left
// so the ☁ glyphs (which sit right of centre) don't pull it visually rightward
const INSET = 0.09;
const NUDGE_X = -0.037;

/**
 * The login box overlay: loginbox-parts.svg (the black form — labels, ☁ glyphs
 * and dashed lines, no red border) sized to sit *inside* the animation's red
 * outline box, with transparent working inputs + a submit button over it.
 *
 * Per-part opacity (unchanged): idle → lines 50, labels 50, ☁ 100. A text field
 * focused → all lines 100, the submit row 80, every other label/☁ 10, and the
 * red design outside the box drops to 20. A row with text → its label + ☁ 0.
 * The submit button hovered/focused → its whole row 100, nothing else moves.
 */
export function SplashLoginFields({ box }: { box: Box }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<Row | null>(null);
  const [submitActive, setSubmitActive] = useState(false);
  const [svg, setSvg] = useState('');
  const [shown, setShown] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  const inField = focus === 'email' || focus === 'password';

  useEffect(() => {
    let ok = true;
    fetch('/splash/loginbox-parts.svg').then((r) => r.text()).then((s) => ok && setSvg(s)).catch(() => {});
    return () => { ok = false; };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  // drive each vector part's opacity
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const op = (kind: Kind, row: Row | 'submit') => {
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
    for (const row of ['email', 'password', 'submit'] as const) {
      for (const kind of ['line', 'label', 'cloud'] as const) {
        const el = host.querySelector<SVGGElement>(`#${kind}-${row}`);
        if (el) el.style.opacity = String(op(kind, row));
      }
    }
  }, [svg, email, pw, focus, submitActive, inField]);

  const { rows } = SPLASH_GEOM;
  const sb = {
    x: box.x + box.w * (INSET + NUDGE_X), y: box.y + box.h * INSET,
    w: box.w * (1 - 2 * INSET), h: box.h * (1 - 2 * INSET),
  };
  const bx = (fx: number) => sb.x + fx * sb.w;
  const by = (fy: number) => sb.y + fy * sb.h;
  const labelSize = sb.h * 0.11;

  const field = (r: Row, value: string, set: (v: string) => void, type: string, ac: string, label: string) => {
    const rw = rows[r];
    const size = labelSize * fit(value.length);
    return (
      <input
        key={r}
        className="splash-field-input"
        style={{
          position: 'fixed',
          left: bx(rw.lineX0),
          top: by(rw.dashY) - size - Math.max(1, size * 0.05),
          width: bx(rw.endX) - bx(rw.lineX0),
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
          20% — the box stays lit */}
      <div
        aria-hidden
        style={{
          position: 'fixed', pointerEvents: 'none',
          left: box.x, top: box.y, width: box.w, height: box.h,
          boxShadow: `0 0 0 100vmax rgba(252,252,252,${inField ? 0.8 : 0})`,
          transition: 'box-shadow 240ms ease',
        }}
      />

      <div
        ref={hostRef}
        aria-hidden
        className="splash-box"
        style={{
          left: sb.x, top: sb.y, width: sb.w, height: sb.h,
          opacity: shown ? 1 : 0, transition: `opacity ${shown ? 440 : 0}ms ease`,
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <form className="splash-fields" action={action}>
        <input type="hidden" name="next" value="/" />

        {field('email', email, setEmail, 'email', 'email', 'Email')}
        {field('password', pw, setPw, 'password', 'current-password', 'Password')}

        <button
          type="submit"
          className="splash-field-submit"
          style={{
            position: 'fixed',
            left: bx(rows.submit.lineX0 - 0.03), top: by(rows.submit.dashY) - labelSize * 1.7,
            width: bx(rows.submit.endX + 0.03) - bx(rows.submit.lineX0 - 0.03), height: labelSize * 2.2,
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
