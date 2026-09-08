'use client';

import { useActionState, useEffect, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password' | 'submit';
type Part = 'label' | 'cloud' | 'dash';

const SHRINK_AFTER = 12;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(0.42, SHRINK_AFTER / len));

/**
 * The login box you see is the one baked into the last frame. This overlays it
 * with transparent, functional inputs and — for the focus/typing states — white
 * covers over its parts (that's the only visual it draws): a row's label/☁ dim
 * or vanish, the dashed line brightens, the "create account / login" row lifts.
 * The covers fade in as a unit once the animation latches.
 */
export function SplashLoginFields({ box }: { box: Box }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<Row | null>(null);
  const [submitActive, setSubmitActive] = useState(false);
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

  // target opacity of each baked part, 0..1
  const target = (row: Row, part: Part): number => {
    const rowTyped = (row === 'email' && email.length > 0) || (row === 'password' && pw.length > 0);
    if (part === 'cloud') {
      if (row === 'submit') {
        if (submitActive) return 1;      // button hovered/focused → its whole row lifts
        return inField ? 0.8 : 1;        // dims with its row while a text field is in use
      }
      if (rowTyped) return 0;            // ☁ never reacts to the submit button
      if (inField) return 0.1;
      return 1;
    }
    if (row === 'submit' && submitActive) return 1;
    if (row === 'submit' && inField) return 0.8;
    if (part === 'dash') return inField ? 1 : 0.5;
    if (rowTyped) return 0;
    if (inField) return 0.1;
    return 0.5;
  };

  const cover = (key: string, x0: number, x1: number, y0: number, y1: number, op: number) => (
    <div
      key={key}
      aria-hidden
      style={{
        position: 'fixed', pointerEvents: 'none',
        left: bx(x0), top: by(y0),
        width: bx(x1) - bx(x0), height: by(y1) - by(y0),
        background: '#fcfcfc',
        opacity: shown ? 1 - op : 0,
        transition: `opacity ${shown ? 170 : 300}ms ease`,
      }}
    />
  );

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
          (the box itself — border, interior, labels — stays lit) */}
      <div
        aria-hidden
        style={{
          position: 'fixed', pointerEvents: 'none',
          left: box.x, top: box.y, width: box.w, height: box.h,
          boxShadow: `0 0 0 100vmax rgba(252,252,252,${inField ? 0.8 : 0})`,
          transition: 'box-shadow 240ms ease',
        }}
      />

      {/* the red outline, redrawn on top so it stays 100% while the baked one
          under it dims with the rest of the canvas */}
      <div
        style={{
          position: 'fixed', boxSizing: 'border-box', pointerEvents: 'none',
          left: box.x, top: box.y, width: box.w, height: box.h,
          border: `${Math.max(1.4, box.w * 0.016)}px solid #ff0000`,
          opacity: shown ? 1 : 0, transition: `opacity ${shown ? 170 : 300}ms ease`,
        }}
      />

      {/* white covers over the baked box parts (fade in once latched). The
          dashed line runs the full width; the label + ☁ sit above it on the
          left. Covers are kept off the dash strip so it stays intact. */}
      {(['email', 'password', 'submit'] as const).flatMap((row) => {
        const rw = rows[row];
        const aboveDash = rw.dashY - 0.007;
        const belowDash = rw.dashY + 0.017;
        const out = [
          cover(`${row}-label`, rw.left - 0.01, rw.labelR + 0.012, rw.top - 0.015, aboveDash, target(row, 'label')),
          cover(`${row}-clA`, rw.cloudX0 - 0.008, rw.cloudX1 + 0.012, rw.top - 0.015, aboveDash, target(row, 'cloud')),
          cover(`${row}-dash`, rw.left - 0.01, 0.905, aboveDash, belowDash, target(row, 'dash')),
        ];
        // second ☁ cover only where the glyph crosses below the dash (submit row)
        if (rw.bot + 0.03 > belowDash) {
          out.push(cover(`${row}-clB`, rw.cloudX0 - 0.008, rw.cloudX1 + 0.012, belowDash, rw.bot + 0.03, target(row, 'cloud')));
        }
        return out;
      })}

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
          onPointerEnter={() => setSubmitActive(true)}
          onPointerLeave={() => setSubmitActive(false)}
          onFocus={() => setSubmitActive(true)}
          onBlur={() => setSubmitActive(false)}
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
