'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
export type FocusField = 'email' | 'password' | 'submit' | null;

const rampUp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));
const smoothstep = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

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
  const offRef = useRef<HTMLCanvasElement | null>(null);
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
    // the seal is drawn as part of the frame (nudged down by boxDy), so match it
    const s = g.seal.size * r.w;
    setSeal({ x: (vw - s) / 2, y: (vh - s) / 2 + g.boxDy * r.h, s });
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

  // How far the box has "grown in" from the top — it draws itself downward as
  // the red drain fills it, rather than fading in whole.
  const boxReveal = useCallback(
    (ms: number) =>
      phaseRef.current === 'form' ? 1 : smoothstep(rampUp(ms / SPLASH_DURATION_MS, 0.46, 0.9)),
    [],
  );

  const applyBox = useCallback((ms: number) => {
    const host = boxHostRef.current;
    if (!host) return;
    for (const id of BOX_IDS) {
      const el = host.querySelector<SVGGElement>(`#${id}`);
      if (el) el.style.opacity = String(boxOpacity(id, 1));
    }
    // top-down reveal (soft edge) instead of a flat fade
    const rev = boxReveal(ms);
    const m =
      rev >= 1
        ? 'none'
        : `linear-gradient(to bottom, #000 ${(rev * 116 - 13).toFixed(1)}%, transparent ${(rev * 116 - 1).toFixed(1)}%)`;
    host.style.setProperty('mask-image', m);
    host.style.setProperty('-webkit-mask-image', m);
  }, [boxOpacity, boxReveal]);

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
      const fy = r.y + SPLASH_GEOM.boxDy * r.h; // nudge so the baked box centres on the page

      // The frame itself, 1:1 in the centre — the original animation, untouched.
      ctx.drawImage(img, 0, 0, iw, ih, r.x, fy, r.w, r.h);

      // Continue the pattern to the screen edge by tiling the box-free copy
      // (edge.webp) left and right at the same scale. The design tiles cleanly
      // (its left edge matches its right edge) so this is one seamless pattern —
      // no reflection axis, no overlap. It's not faded in: a soft front spreads
      // outward from the frame edge (horizontal) but only as far *down* as the
      // frame's own pattern has spread (SPLASH_SPREAD), so the margins read as
      // the same pattern flowing outward from the animation, never materialising.
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
          // horizontal: spreading outward from each frame edge
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
          // vertical: only as far down as the frame's own pattern has reached
          const front = fy + vSpread * r.h;
          const gv = octx.createLinearGradient(0, 0, 0, vh);
          gv.addColorStop(0, 'rgba(0,0,0,1)');
          gv.addColorStop(clamp01((front - 55) / vh), 'rgba(0,0,0,1)');
          gv.addColorStop(clamp01(front / vh), 'rgba(0,0,0,0)');
          gv.addColorStop(1, 'rgba(0,0,0,0)');
          octx.fillStyle = gv;
          octx.fillRect(0, 0, vw, vh);

          octx.globalCompositeOperation = 'source-over';
          ctx.drawImage(off, 0, 0, canvas.width, canvas.height, 0, 0, vw, vh);
        }
      }

      // Clean white behind the vector login box, revealed top-down in step with
      // the box (which draws itself downward), so the pattern/drain still shows
      // below the growing edge. Dead centre, matching the DOM box.
      const gb = SPLASH_GEOM.box;
      const bw = (gb.x1 - gb.x0) * r.w;
      const bh = (gb.y1 - gb.y0) * r.h;
      const bx = (vw - bw) / 2;
      const by = (vh - bh) / 2;
      const rev = phaseRef.current === 'form' ? 1 : smoothstep(rampUp(p, 0.46, 0.9));
      if (rev > 0.001) {
        ctx.save();
        if (rev >= 1) {
          ctx.fillStyle = '#fcfcfc';
          ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
        } else {
          const gg = ctx.createLinearGradient(0, by, 0, by + bh);
          const e = rev * 1.08;
          gg.addColorStop(0, '#fcfcfc');
          gg.addColorStop(Math.max(0, Math.min(1, e - 0.06)), '#fcfcfc');
          gg.addColorStop(Math.max(0, Math.min(1, e + 0.06)), 'rgba(252,252,252,0)');
          gg.addColorStop(1, 'rgba(252,252,252,0)');
          ctx.fillStyle = gg;
          ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
        }
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

    // dev-only: ?splashms=2800 paints one point of the animation and holds
    const devMs =
      process.env.NODE_ENV !== 'production'
        ? Number(new URLSearchParams(window.location.search).get('splashms'))
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
