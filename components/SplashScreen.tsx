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

// Concentric bands of the frame at growing scale — the pattern reads larger
// toward the screen edge, for depth. [scale, featherStart×, opaqueBy×] as
// multiples of the contained frame's half-width; each band is opaque from
// `opaqueBy` outward and feathers in over the inner edge to blend with the
// smaller band (and, for the innermost, with the composition itself).
const BANDS: Array<[number, number, number]> = [
  [1.55, 0.78, 1.28],
  [2.5, 1.35, 2.1],
  [4.2, 2.4, 3.6],
];

/**
 * The homepage splash: a faithful copy of the source animation, recoloured and
 * sharpened, played at the source scale (never zoomed) with the cloud pattern
 * growing outward toward the edges. Frame 0 is the resting state; hold the seal
 * to grow the animation, release to retract, hold 4s to land on the login box.
 */
export function SplashScreen() {
  const [phase, setPhaseState] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [typing, setTyping] = useState(false);

  const reducedRef = useRef(false);
  const phaseRef = useRef<Phase>('logo');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const focusRef = useRef<FocusField>(null);

  const measure = useCallback(() => {
    const r = coverRect(window.innerWidth, window.innerHeight);
    setLayout({ x: r.x, y: r.y, w: r.w, h: r.h });
  }, []);

  const paint = useCallback((ms: number) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || !frames.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    if (!img?.complete || !img.naturalWidth) return;

    const cx = vw / 2;
    const cy = vh / 2;
    const halfW = r.w / 2;
    const { w: iw, h: ih } = SPLASH_GEOM.frame;

    // Perspective bands, drawn largest → smallest, each masked to a feathered
    // ring so the pattern seems to grow outward.
    let off = offRef.current;
    if (!off) { off = document.createElement('canvas'); offRef.current = off; }
    if (off.width !== canvas.width || off.height !== canvas.height) {
      off.width = canvas.width;
      off.height = canvas.height;
    }
    const octx = off.getContext('2d')!;
    for (let k = BANDS.length - 1; k >= 0; k--) {
      const [s, featherAt, opaqueBy] = BANDS[k];
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.globalCompositeOperation = 'source-over';
      octx.clearRect(0, 0, vw, vh);
      octx.drawImage(img, cx - (iw * r.scale * s) / 2, cy - (ih * r.scale * s) / 2, iw * r.scale * s, ih * r.scale * s);
      octx.globalCompositeOperation = 'destination-in';
      const grd = octx.createRadialGradient(cx, cy, halfW * featherAt, cx, cy, halfW * opaqueBy);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,1)'); // opaque from opaqueBy outward
      octx.fillStyle = grd;
      octx.fillRect(0, 0, vw, vh);
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height, 0, 0, vw, vh);
    }

    // The composition itself, at the source scale.
    ctx.drawImage(img, r.x, r.y, r.w, r.h);

    if (phaseRef.current !== 'form') return;

    const { rows, box } = SPLASH_GEOM;
    const px = (fx: number) => r.x + fx * r.w;
    const py = (fy: number) => r.y + fy * r.h;
    const f = focusRef.current;
    const isTyping = f === 'email' || f === 'password';
    const rowKeys = ['email', 'password', 'submit'] as const;

    // While a field is focused the red design drops to 20% — but not the box.
    if (isTyping) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(0, 0, vw, vh);
      ctx.drawImage(
        img,
        box.x0 * img.naturalWidth, box.y0 * img.naturalHeight,
        (box.x1 - box.x0) * img.naturalWidth, (box.y1 - box.y0) * img.naturalHeight,
        px(box.x0), py(box.y0), px(box.x1) - px(box.x0), py(box.y1) - py(box.y0),
      );
    }

    // Row dimming: idle → labels + clouds to 50%; focused → every label to 10%,
    // other rows' line + cloud to 10%, the focused row's line + cloud stay lit.
    ctx.fillStyle = isTyping ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
    rowKeys.forEach((k) => {
      const rw = rows[k];
      const x1 = isTyping && k !== f ? box.x1 : rw.labelX1;
      ctx.fillRect(px(box.x0 + 0.008), py(rw.yTop), px(x1) - px(box.x0 + 0.008), py(rw.yBot) - py(rw.yTop));
    });
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
        if (dirRef.current > 0) { dirRef.current = 0; stop(); setPhase('form'); return; }
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        paint(posRef.current);
        if (dirRef.current < 0) { dirRef.current = 0; stop(); setPhase('logo'); return; }
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

    const onResize = () => { measure(); paint(posRef.current); };
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

  const setFocusField = useCallback((val: FocusField) => {
    focusRef.current = val;
    setTyping(val === 'email' || val === 'password');
    paint(SPLASH_DURATION_MS);
  }, [paint]);

  const r = layout;
  const sealSize = SPLASH_GEOM.seal.size * r.w;
  const sealStyle: React.CSSProperties = {
    left: r.x + SPLASH_GEOM.seal.cx * r.w - sealSize / 2,
    top: r.y + SPLASH_GEOM.seal.cy * r.h - sealSize / 2,
    width: sealSize,
    height: sealSize,
  };

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East" data-phase={phase}>
      <canvas ref={canvasRef} className="splash-canvas" data-typing={typing} aria-hidden="true" />

      {phase !== 'form' && (
        <button
          type="button"
          className="splash-hit"
          style={sealStyle}
          aria-label="Press and hold to enter Far East"
          onPointerDown={onPointerDown}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        />
      )}

      {phase === 'form' && <SplashLoginFields layout={layout} onFocusField={setFocusField} />}
    </div>
  );
}
