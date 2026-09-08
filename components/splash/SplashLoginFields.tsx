'use client';

import { useActionState, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';
import { SPLASH_GEOM } from '@/lib/splashFrames';
import type { FocusField } from '../SplashScreen';

type Row = 'email' | 'password' | 'submit';
const ROWS: Row[] = ['email', 'password', 'submit'];

const SHRINK_AFTER = 12;
const MIN = 0.42;
const fit = (len: number) => (len <= SHRINK_AFTER ? 1 : Math.max(MIN, SHRINK_AFTER / len));

/**
 * Transparent functional inputs over the vector login box. Typed text is
 * Cormorant Unicase, no caret, starting at each row's tick. The box art is a
 * single vector, so opacity states are done with white washes:
 *   idle          → labels + clouds at 50%, lines stay 100%
 *   a field focused → every label at 10%, only that row's line + cloud lit
 */
export function SplashLoginFields({
  stageSize,
  onFocusField,
}: {
  stageSize: number;
  onFocusField: (f: FocusField) => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [focus, setFocus] = useState<FocusField>(null);

  const { rows } = SPLASH_GEOM;
  const pct = (v: number) => `${v * 100}%`;
  const setF = (f: FocusField) => { setFocus(f); onFocusField(f); };

  const typing = focus === 'email' || focus === 'password';
  const baseFont = Math.max(10, stageSize * 0.05);
  const ruleW = Math.max(1.6, stageSize * 0.016); // ≈ the red-design line weight

  const rowBox = (r: Row): React.CSSProperties => ({
    left: pct(rows[r].tickX),
    top: pct(rows[r].yTop),
    width: pct(rows[r].endX - rows[r].tickX),
    height: pct(rows[r].yBot - rows[r].yTop),
  });

  // wash opacity + extent per row
  const wash = (r: Row) => {
    if (!typing) return { x1: rows[r].labelX1, o: 0.5 }; // labels/clouds → 50%
    if (r === focus) return { x1: rows[r].labelX1, o: 0.9 }; // focused label → 10%
    return { x1: rows[r].endX, o: 0.9 }; // whole other row → 10%
  };

  return (
    <form className="splash-fields" action={action}>
      <input type="hidden" name="next" value="/favorites" />

      {ROWS.map((r) => {
        const w = wash(r);
        return (
          <div
            key={`w-${r}`}
            className="splash-label-wash"
            style={{
              left: pct(rows[r].tickX),
              width: pct(w.x1 - rows[r].tickX),
              top: pct(rows[r].yTop),
              height: pct(rows[r].yBot - rows[r].yTop),
              opacity: w.o,
            }}
          />
        );
      })}

      {ROWS.map((r) => (
        <div
          key={`r-${r}`}
          className="splash-rule"
          style={{
            left: pct(rows[r].tickX),
            width: pct(rows[r].endX - rows[r].tickX),
            top: pct(rows[r].dashY),
            borderTopWidth: ruleW,
            opacity: typing && r !== focus ? 0.1 : 1,
          }}
        />
      ))}

      <input
        className="splash-field-input"
        style={{ ...rowBox('email'), fontSize: baseFont * fit(email.length) }}
        name="email" type="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)}
        onFocus={() => setF('email')} onBlur={() => setF(null)} aria-label="Email"
      />
      <input
        className="splash-field-input"
        style={{ ...rowBox('password'), fontSize: baseFont * fit(pw.length) }}
        name="password" type="password" autoComplete="current-password" required
        value={pw} onChange={(e) => setPw(e.target.value)}
        onFocus={() => setF('password')} onBlur={() => setF(null)} aria-label="Password"
      />
      <button
        type="submit" className="splash-field-submit" style={rowBox('submit')}
        onFocus={() => setF('submit')} onBlur={() => setF(null)}
      >
        <span className="sr-only">Create account or log in</span>
      </button>

      {state?.error ? <p className="splash-fields-error">{state.error}</p> : null}
    </form>
  );
}
