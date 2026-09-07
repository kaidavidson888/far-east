'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'fe-splash-seen';
const HOLD_MS = 1100;
const FADE_MS = 420;

type Phase = 'idle' | 'showing' | 'leaving' | 'done';

/**
 * A one-per-session brand splash: the stacked Far East mark on the canvas,
 * held briefly then faded out to reveal the site underneath. Mirrors AgeGate —
 * the server renders nothing, the real decision arrives on hydration — so the
 * splash never ships in the HTML and repeat navigations in the same session
 * skip it. Skipped entirely under prefers-reduced-motion.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('idle');

  const finish = useCallback(() => {
    setPhase('done');
    document.body.style.overflow = '';
    try { sessionStorage.setItem(KEY, 'yes'); } catch { /* storage may be unavailable */ }
  }, []);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === 'yes'; } catch { /* ignore */ }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduced) {
      try { sessionStorage.setItem(KEY, 'yes'); } catch { /* ignore */ }
      return;
    }

    setPhase('showing');
    document.body.style.overflow = 'hidden';
    const toLeaving = setTimeout(() => setPhase('leaving'), HOLD_MS);
    const toDone = setTimeout(finish, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(toLeaving);
      clearTimeout(toDone);
      document.body.style.overflow = '';
    };
  }, [finish]);

  // Let anyone skip the wait.
  const dismiss = useCallback(() => {
    setPhase((p) => (p === 'showing' ? 'leaving' : p));
    setTimeout(finish, FADE_MS);
  }, [finish]);

  if (phase === 'idle' || phase === 'done') return null;

  return (
    <div
      className={`splash${phase === 'leaving' ? ' splash--out' : ''}`}
      aria-hidden="true"
      onClick={dismiss}
    >
      <img
        className="splash-logo"
        src="/logos/far-east-logo-stacked.svg"
        alt=""
        width={132}
        height={179}
      />
    </div>
  );
}
