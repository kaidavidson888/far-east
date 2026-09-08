'use client';

import { useActionState, useEffect, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';
import type { FocusField } from '../SplashScreen';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password' | 'submit';

const SHRINK_AFTER = 12;
const MIN = 0.42;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(MIN, SHRINK_AFTER / len));

/**
 * Transparent functional inputs over the vector login box, positioned in box
 * space. Typed text is bold Cormorant Unicase, no caret, the same size as the
 * box's "EMAIL" label, starting at the left of the row's dashed line with its
 * baseline just above the line (and shrinking as it grows long). A row's box
 * label drops to 0 once that row has text. "create account / login" is a submit
 * button — it signs the user in and sends them to the homepage.
 */
export function SplashLoginFields({
  box,
  onFieldState,
  onSubmitActive,
}: {
  box: Box;
  onFieldState: (f: FocusField, emailTyped: boolean, pwTyped: boolean) => void;
  onSubmitActive: (v: boolean) => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<FocusField>(null);

  // Report focus + which rows have text whenever any of it changes.
  useEffect(() => {
    onFieldState(focus, email.length > 0, pw.length > 0);
  }, [focus, email, pw, onFieldState]);

  const { rows } = SPLASH_GEOM;
  const bx = (fx: number) => box.x + fx * box.w;
  const by = (fy: number) => box.y + fy * box.h;
  const labelSize = box.h * 0.145; // matches the box's own "EMAIL" cap height

  const inputStyle = (r: Row, len: number): React.CSSProperties => {
    const size = labelSize * fit(len);
    return {
      position: 'fixed',
      left: bx(rows[r].lineX0),
      top: by(rows[r].dashY) - size - Math.max(1, size * 0.05),
      width: bx(rows[r].endX) - bx(rows[r].lineX0),
      height: size,
      fontSize: size,
      lineHeight: 1,
    };
  };

  return (
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
          left: bx(rows.submit.lineX0 - 0.02), top: by(rows.submit.yTop),
          width: bx(rows.submit.endX) - bx(rows.submit.lineX0 - 0.02),
          height: by(rows.submit.yBot) - by(rows.submit.yTop),
        }}
        onPointerEnter={() => onSubmitActive(true)}
        onPointerLeave={() => onSubmitActive(false)}
        onFocus={() => onSubmitActive(true)}
        onBlur={() => onSubmitActive(false)}
      >
        <span className="sr-only">Create account or log in</span>
      </button>

      {state?.error ? (
        <p className="splash-fields-error"
          style={{ position: 'fixed', left: bx(0), top: by(1) + 6, width: box.w }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
