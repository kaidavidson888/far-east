'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loginAction, type FormState } from '@/app/actions';
import {
  splashFrames,
  preloadSplashFrames,
  frameAt,
  SPLASH_DURATION_MS,
} from '@/lib/splashFrames';

type Phase = 'logo' | 'play' | 'form';

const CANVAS_W = 560; // 1:1 with the baked frames; CSS scales the element
const CANVAS_H = Math.round((CANVAS_W * 1600) / 720); // 1244

/**
 * The homepage splash. The seal is a press-and-hold button: holding grows the
 * login animation, releasing retracts it, and holding the full 4s latches on
 * the last frame with a real sign-in form drawn over it. Shown on every visit
 * to `/`. Under prefers-reduced-motion the animation is skipped — one press
 * jumps straight to the form.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const reducedRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const posRef = useRef(0); // scrub position, ms
  const dirRef = useRef(0); // -1 | 0 | 1
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false); // pressed before the first frame decoded
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const draw = useCallback((ms: number) => {
    const frames = framesRef.current;
    const canvas = canvasRef.current;
    if (!frames.length || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = frames[frameAt(ms)];
    if (img?.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    lastTsRef.current = 0;
  }, []);

  const tick = useCallback(
    (ts: number) => {
      const last = lastTsRef.current || ts;
      const dt = Math.min(ts - last, 64);
      lastTsRef.current = ts;

      posRef.current += dirRef.current * dt;

      if (posRef.current >= SPLASH_DURATION_MS) {
        posRef.current = SPLASH_DURATION_MS;
        draw(posRef.current);
        if (dirRef.current > 0) {
          dirRef.current = 0;
          stop();
          setPhase('form'); // latched on the last frame
          return;
        }
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        draw(posRef.current);
        if (dirRef.current < 0) {
          dirRef.current = 0;
          stop();
          setPhase('logo');
          return;
        }
      } else {
        draw(posRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [draw, stop],
  );

  const run = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    framesRef.current = splashFrames();

    let alive = true;
    preloadSplashFrames().then(() => {
      if (!alive) return;
      setReady(true);
      draw(posRef.current);
      // Someone held the seal before the first frame was paintable.
      if (wantPlayRef.current && pressedRef.current && !reducedRef.current) {
        dirRef.current = 1;
        setPhase('play');
        run();
      }
    });
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw, run]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      // Keep receiving pointerup even if the finger slides off the seal.
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* no active pointer */ }
      pressedRef.current = true;
      wantPlayRef.current = true;

      if (reducedRef.current) {
        posRef.current = SPLASH_DURATION_MS;
        setPhase('form');
        draw(posRef.current);
        return;
      }
      if (!ready) return; // starts once the first frame decodes
      dirRef.current = 1;
      setPhase('play');
      run();
    },
    [ready, run, draw],
  );

  const release = useCallback(() => {
    pressedRef.current = false;
    if (dirRef.current === 0 && posRef.current >= SPLASH_DURATION_MS) return; // latched
    dirRef.current = -1;
    run();
  }, [run]);

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East">
      <div className="splash-stage">
        {/* Frame 0, so the canvas taking over is seamless. */}
        <img className="splash-poster" src="/splash/frames/f000.webp" alt="Far East" />
        <canvas
          ref={canvasRef}
          className="splash-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          aria-hidden="true"
        />
        {phase !== 'form' && (
          <button
            type="button"
            className="splash-seal"
            aria-label="Press and hold to enter Far East"
            onPointerDown={onPointerDown}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
          />
        )}
      </div>
      {/* Outside .splash-stage so the stage's zoom doesn't scale the form. */}
      {phase === 'form' && <SplashLoginForm />}
    </div>
  );
}

/** Sign-in fields positioned over the frozen final frame. */
function SplashLoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <form className="splash-form" action={action}>
      <input type="hidden" name="next" value="/favorites" />
      <label className="splash-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="splash-field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error ? <p className="splash-form-error">{state.error}</p> : null}
      <button type="submit" className="splash-submit">Enter</button>
      <p className="splash-form-alt">
        <Link href="/register">Create an account</Link>
        {' · '}
        <Link href="/catalog">Just browsing</Link>
      </p>
    </form>
  );
}
