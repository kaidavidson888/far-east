'use client';

import { useActionState, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';
import type { FocusField } from '../SplashScreen';

type Layout = { x: number; y: number; w: number; h: number };
type Row = 'email' | 'password' | 'submit';

const SHRINK_AFTER = 12;
const MIN = 0.42;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(MIN, SHRINK_AFTER / len));

/**
 * Transparent functional inputs laid over the login box in the animation's last
 * frame. Typed text is Cormorant Unicase, no caret, its baseline on the dashed
 * line, starting at the row's tick. The dimming is painted onto the canvas by
 * the parent (the box art is baked into the frame).
 */
export function SplashLoginFields({
  layout,
  onFocusField,
}: {
  layout: Layout;
  onFocusField: (f: FocusField) => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  const { rows } = SPLASH_GEOM;
  const px = (fx: number) => layout.x + fx * layout.w;
  const py = (fy: number) => layout.y + fy * layout.h;
  const base = Math.max(10, layout.w * 0.028);

  // Start the text at the left end of the dashed line; sit it so the bottom of
  // the glyphs is just above the line.
  const rowStyle = (r: Row, len: number): React.CSSProperties => {
    const rw = rows[r];
    const size = base * fit(len);
    return {
      position: 'fixed',
      left: px(rw.lineX0),
      top: py(rw.dashY) - size - Math.max(1, size * 0.08),
      width: px(rw.endX) - px(rw.lineX0),
      height: size,
      fontSize: size,
      lineHeight: 1,
    };
  };

  return (
    <form className="splash-fields" action={action}>
      <input type="hidden" name="next" value="/favorites" />

      <input
        className="splash-field-input" style={rowStyle('email', email.length)}
        name="email" type="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)}
        onFocus={() => onFocusField('email')} onBlur={() => onFocusField(null)} aria-label="Email"
      />
      <input
        className="splash-field-input" style={rowStyle('password', pw.length)}
        name="password" type="password" autoComplete="current-password" required
        value={pw} onChange={(e) => setPw(e.target.value)}
        onFocus={() => onFocusField('password')} onBlur={() => onFocusField(null)} aria-label="Password"
      />
      <button
        type="submit" className="splash-field-submit"
        style={{
          position: 'fixed',
          left: px(rows.submit.lineX0), top: py(rows.submit.yTop),
          width: px(rows.submit.endX) - px(rows.submit.lineX0),
          height: py(rows.submit.yBot) - py(rows.submit.yTop),
        }}
        onFocus={() => onFocusField('submit')} onBlur={() => onFocusField(null)}
      >
        <span className="sr-only">Create account or log in</span>
      </button>

      {state?.error ? (
        <p className="splash-fields-error" style={{ position: 'fixed', left: px(0.28), top: py(0.6), width: px(0.72) - px(0.28) }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
