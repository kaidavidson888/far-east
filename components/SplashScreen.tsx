'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SplashLoginFields } from './splash/SplashLoginFields';
import {
  splashFrames,
  edgeImage,
  settleImage,
  preloadSplashFrames,
  frameAt,
  coverRect,
  SPLASH_GEOM,
  SPLASH_DURATION_MS,
} from '@/lib/splashFrames';

const SETTLE_MS = 480; // black cross-fades to 0 over this once the form latches

type Phase = 'logo' | 'play' | 'form';

const rampUp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));
const smooth = (t: number) => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c); };
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The homepage splash: a faithful copy of the source animation, recoloured and
 * sharpened, played at the source scale. The frame sits 1:1 in the middle (the
 * original, untouched); its red design is continued out to the screen edges by
 * tiling the box-free copy, revealed per horizontal band from how far the
 * frame's own edge has grown so the margins branch outward like water. A radial
 * veil keeps the centre faint and the edges bold, easing in as it grows. Once
 * the animation latches, settle.webp cross-fades over the frame (all the baked
 * black → 0) and SplashLoginFields shows the box's own black content back —
 * pixel-exact, from blackbox.webp — with working inputs over it.
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
  const settleRef = useRef<HTMLImageElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const fieldOnRef = useRef(false); // a splash text field is focused
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const formAtRef = useRef(0); // performance.now() when the form latched
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
    const inForm = phaseRef.current === 'form';

    // The frame itself, 1:1 in the centre — the original animation, untouched.
    ctx.drawImage(img, 0, 0, iw, ih, r.x, fy, r.w, r.h);

    // Once latched, cross-fade settle.webp (same frame, every black part at 0)
    // over it, so the baked black — the login-box labels, ☁ and dashes — fades
    // to nothing in place. The crisp vector version comes back on top, in DOM.
    const settle = settleRef.current;
    if (inForm && settle?.complete && settle.naturalWidth) {
      const sf = clamp01((performance.now() - formAtRef.current) / SETTLE_MS);
      if (sf > 0) {
        ctx.globalAlpha = sf;
        ctx.drawImage(settle, 0, 0, settle.naturalWidth, settle.naturalHeight, r.x, fy, r.w, r.h);
        ctx.globalAlpha = 1;
      }
    }

    // Continue the red design out to the screen edges. edge.webp is the box-free
    // final pattern and it tiles horizontally (its left edge matches its right).
    // Each horizontal band of the margin is revealed by how filled-in the
    // frame's own edge column is at that band — so the margins finger outward in
    // the frame's organic shape, like water branching, never as a rectangle.
    const edge = edgeRef.current;
    const sideM = r.x;
    if (edge?.complete && edge.naturalWidth && sideM > 2) {
      const BANDS = 120;
      const readCol = (cssX: number): Float32Array | null => {
        const x0 = Math.max(0, Math.min(canvas.width - 4, Math.round(cssX * dpr)));
        const y0 = Math.max(0, Math.round(fy * dpr));
        const w = Math.max(1, Math.round(4 * dpr));
        const h = Math.min(canvas.height - y0, Math.round(r.h * dpr));
        if (h < BANDS) return null;
        let d: Uint8ClampedArray;
        try { d = ctx.getImageData(x0, y0, w, h).data; } catch { return null; }
        const raw = new Float32Array(BANDS);
        const per = h / BANDS;
        for (let bnd = 0; bnd < BANDS; bnd++) {
          let hit = 0, tot = 0;
          const ya = Math.floor(bnd * per), yb = Math.max(ya + 1, Math.floor((bnd + 1) * per));
          for (let y = ya; y < yb; y++) {
            for (let xx = 0; xx < w; xx++) {
              const i = (y * w + xx) * 4;
              tot++;
              if (d[i] - d[i + 1] > 26 && d[i] > 120) hit++;
            }
          }
          raw[bnd] = tot ? hit / tot : 0;
        }
        const out = new Float32Array(BANDS); // soften so bands read as fingers
        for (let i = 0; i < BANDS; i++) {
          const a = raw[Math.max(0, i - 1)], b = raw[i], c = raw[Math.min(BANDS - 1, i + 1)];
          out[i] = Math.pow(clamp01((a + 2 * b + c) / 4), 0.62);
        }
        return out;
      };
      const left = readCol(r.x + 3);
      const right = readCol(r.x + r.w - 7);

      if (left && right) {
        const off = offRef.current ?? (offRef.current = document.createElement('canvas'));
        if (off.width !== canvas.width || off.height !== canvas.height) {
          off.width = canvas.width;
          off.height = canvas.height;
        }
        const octx = off.getContext('2d');
        if (octx) {
          const ew = edge.naturalWidth;
          const eh = edge.naturalHeight;
          const maskCanvas = (prof: Float32Array) => {
            const m = document.createElement('canvas');
            m.width = 1;
            m.height = prof.length;
            const mc = m.getContext('2d')!;
            const id = mc.createImageData(1, prof.length);
            for (let i = 0; i < prof.length; i++) id.data[i * 4 + 3] = Math.round((inForm ? 1 : prof[i]) * 255);
            mc.putImageData(id, 0, 0);
            return m;
          };
          // how far the water has pushed out from each frame edge (grows over
          // the run, full once latched)
          const reach = inForm ? vw : Math.pow(rampUp(p, 0.34, 0.98), 0.8) * (sideM + 70);
          // each side, self-contained — a second destination-in over the whole
          // offscreen would wipe the first side's result.
          const drawSide = (dir: -1 | 1, prof: Float32Array) => {
            octx.setTransform(dpr, 0, 0, dpr, 0, 0);
            octx.imageSmoothingEnabled = true;
            octx.globalCompositeOperation = 'source-over';
            octx.clearRect(0, 0, vw, vh);
            if (dir < 0) for (let x = r.x - r.w; x + r.w > -1; x -= r.w) octx.drawImage(edge, 0, 0, ew, eh, x, fy, r.w, r.h);
            else for (let x = r.x + r.w; x < vw + 1; x += r.w) octx.drawImage(edge, 0, 0, ew, eh, x, fy, r.w, r.h);

            const mx = dir < 0 ? 0 : r.x + r.w;
            const mw = dir < 0 ? r.x : vw - (r.x + r.w);
            octx.globalCompositeOperation = 'destination-in';
            octx.drawImage(maskCanvas(prof), 0, 0, 1, prof.length, mx, fy, mw, r.h);

            if (reach < mw + 80) {
              const eX = dir < 0 ? r.x : r.x + r.w;
              const g = octx.createLinearGradient(eX, 0, eX + dir * (reach + 60), 0);
              g.addColorStop(0, 'rgba(0,0,0,1)');
              g.addColorStop(clamp01(reach / (reach + 60)), 'rgba(0,0,0,1)');
              g.addColorStop(1, 'rgba(0,0,0,0)');
              octx.fillStyle = g;
              octx.fillRect(mx, 0, mw, vh);
            }

            octx.globalCompositeOperation = 'source-over';
            ctx.drawImage(off, 0, 0, canvas.width, canvas.height, 0, 0, vw, vh);
          };
          drawSide(-1, left);
          drawSide(1, right);
        }
      }
    }

    // Permanent "faint centre, bold edges": a radial veil of the page colour
    // that eases in as the design grows and stays for the resting state. The
    // login box sits in a calm halo; the red intensifies to full where it meets
    // the screen edge. While a text field is focused the very centre clears so
    // the red outline box reads at 100%.
    const vig = inForm ? 1 : smooth(rampUp(p, 0.18, 1));
    if (vig > 0.005) {
      const cx = vw / 2;
      const cy = vh / 2;
      const maxR = Math.hypot(vw, vh) / 2;
      const lit = fieldOnRef.current;
      const g = ctx.createRadialGradient(cx, cy, Math.min(vw, vh) * 0.09, cx, cy, maxR);
      g.addColorStop(0, `rgba(252,252,252,${(lit ? 0 : 0.34) * vig})`); // box outline
      g.addColorStop(0.26, `rgba(252,252,252,${(lit ? 0.12 : 0.52) * vig})`); // halo
      g.addColorStop(0.72, `rgba(252,252,252,${0.05 * vig})`);
      g.addColorStop(1, 'rgba(252,252,252,0)'); // screen edge: full strength
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
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
        if (dirRef.current > 0) {
          dirRef.current = 0;
          if (phaseRef.current !== 'form') { formAtRef.current = ts; setPhase('form'); }
        }
        paint(posRef.current);
        // keep painting through the settle cross-fade, then idle
        if (dirRef.current === 0 && ts - formAtRef.current > SETTLE_MS + 80) { stop(); return; }
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
    settleRef.current = settleImage();
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
        dirRef.current = 0;
        formAtRef.current = performance.now();
        setPhase('form');
        run(); // paints the settle cross-fade, then idles
        return;
      }
      if (!ready) return;
      dirRef.current = 1;
      setPhase('play');
      run();
    },
    [ready, run, setPhase],
  );

  const release = useCallback(() => {
    pressedRef.current = false;
    if (dirRef.current === 0 && posRef.current >= SPLASH_DURATION_MS) return;
    dirRef.current = -1;
    run();
  }, [run]);

  // the form tells us when a text field is focused so the vignette can clear the
  // centre (red outline box → 100%); repaint since the rAF loop has stopped
  const onFieldFocus = useCallback((on: boolean) => {
    if (fieldOnRef.current === on) return;
    fieldOnRef.current = on;
    paint(posRef.current || SPLASH_DURATION_MS);
  }, [paint]);

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East" data-phase={phase}>
      <canvas ref={canvasRef} className="splash-canvas" aria-hidden="true" />

      {phase === 'form' && <SplashLoginFields box={box} onFieldFocus={onFieldFocus} />}

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
