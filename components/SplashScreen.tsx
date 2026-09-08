'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const BOX_IDS = [
  'border',
  'line-email', 'line-password', 'line-submit',
  'label-email', 'label-password', 'label-submit',
  'cloud-email', 'cloud-password', 'cloud-submit',
];

/**
 * The homepage splash: a faithful copy of the source animation, recoloured and
 * sharpened, played at the source scale. The whole frame sits 1:1 in the middle;
 * its left/right cloud strips are mirror-repeated outward — one continuous
 * branching design, growing a little toward the screen edge for depth. The login
 * box is rebuilt from loginbox-parts.svg so each part's opacity is independent.
 */
export function SplashScreen() {
  const [phase, setPhaseState] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [seal, setSeal] = useState({ x: 0, y: 0, s: 0 });
  const [typing, setTyping] = useState(false);
  const [boxSvg, setBoxSvg] = useState('');

  const reducedRef = useRef(false);
  const phaseRef = useRef<Phase>('logo');
  const setPhase = useCallback((p: Phase) => { phaseRef.current = p; setPhaseState(p); }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxHostRef = useRef<HTMLDivElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const focusRef = useRef<FocusField>(null);
  const typedRef = useRef(false); // the focused field has at least one character
  const submitActiveRef = useRef(false);

  const measure = useCallback(() => {
    const r = coverRect(window.innerWidth, window.innerHeight);
    const g = SPLASH_GEOM;
    setBox({
      x: r.x + g.box.x0 * r.w,
      y: r.y + g.box.y0 * r.h,
      w: (g.box.x1 - g.box.x0) * r.w,
      h: (g.box.y1 - g.box.y0) * r.h,
    });
    const s = g.seal.size * r.w;
    setSeal({ x: r.x + g.seal.cx * r.w - s / 2, y: r.y + g.seal.cy * r.h - s / 2, s });
  }, []);

  const boxOpacity = useCallback((id: string, fadeIn: number) => {
    if (id === 'border') return fadeIn; // the red outline box: always 100%
    const [kind, row] = id.split('-');
    const inField = focusRef.current === 'email' || focusRef.current === 'password';

    // "create account / login" row: 100% when the button itself is hovered or
    // focused; 80% while a text field is in use; otherwise the idle values.
    if (row === 'submit' && submitActiveRef.current) return fadeIn;
    if (row === 'submit' && inField) return fadeIn * 0.8;

    // all three dashed lines, uniform: 100% while a field is in use, else 50%.
    if (kind === 'line') return fadeIn * (inField ? 1 : 0.5);

    // labels + ☁ glyphs: 10% once a field is focused, 0 once it has text,
    // and idle → ☁ 100% / labels 50%.
    if (inField) return fadeIn * (typedRef.current ? 0 : 0.1);
    return fadeIn * (kind === 'cloud' ? 1 : 0.5);
  }, []);

  const applyBox = useCallback((ms: number) => {
    const host = boxHostRef.current;
    if (!host) return;
    const fadeIn = phaseRef.current === 'form' ? 1 : rampUp(ms / SPLASH_DURATION_MS, 0.84, 1);
    for (const id of BOX_IDS) {
      const el = host.querySelector<SVGGElement>(`#${id}`);
      if (el) el.style.opacity = String(boxOpacity(id, fadeIn));
    }
  }, [boxOpacity]);

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
    if (img?.complete && img.naturalWidth) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const fcy = r.y + r.h / 2;

      // One continuous branching pattern out to the screen edge. The whole frame
      // sits 1:1 in the middle (untouched — this is the original animation). Its
      // left/right edge strips — pure cloud, no logo — are then mirror-repeated
      // sideways to fill the margins: reflections meet exactly so there are no
      // seams or cross-fades, and each strip out is a little larger for a hint of
      // depth. On a phone the frame already fills the width, so none of this
      // shows; it only fills a wide screen's side margins. Above/below, the frame
      // itself is mirrored (its centre lands off-screen on any real viewport).
      const SW = 0.29; // side-strip depth as a fraction of the frame width (clears the logo)
      const P = 1.2;   // each strip outward this much larger (perspective toward the edges)

      // draw source column [srcX0..srcX1] of the frame, mirror-tiled vertically
      // to fill the height, into a screen column at screenX of width cellW.
      const column = (
        screenX: number, cellW: number, unit: number,
        srcX0: number, srcX1: number, flipX: boolean,
      ) => {
        const rings: { cy: number; flip: boolean }[] = [{ cy: fcy, flip: false }];
        let e = fcy + unit / 2;
        for (let k = 1; k < 7 && e < vh + 4; k++) { rings.push({ cy: e + unit / 2, flip: k % 2 === 1 }); e += unit; }
        e = fcy - unit / 2;
        for (let k = 1; k < 7 && e > -4; k++) { rings.push({ cy: e - unit / 2, flip: k % 2 === 1 }); e -= unit; }
        for (const rg of rings) {
          ctx.save();
          ctx.translate(screenX + cellW / 2, rg.cy);
          ctx.scale(flipX ? -1 : 1, rg.flip ? -1 : 1);
          ctx.drawImage(img, srcX0, 0, srcX1 - srcX0, ih, -cellW / 2, -unit / 2, cellW, unit);
          ctx.restore();
        }
      };

      column(r.x, r.w, r.h, 0, iw, false); // the frame itself, 1:1
      for (const dir of [1, -1]) {
        let ex = dir > 0 ? r.x + r.w : r.x;
        for (let k = 1; k < 8; k++) {
          const w = SW * r.w * Math.pow(P, k - 1);
          const unit = r.h * Math.pow(P, k - 1);
          if (dir < 0) ex -= w;
          column(ex, w, unit, dir > 0 ? iw * (1 - SW) : 0, dir > 0 ? iw : iw * SW, k % 2 === 1);
          if (dir > 0) ex += w;
          if (dir > 0 ? ex > vw + 4 : ex < -4) break;
        }
      }

      // Clear the login-box footprint to clean white for the vector box on top
      // (the frames still bake the original box; tiled copies would otherwise
      // smear it across the margin). Soft-edged, ramping in as the box latches.
      const gb = SPLASH_GEOM.box;
      const bw = (gb.x1 - gb.x0) * r.w;
      const bh = (gb.y1 - gb.y0) * r.h;
      const bcx = r.x + ((gb.x0 + gb.x1) / 2) * r.w;
      const bcy = r.y + ((gb.y0 + gb.y1) / 2) * r.h;
      const clearA =
        phaseRef.current === 'form' ? 1 : rampUp(ms / SPLASH_DURATION_MS, 0.76, 0.94);
      if (clearA > 0) {
        const m = Math.min(bw, bh) * 0.12;
        ctx.save();
        ctx.filter = 'blur(6px)';
        ctx.fillStyle = `rgba(255,255,255,${clearA})`;
        ctx.fillRect(bcx - bw / 2 - m, bcy - bh / 2 - m, bw + 2 * m, bh + 2 * m);
        ctx.restore();
      }
    }
    applyBox(ms);
  }, [applyBox]);

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
    fetch('/splash/loginbox-parts.svg').then((res) => res.text()).then(setBoxSvg).catch(() => {});

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

  const setFocusField = useCallback((val: FocusField, typed = false) => {
    focusRef.current = val;
    typedRef.current = typed;
    setTyping(val === 'email' || val === 'password'); // dims the red design to 20%
    applyBox(SPLASH_DURATION_MS);
  }, [applyBox]);

  const setSubmitActive = useCallback((v: boolean) => {
    submitActiveRef.current = v;
    applyBox(SPLASH_DURATION_MS);
  }, [applyBox]);

  // Stable object so React doesn't re-set innerHTML on every render (which would
  // wipe the per-group opacities we drive imperatively).
  const boxHtml = useMemo(() => ({ __html: boxSvg }), [boxSvg]);
  // Re-apply opacities after the SVG is (re)inlined (fresh <g>s start hidden).
  useEffect(() => { if (boxSvg) applyBox(posRef.current); }, [boxSvg, applyBox]);

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East" data-phase={phase}>
      <canvas ref={canvasRef} className="splash-canvas" data-typing={typing} aria-hidden="true" />

      <div
        ref={boxHostRef}
        className="splash-box"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        dangerouslySetInnerHTML={boxHtml}
      />
      {phase === 'form' && (
        <SplashLoginFields
          box={box}
          onFocusField={setFocusField}
          onSubmitActive={setSubmitActive}
        />
      )}

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
