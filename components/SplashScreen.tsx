'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SplashLoginFields } from './splash/SplashLoginFields';
import {
  splashFrames,
  preloadSplashFrames,
  frameAt,
  coverRect,
  SPLASH_GEOM,
  SPLASH_DURATION_MS,
} from '@/lib/splashFrames';

type Phase = 'logo' | 'play' | 'form';
export type FocusField = 'email' | 'password' | 'submit' | null;

const rampUp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));
const rampDown = (p: number, a: number, b: number) => (p <= a ? 1 : p >= b ? 0 : 1 - (p - a) / (b - a));

/**
 * The homepage splash: the recoloured, sharpened cloud animation with its centre
 * knocked out, and the logo / outline squares / login box drawn on top as vector
 * at the source scale (so they never zoom). Frame 0 is the resting state; hold
 * the seal to grow the clouds, release to retract, hold 4s to land on the box.
 */
export function SplashScreen() {
  const [phase, setPhaseState] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState({ x: 0, y: 0, size: 0 });

  const reducedRef = useRef(false);
  const phaseRef = useRef<Phase>('logo');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const obRedRef = useRef<HTMLSpanElement | null>(null);
  const obBlackRef = useRef<HTMLSpanElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const focusRef = useRef<FocusField>(null);

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Fixed, usable size — not tied to the cloud frame's scale, so it never
    // zooms on wide screens.
    const size = Math.round(Math.max(220, Math.min(vw * 0.62, vh * 0.42, 300)));
    setStage({ x: vw / 2 - size / 2, y: vh / 2 - size / 2, size });
  }, []);

  const paint = useCallback((ms: number) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (canvas && frames.length) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
          canvas.width = Math.round(vw * dpr);
          canvas.height = Math.round(vh * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, vw, vh);

        const img = frames[frameAt(ms)];
        const r = coverRect(vw, vh);
        if (img?.complete && img.naturalWidth) {
          const { w: iw, h: ih } = SPLASH_GEOM.frame;
          const cs = Math.max(vw / iw, vh / ih);
          const cw = iw * cs, ch = ih * cs;
          ctx.drawImage(img, (vw - cw) / 2, (vh - ch) / 2, cw, ch); // reach the edges
          const g = ctx.createRadialGradient(vw / 2, vh / 2, r.w * 0.2, vw / 2, vh / 2, r.w * 0.6);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, vw, vh);
          ctx.drawImage(img, r.x, r.y, r.w, r.h); // the composition at source scale
        }
      }
    }

    // Vector overlay opacities along the timeline.
    const p = ms / SPLASH_DURATION_MS;
    const inForm = phaseRef.current === 'form';
    if (logoRef.current) logoRef.current.style.opacity = String(inForm ? 0 : rampDown(p, 0, 0.12));
    if (obBlackRef.current)
      obBlackRef.current.style.opacity = String(
        inForm ? 0 : Math.min(rampUp(p, 0.08, 0.16), rampDown(p, 0.5, 0.64)),
      );
    if (obRedRef.current)
      obRedRef.current.style.opacity = String(inForm ? 0 : rampUp(p, 0.48, 0.66));
    if (boxRef.current) boxRef.current.style.opacity = String(inForm ? 1 : rampUp(p, 0.88, 1));
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
    [paint, stop, setPhase],
  );

  const run = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    framesRef.current = splashFrames();
    measure();

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

    const onResize = () => {
      measure();
      paint(posRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [measure, paint, run, setPhase]);

  useEffect(() => {
    if (phase === 'form') paint(SPLASH_DURATION_MS);
  }, [phase, paint]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* no pointer */ }
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
    [ready, run, paint, setPhase],
  );

  const release = useCallback(() => {
    pressedRef.current = false;
    if (dirRef.current === 0 && posRef.current >= SPLASH_DURATION_MS) return;
    dirRef.current = -1;
    run();
  }, [run]);

  const [typing, setTyping] = useState(false);
  const setFocusField = useCallback((f: FocusField) => {
    focusRef.current = f;
    setTyping(f === 'email' || f === 'password');
  }, []);

  // Inline the SVGs — <img src> of these does not scale reliably in the dev
  // server, and inlining lets the timeline drive their parts.
  const [logoSvg, setLogoSvg] = useState('');
  const [boxSvg, setBoxSvg] = useState('');
  useEffect(() => {
    fetch('/splash/logo.svg').then((r) => r.text()).then(setLogoSvg).catch(() => {});
    fetch('/splash/loginbox.svg').then((r) => r.text()).then(setBoxSvg).catch(() => {});
  }, []);

  const stageStyle: React.CSSProperties = {
    left: stage.x,
    top: stage.y,
    width: stage.size,
    height: stage.size,
    ['--splash-rule' as string]: `${Math.max(2, stage.size * 0.018)}px`,
  };

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East" data-phase={phase}>
      <canvas ref={canvasRef} className="splash-canvas" data-typing={typing} aria-hidden="true" />

      <div className="splash-stage" style={stageStyle}>
        <div
          ref={logoRef}
          className="splash-logo"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
        <span ref={obRedRef} className="splash-ob splash-ob-red" aria-hidden="true" />
        <span ref={obBlackRef} className="splash-ob splash-ob-black" aria-hidden="true" />
        <div ref={boxRef} className="splash-box">
          <div className="splash-box-face" aria-hidden="true" dangerouslySetInnerHTML={{ __html: boxSvg }} />
          <div className="splash-box-border" aria-hidden="true" />
          {phase === 'form' && (
            <SplashLoginFields stageSize={stage.size} onFocusField={setFocusField} />
          )}
        </div>
      </div>

      {phase !== 'form' && (
        <button
          type="button"
          className="splash-hit"
          style={stageStyle}
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
