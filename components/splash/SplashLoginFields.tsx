'use client';

import { useActionState, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';
import type { FocusField } from '../SplashScreen';

type Layout = { x: number; y: number; w: number; h: number; vw: number; vh: number };

// Shrink the glyphs once the text outgrows the row, down to a floor — the row's
// position and the space it occupies don't change.
const SHRINK_AFTER = 12;
const MIN = 0.42;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(MIN, SHRINK_AFTER / len));

/**
 * Transparent, functional inputs laid exactly over the login box drawn in the
 * animation's last frame. Typed text is Cormorant Unicase with no caret; the
 * row-dimming on focus is painted onto the canvas by the parent.
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

  // Typing starts at the tick where the dashed line begins.
  const rowStyle = (row: keyof typeof rows): React.CSSProperties => {
    const r = rows[row];
    return {
      position: 'fixed',
      left: px(r.tickX),
      top: py(r.yTop),
      width: px(r.endX) - px(r.tickX),
      height: py(r.yBot) - py(r.yTop),
    };
  };
  // Scale the text to the box so it matches the baked labels.
  const baseFont = Math.max(12, layout.w * 0.03);

  return (
    <form className="splash-fields" action={action}>
      <input type="hidden" name="next" value="/favorites" />

      <input
        className="splash-field-input"
        style={{ ...rowStyle('email'), fontSize: baseFont * fit(email.length) }}
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onFocus={() => onFocusField('email')}
        onBlur={() => onFocusField(null)}
        aria-label="Email"
      />

      <input
        className="splash-field-input"
        style={{ ...rowStyle('password'), fontSize: baseFont * fit(pw.length) }}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onFocus={() => onFocusField('password')}
        onBlur={() => onFocusField(null)}
        aria-label="Password"
      />

      <button
        type="submit"
        className="splash-field-submit"
        style={rowStyle('submit')}
        onFocus={() => onFocusField('submit')}
        onBlur={() => onFocusField(null)}
      >
        <span className="sr-only">Create account or log in</span>
      </button>

      {state?.error ? (
        <p
          className="splash-fields-error"
          style={{ position: 'fixed', left: px(0.3), top: py(0.585), width: px(0.7) - px(0.3) }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
