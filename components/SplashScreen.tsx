'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SplashLoginFields } from './splash/SplashLoginFields';
import {
  splashFrames,
  edgeImage,
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
 * sharpened, played at the source scale. The whole frame sits 1:1 in the middle
 * (untouched — the original); a scaled, softened copy of the same pattern
 * (edge.webp, box painted over) sits behind it and the frame's edges feather
 * into it, so the design reads as one branching pattern that grew outward and
 * larger. The login box is rebuilt from loginbox-parts.svg so each part's
 * opacity is independent.
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
  const edgeRef = useRef<HTMLImageElement | null>(null);
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const focusRef = useRef<FocusField>(null);
  const typedRef = useRef({ email: false, password: false }); // which fields have text
  const submitActiveRef = useRef(false);

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = coverRect(vw, vh);
    const g = SPLASH_GEOM;
    // size from the frame, but pin dead-centre on the page
    const w = (g.box.x1 - g.box.x0) * r.w;
    const h = (g.box.y1 - g.box.y0) * r.h;
    setBox({ x: (vw - w) / 2, y: (vh - h) / 2, w, h });
    const s = g.seal.size * r.w;
    setSeal({ x: (vw - s) / 2, y: (vh - s) / 2, s });
  }, []);

  const boxOpacity = useCallback((id: string, fadeIn: number) => {
    if (id === 'border') return fadeIn; // the red outline box: always 100%
    const [kind, row] = id.split('-') as ['line' | 'label' | 'cloud', 'email' | 'password' | 'submit'];
    const inField = focusRef.current === 'email' || focusRef.current === 'password';
    const rowTyped = row !== 'submit' && typedRef.current[row];

    // The ☁ glyphs never react to the submit button — only to a text field.
    if (kind !== 'cloud') {
      // "create account / login" line + label: 100% when the button is hovered
      // or focused, 80% while a text field is in use, else the idle value.
      if (row === 'submit' && submitActiveRef.current) return fadeIn;
      if (row === 'submit' && inField) return fadeIn * 0.8;
      // all three dashed lines, uniform: 100% while a field is in use, else 50%.
      if (kind === 'line') return fadeIn * (inField ? 1 : 0.5);
    }

    // labels + ☁ glyphs: this row's vanish (0) once it has text; any field in
    // use dims the rest to 10%; idle → ☁ 100% / labels 50%.
    if (rowTyped) return 0;
    if (inField) return fadeIn * 0.1;
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
    ctx.fillStyle = '#fcfcfc'; // matches the WebP frames' flat white
    ctx.fillRect(0, 0, vw, vh);

    const img = frames[frameAt(ms)];
    const r = coverRect(vw, vh);
    if (img?.complete && img.naturalWidth) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const p = Math.min(Math.max(ms / SPLASH_DURATION_MS, 0), 1);

      // The frame itself, 1:1 in the centre — the original animation, untouched.
      ctx.drawImage(img, 0, 0, iw, ih, r.x, r.y, r.w, r.h);

      // Continue the pattern to the screen edge by tiling the box-free copy
      // (edge.webp) left and right at the same scale. The design tiles cleanly
      // (its left edge matches its right edge), so this is one seamless pattern —
      // no reflection axis, no overlap. It fades in with the clouds; on a phone
      // the frame fills the width so none of it shows.
      const edge = edgeRef.current;
      // hold the tiles back until the frame's own pattern has spread to its
      // edges, so the margins don't run ahead of the animation
      const edgeA = phaseRef.current === 'form' ? 1 : Math.pow(rampUp(p, 0.58, 0.98), 0.8);
      if (edge?.complete && edge.naturalWidth && edgeA > 0.01 && r.x > 2) {
        const ew = edge.naturalWidth;
        const eh = edge.naturalHeight;
        ctx.save();
        ctx.globalAlpha = edgeA;
        for (let x = r.x + r.w; x < vw + 1; x += r.w) ctx.drawImage(edge, 0, 0, ew, eh, x, r.y, r.w, r.h);
        for (let x = r.x - r.w; x + r.w > -1; x -= r.w) ctx.drawImage(edge, 0, 0, ew, eh, x, r.y, r.w, r.h);
        ctx.restore();
      }

      // Clean white behind the vector login box — a tight rect just inside where
      // its red border draws (dead centre, matching the DOM box), hard-edged so
      // the pattern meets the border with no halo. Ramps in as the box latches.
      const gb = SPLASH_GEOM.box;
      const bw = (gb.x1 - gb.x0) * r.w;
      const bh = (gb.y1 - gb.y0) * r.h;
      const fillA = phaseRef.current === 'form' ? 1 : rampUp(p, 0.78, 0.98);
      if (fillA > 0.001) {
        ctx.save();
        ctx.globalAlpha = fillA;
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect((vw - bw) / 2 + 2, (vh - bh) / 2 + 2, bw - 4, bh - 4);
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
      (!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        // dev-only shortcut to the latched form, for iterating on it
        (process.env.NODE_ENV !== 'production' &&
          new URLSearchParams(window.location.search).has('splashform')));

    framesRef.current = splashFrames();
    edgeRef.current = edgeImage();
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

  const setFieldState = useCallback(
    (val: FocusField, emailTyped: boolean, pwTyped: boolean) => {
      focusRef.current = val;
      typedRef.current = { email: emailTyped, password: pwTyped };
      setTyping(val === 'email' || val === 'password'); // dims the red design to 20%
      applyBox(SPLASH_DURATION_MS);
    },
    [applyBox],
  );

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
          onFieldState={setFieldState}
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
