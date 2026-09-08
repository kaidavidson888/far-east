'use client';

import { useActionState, useEffect, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password';

const SHRINK_AFTER = 12;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(0.42, SHRINK_AFTER / len));

/**
 * The login box you see is the one baked into the last frame. Once the form is
 * up, this wipes the box interior clean — every black part (the EMAIL / PASSWORD
 * / create-account labels, the ☁ glyphs, the dashed lines) goes, leaving just
 * the baked red border — and lays transparent, functional inputs + a submit
 * button over it. Typed text shows bold. A veil dims everything outside the box
 * while a text field is focused. The wipe fades in with the overlay.
 */
export function SplashLoginFields({ box }: { box: Box }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<Row | null>(null);
  const [shown, setShown] = useState(false);

  const inField = focus === 'email' || focus === 'password';
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const { rows } = SPLASH_GEOM;
  const bx = (fx: number) => box.x + fx * box.w;
  const by = (fy: number) => box.y + fy * box.h;
  const labelSize = box.h * 0.10; // ≈ the baked "EMAIL" cap height

  const inputStyle = (r: Row, len: number): React.CSSProperties => {
    const size = labelSize * fit(len);
    return {
      position: 'fixed',
      left: bx(rows[r].left),
      top: by(rows[r].dashY) - size - Math.max(1, size * 0.06),
      width: bx(0.93) - bx(rows[r].left),
      height: size,
      fontSize: size,
      lineHeight: 1,
    };
  };

  return (
    <>
      {/* while a text field is in use, everything OUTSIDE the box dims to 20%
          (the box itself — baked red border, interior — stays lit) */}
      <div
        aria-hidden
        style={{
          position: 'fixed', pointerEvents: 'none',
          left: box.x, top: box.y, width: box.w, height: box.h,
          boxShadow: `0 0 0 100vmax rgba(252,252,252,${inField ? 0.8 : 0})`,
          transition: 'box-shadow 240ms ease',
        }}
      />

      {/* wipe the baked box interior — labels, ☁, dashes all go, leaving the
          baked red border. Fades in with the overlay. Inset so the border shows. */}
      <div
        aria-hidden
        style={{
          position: 'fixed', pointerEvents: 'none',
          left: bx(0.045), top: by(0.05),
          width: bx(0.955) - bx(0.045), height: by(0.95) - by(0.05),
          background: '#fcfcfc',
          opacity: shown ? 1 : 0,
          transition: `opacity ${shown ? 200 : 320}ms ease`,
        }}
      />

      <form className="splash-fields" action={action}>
        <input type="hidden" name="next" value="/" />

        <input
          className="splash-field-input" style={inputStyle('email', email.length)}
          name="email" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} aria-label="Email"
        />
        <input
          className="splash-field-input" style={inputStyle('password', pw.length)}
          name="password" type="password" autoComplete="current-password" required
          value={pw} onChange={(e) => setPw(e.target.value)}
          onFocus={() => setFocus('password')} onBlur={() => setFocus(null)} aria-label="Password"
        />
        <button
          type="submit" className="splash-field-submit"
          style={{
            position: 'fixed',
            left: bx(rows.submit.left - 0.03), top: by(rows.submit.top - 0.03),
            width: bx(0.96) - bx(rows.submit.left - 0.03),
            height: by(rows.submit.bot + 0.05) - by(rows.submit.top - 0.03),
          }}
        >
          <span className="sr-only">Create account or log in</span>
        </button>

        {state?.error ? (
          <p className="splash-fields-error"
            style={{ position: 'fixed', left: bx(0), top: by(1) + 8, width: box.w }}>
            {state.error}
          </p>
        ) : null}
      </form>
    </>
  );
}
