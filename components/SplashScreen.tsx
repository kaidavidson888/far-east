'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SplashSeal } from './splash/SplashSeal';
import { SplashCard } from './splash/SplashCard';
import {
  splashFrames,
  preloadSplashFrames,
  frameAt,
  SPLASH_DURATION_MS,
} from '@/lib/splashFrames';

type Phase = 'logo' | 'play' | 'form';

const CANVAS_W = 560;
const CANVAS_H = Math.round((CANVAS_W * 1600) / 720); // 1244

// Timeline for the transient outline squares (scrub position, ms).
const rampDown = (t: number, a: number, b: number) =>
  t <= a ? 1 : t >= b ? 0 : 1 - (t - a) / (b - a);
const rampUp = (t: number, a: number, b: number) =>
  t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
const redBoxOpacity = (t: number) => rampDown(t, 200, 1500);
const blackBoxOpacity = (t: number) =>
  Math.min(rampUp(t, 250, 850), rampDown(t, 3000, 3800));

/**
 * The homepage splash. The seal is a press-and-hold button: holding grows the
 * cloud animation forward, releasing retracts it, holding the full 4s latches on
 * the last frame with a real sign-in card. The seal, the transient outline
 * squares and the card are all vector DOM at the same centred size; only the
 * clouds come from raster frames (their centre is knocked out to white).
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const reducedRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const redBoxRef = useRef<HTMLSpanElement | null>(null);
  const blackBoxRef = useRef<HTMLSpanElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const posRef = useRef(0);
  const dirRef = useRef(0); // -1 | 0 | 1
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const paint = useCallback((ms: number) => {
    const frames = framesRef.current;
    const canvas = canvasRef.current;
    if (frames.length && canvas) {
      const ctx = canvas.getContext('2d');
      const img = frames[frameAt(ms)];
      if (ctx && img?.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }
    if (redBoxRef.current) redBoxRef.current.style.opacity = String(redBoxOpacity(ms));
    if (blackBoxRef.current) blackBoxRef.current.style.opacity = String(blackBoxOpacity(ms));
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
        paint(posRef.current);
        if (dirRef.current > 0) {
          dirRef.current = 0;
          stop();
          setPhase('form');
          return;
        }
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        paint(posRef.current);
        if (dirRef.current < 0) {
          dirRef.current = 0;
          stop();
          setPhase('logo');
          return;
        }
      } else {
        paint(posRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [paint, stop],
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
      paint(posRef.current);
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
  }, [paint, run]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* no active pointer */ }
      pressedRef.current = true;
      wantPlayRef.current = true;

      if (reducedRef.current) {
        posRef.current = SPLASH_DURATION_MS;
        setPhase('form');
        paint(posRef.current);
        return;
      }
      if (!ready) return;
      dirRef.current = 1;
      setPhase('play');
      run();
    },
    [ready, run, paint],
  );

  const release = useCallback(() => {
    pressedRef.current = false;
    if (dirRef.current === 0 && posRef.current >= SPLASH_DURATION_MS) return;
    dirRef.current = -1;
    run();
  }, [run]);

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East">
      <canvas
        ref={canvasRef}
        className="splash-clouds"
        width={CANVAS_W}
        height={CANVAS_H}
        data-lit={phase !== 'logo'}
        aria-hidden="true"
      />

      <div className="splash-box">
        <div className="splash-layer" data-show={phase === 'logo'}>
          <SplashSeal />
        </div>

        <div className="splash-layer" data-show={phase === 'play'} aria-hidden="true">
          <span ref={redBoxRef} className="splash-outline splash-outline-red" />
          <span ref={blackBoxRef} className="splash-outline splash-outline-black" />
        </div>

        <div className="splash-layer" data-show={phase === 'form'}>
          {phase === 'form' && <SplashCard />}
        </div>
      </div>

      {phase !== 'form' && (
        <button
          type="button"
          className="splash-hit"
          aria-label="Press and hold to enter Far East"
          onPointerDown={onPointerDown}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        />
      )}
    </div>
  );
}
