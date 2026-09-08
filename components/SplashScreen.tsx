'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SplashLoginFields } from './splash/SplashLoginFields';
import {
  splashFrames,
  edgeImage,
  preloadSplashFrames,
  frameAt,
  coverRect,
  spreadAt,
  SPLASH_GEOM,
  SPLASH_DURATION_MS,
} from '@/lib/splashFrames';

type Phase = 'logo' | 'play' | 'form';

const rampUp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));

/**
 * The homepage splash: a faithful copy of the source animation, recoloured and
 * sharpened, played at the source scale. The whole frame sits 1:1 in the middle
 * (the original, untouched) and its cloud strips are tiled outward so the design
 * continues to the screen edge. The login box you see is the one baked into the
 * last frame; once the form is up SplashLoginFields wipes its interior clean
 * (just the baked red border stays) and lays transparent inputs over it.
 */
export function SplashScreen() {
  const [phase, setPhaseState] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [seal, setSeal] = useState({ x: 0, y: 0, s: 0 });

  const reducedRef = useRef(false);
  const phaseRef = useRef<Phase>('logo');
  const setPhase = useCallback((p: Phase) => { phaseRef.current = p; setPhaseState(p); }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const edgeRef = useRef<HTMLImageElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = coverRect(vw, vh);
    const g = SPLASH_GEOM;
    const w = (g.box.x1 - g.box.x0) * r.w;
    const h = (g.box.y1 - g.box.y0) * r.h;
    // the box + seal are drawn as part of the frame, at its centre
    setBox({ x: (vw - w) / 2, y: (vh - h) / 2 + g.boxDy * r.h, w, h });
    const s = g.seal.size * r.w;
    setSeal({ x: (vw - s) / 2, y: (vh - s) / 2 + g.boxDy * r.h, s });
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
    ctx.fillStyle = '#fcfcfc'; // matches the WebP frames' flat white
    ctx.fillRect(0, 0, vw, vh);

    const img = frames[frameAt(ms)];
    const r = coverRect(vw, vh);
    if (!img?.complete || !img.naturalWidth) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const p = Math.min(Math.max(ms / SPLASH_DURATION_MS, 0), 1);
    const fy = r.y + SPLASH_GEOM.boxDy * r.h;

    // The frame itself, 1:1 in the centre — the original animation, untouched.
    ctx.drawImage(img, 0, 0, iw, ih, r.x, fy, r.w, r.h);

    // Continue the pattern to the screen edge by tiling the box-free copy
    // (edge.webp) left and right at the same scale — its left edge matches its
    // right, so it's one seamless pattern with no reflection axis or overlap. A
    // soft front spreads it outward from each frame edge (horizontal), but only
    // as far *down* as the frame's own pattern has reached its edge
    // (SPLASH_SPREAD), so the margins grow with the animation, never materialise.
    const edge = edgeRef.current;
    const sideM = r.x;
    const inForm = phaseRef.current === 'form';
    const vSpread = inForm ? 1.2 : spreadAt(ms);
    const hSpread = inForm ? 1 : Math.pow(rampUp(p, 0.38, 0.95), 0.9);
    if (edge?.complete && edge.naturalWidth && vSpread > 0.02 && sideM > 2) {
      const off = offRef.current ?? (offRef.current = document.createElement('canvas'));
      if (off.width !== canvas.width || off.height !== canvas.height) {
        off.width = canvas.width;
        off.height = canvas.height;
      }
      const octx = off.getContext('2d');
      if (octx) {
        const ew = edge.naturalWidth;
        const eh = edge.naturalHeight;
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.globalCompositeOperation = 'source-over';
        octx.clearRect(0, 0, vw, vh);
        for (let x = r.x + r.w; x < vw + 1; x += r.w) octx.drawImage(edge, 0, 0, ew, eh, x, fy, r.w, r.h);
        for (let x = r.x - r.w; x + r.w > -1; x -= r.w) octx.drawImage(edge, 0, 0, ew, eh, x, fy, r.w, r.h);

        octx.globalCompositeOperation = 'destination-in';
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        const reach = hSpread * sideM + 10;
        const feat = Math.min(reach, 70);
        const fL = r.x - reach;
        const fR = r.x + r.w + reach;
        const gh = octx.createLinearGradient(0, 0, vw, 0);
        gh.addColorStop(0, 'rgba(0,0,0,0)');
        gh.addColorStop(clamp01(fL / vw), 'rgba(0,0,0,0)');
        gh.addColorStop(clamp01((fL + feat) / vw), 'rgba(0,0,0,1)');
        gh.addColorStop(clamp01((fR - feat) / vw), 'rgba(0,0,0,1)');
        gh.addColorStop(clamp01(fR / vw), 'rgba(0,0,0,0)');
        gh.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = gh;
        octx.fillRect(0, 0, vw, vh);

        const front = fy + vSpread * r.h;
        const gv = octx.createLinearGradient(0, 0, 0, vh);
        gv.addColorStop(0, 'rgba(0,0,0,1)');
        gv.addColorStop(clamp01((front - 55) / vh), 'rgba(0,0,0,1)');
        gv.addColorStop(clamp01(front / vh), 'rgba(0,0,0,0)');
        gv.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = gv;
        octx.fillRect(0, 0, vw, vh);

        octx.globalCompositeOperation = 'source-over';
        // The tile is baked at the final pattern density; the frame's own clouds
        // are still rising (cloudRise in build-splash-frames.mjs). Match that so
        // the margins share the frame edge's exact weight — no denser column
        // "materialising" beside a fainter frame.
        const cloudRise = inForm ? 1 : Math.min(1, 0.12 + 0.88 * Math.pow(p, 0.7));
        ctx.globalAlpha = cloudRise;
        ctx.drawImage(off, 0, 0, canvas.width, canvas.height, 0, 0, vw, vh);
        ctx.globalAlpha = 1;
      }
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
      (!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        (process.env.NODE_ENV !== 'production' &&
          new URLSearchParams(window.location.search).has('splashform')));

    framesRef.current = splashFrames();
    edgeRef.current = edgeImage();
    measure();

    // dev-only: ?splashms=2800 paints one point of the animation and holds
    const params = new URLSearchParams(window.location.search);
    const devMs =
      process.env.NODE_ENV !== 'production' && params.has('splashms')
        ? Number(params.get('splashms'))
        : NaN;

    let alive = true;
    preloadSplashFrames().then(() => {
      if (!alive) return;
      setReady(true);
      if (Number.isFinite(devMs)) {
        posRef.current = Math.max(0, Math.min(SPLASH_DURATION_MS, devMs));
        setPhase('play');
        paint(posRef.current);
        Promise.all(framesRef.current.map((im) => im.decode().catch(() => {}))).then(
          () => alive && paint(posRef.current),
        );
        return;
      }
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

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East" data-phase={phase}>
      <canvas ref={canvasRef} className="splash-canvas" aria-hidden="true" />

      {phase === 'form' && <SplashLoginFields box={box} />}

      {phase !== 'form' && (
        <button
          type="button"
          className="splash-hit"
          style={{ left: seal.x, top: seal.y, width: seal.s, height: seal.s }}
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
