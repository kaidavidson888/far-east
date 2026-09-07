'use client';

import { useActionState, useState } from 'react';
import { loginAction, type FormState } from '@/app/actions';

type Field = 'email' | 'password' | 'submit' | null;

// Keep the row's spacing and scale fixed; just shrink the glyphs once the text
// outgrows the space, down to a floor.
const BASE_EM = 1;
const SHRINK_AFTER = 12;
const MIN_EM = 0.42;
const fitEm = (len: number) =>
  len <= SHRINK_AFTER ? BASE_EM : Math.max(MIN_EM, (BASE_EM * SHRINK_AFTER) / len);

function Cloud({ opacity }: { opacity: number }) {
  return (
    <span className="splash-row-cloud" style={{ opacity }}>
      <svg className="splash-cloud" viewBox="0 0 40 20" aria-hidden="true">
        <path
          className="splash-cloud-fill"
          d="M7 19c-3.3 0-6-2.4-6-5.5S3.7 8 7 8c.2 0 .5 0 .7.1C8.4 4.6 11.5 2 15.2 2c2.9 0 5.5 1.6 6.9 4 .8-.6 1.9-1 3-1 2.4 0 4.4 1.7 4.9 4 .5-.2 1.1-.3 1.7-.3 2.9 0 5.3 2.4 5.3 5.3S38.6 19 35.7 19z"
        />
      </svg>
    </span>
  );
}

/**
 * The login box from the animation's final frame, rebuilt as vector DOM so it
 * stays sharp and works. Same footprint as the seal and the outline squares.
 * While a field is focused every label drops to 10% and only that row's dashed
 * line + cloud stay lit. Typed text is Cormorant Unicase, no caret, and shrinks
 * to fit rather than clipping.
 */
export function SplashCard() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  const [focus, setFocus] = useState<Field>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  const typing = focus === 'email' || focus === 'password';
  const word = (row: Exclude<Field, null>) => (!typing || row === 'submit' ? 1 : 0.1);
  const line = (row: Exclude<Field, null>) => (!typing ? 1 : row === focus ? 1 : 0.1);

  return (
    <form className="splash-card" action={action}>
      <input type="hidden" name="next" value="/favorites" />
      <div className="splash-card-inner">
        <label className="splash-row">
          <span className="splash-row-word" style={{ opacity: word('email') }}>Email</span>
          <Cloud opacity={line('email')} />
          <span className="splash-row-rule" style={{ opacity: line('email') }} />
          <input
            className="splash-row-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ['--fit' as string]: fitEm(email.length) }}
            onFocus={() => setFocus('email')}
            onBlur={() => setFocus(null)}
          />
        </label>

        <label className="splash-row">
          <span className="splash-row-word" style={{ opacity: word('password') }}>Password</span>
          <Cloud opacity={line('password')} />
          <span className="splash-row-rule" style={{ opacity: line('password') }} />
          <input
            className="splash-row-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ ['--fit' as string]: fitEm(pw.length) }}
            onFocus={() => setFocus('password')}
            onBlur={() => setFocus(null)}
          />
        </label>

        <button
          type="submit"
          className="splash-row splash-row-submit"
          onFocus={() => setFocus('submit')}
          onBlur={() => setFocus(null)}
        >
          <span className="splash-row-word" style={{ opacity: word('submit') }}>
            create account/login
          </span>
          <Cloud opacity={word('submit')} />
        </button>

        {state?.error ? <p className="splash-card-error">{state.error}</p> : null}
      </div>
    </form>
  );
}
