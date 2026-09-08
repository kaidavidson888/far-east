'use client';

import { useActionState, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';
import type { FocusField } from '../SplashScreen';

type Box = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password' | 'submit';

const SHRINK_AFTER = 14;
const MIN = 0.42;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(MIN, SHRINK_AFTER / len));

/**
 * Transparent functional inputs over the vector login box, positioned in box
 * space. Typed text is Cormorant Unicase, no caret, starting at the left of the
 * row's dashed line at the same size as the box's labels, its baseline just
 * above the line. "create account/login" is a submit button — it signs the user
 * in and sends them to the homepage.
 */
export function SplashLoginFields({
  box,
  onFocusField,
  onSubmitActive,
}: {
  box: Box;
  onFocusField: (f: FocusField, typed: boolean) => void;
  onSubmitActive: (v: boolean) => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<Row | null>(null);

  const { rows } = SPLASH_GEOM;
  const bx = (fx: number) => box.x + fx * box.w;
  const by = (fy: number) => box.y + fy * box.h;
  const labelSize = box.h * 0.1; // ≈ the box's own label cap height

  // Tell the splash which field is in use and whether it has any text yet
  // (box labels sit at 10% on focus, 0 once typing starts).
  const report = (f: Row | null, e: string, p: string) => {
    if (f === 'submit') return; // the button drives onSubmitActive itself
    onFocusField(f, (f === 'email' && e.length > 0) || (f === 'password' && p.length > 0));
  };

  const inputStyle = (r: Row, len: number): React.CSSProperties => {
    const size = labelSize * fit(len);
    return {
      position: 'fixed',
      left: bx(rows[r].lineX0),
      top: by(rows[r].dashY) - size - Math.max(1, size * 0.06),
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
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (focus === 'email') report('email', e.target.value, pw); }}
        onFocus={() => { setFocus('email'); report('email', email, pw); }}
        onBlur={() => { setFocus(null); report(null, email, pw); }}
        aria-label="Email"
      />
      <input
        className="splash-field-input" style={inputStyle('password', pw.length)}
        name="password" type="password" autoComplete="current-password" required
        value={pw}
        onChange={(e) => { setPw(e.target.value); if (focus === 'password') report('password', email, e.target.value); }}
        onFocus={() => { setFocus('password'); report('password', email, pw); }}
        onBlur={() => { setFocus(null); report(null, email, pw); }}
        aria-label="Password"
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
