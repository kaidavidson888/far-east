'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SplashLoginFields } from './splash/SplashLoginFields';
import {
  splashFrames,
  edgeImage,
  settleImage,
  SPLASH_FORM,
  preloadSplashFrames,
  frameAt,
  coverRect,
  edgeProfileAt,
  SPLASH_GEOM,
  SPLASH_DURATION_MS,
} from '@/lib/splashFrames';

type Phase = 'logo' | 'play' | 'form';

const rampUp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));
const smooth = (t: number) => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c); };
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The layout viewport — what a position:fixed element is sized and placed
// against. NOT window.innerWidth, which counts the classic scrollbar: the page
// under the splash is long, so on a desktop browser that is ~15px wider than the
// box the fixed canvas actually occupies. Sizing the canvas buffer to it while
// CSS stretches the element to the real width squashed everything painted by
// ~3%, and the DOM form (laid out against the true width) then landed a good 6px
// to the right of the ink the canvas had been fading in — the form appeared to
// jump sideways the instant it took over.
const viewport = () => ({
  vw: document.documentElement.clientWidth || window.innerWidth,
  vh: document.documentElement.clientHeight || window.innerHeight,
});

/**
 * The homepage splash: a faithful copy of the source animation, recoloured and
 * sharpened, played at the source scale. The frame sits 1:1 in the middle (the
 * original, untouched); its red design is continued out to the screen edges by
 * tiling the box-free copy, revealed per band from the baked per-frame edge
 * profile so the margins branch outward like water. A radial veil keeps the
 * centre faint and the edges bold, easing in as it grows. On latch the baked
 * black is held for one more frame while SplashLoginFields paints the same
 * content back over it — pixel-exact, from blackbox.webp — and settle.webp then
 * drops the baked copy, so the handover to the working form is invisible.
 */
export function SplashScreen({ next = '', notice = null }: {
  /** Where the reader was when they were stopped, for the form to send them back to. */
  next?: string;
  /** Something to tell them on arrival, from a round trip that ended here. */
  notice?: string | null;
}) {
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
  const inkLayerRef = useRef<HTMLDivElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const fieldOnRef = useRef(false); // a splash text field is focused
  const settleOnRef = useRef(false); // baked black dropped (one frame after the form paints)
  const posRef = useRef(0);
  const dirRef = useRef(0);
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const measure = useCallback(() => {
    const { vw, vh } = viewport();
    const r = coverRect(vw, vh);
    const g = SPLASH_GEOM;
    const w = (g.box.x1 - g.box.x0) * r.w;
    const h = (g.box.y1 - g.box.y0) * r.h;
    // Take the box from the frame's own geometry rather than centring it on the
    // viewport: SPLASH_GEOM.box is not quite symmetric about the frame (its
    // centre is 0.4992, not 0.5), so centring put the DOM box a quarter-pixel
    // right of the baked one it has to sit exactly on top of.
    setBox({ x: r.x + g.box.x0 * r.w, y: r.y + (g.boxDy + g.box.y0) * r.h, w, h });
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
    const { vw, vh } = viewport();
    if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The overlay ink is handed over to DOM elements at latch, and CSS resamples
    // a background-image far better than a default canvas drawImage does. Left at
    // the default 'low', the 215px sprite (and especially the 1538px label art,
    // which lands at ~43px) came out thinner on the canvas than the DOM copy it
    // fades into, so the text appeared to gain weight the moment it latched.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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

    // settle.webp is the same frame with every black part at 0, laid down one
    // frame *after* the DOM form has painted (settleOnRef, flipped by onReady →
    // rAF). The box's own ink is no longer baked into the frames at all, so this
    // now only clears black left anywhere else on the last frame.
    const settle = settleRef.current;
    if (inForm && settleOnRef.current && settle?.complete && settle.naturalWidth) {
      ctx.drawImage(settle, 0, 0, settle.naturalWidth, settle.naturalHeight, r.x, fy, r.w, r.h);
    }

    // Continue the red design out to the screen edges. edge.webp is the box-free
    // final pattern and it tiles horizontally (its left edge matches its right).
    // Each band of the margin is revealed by the baked per-frame edge-coverage
    // profile, so the margins finger outward in the frame's organic shape, like
    // water branching, never a rectangle — and paint() never getImageData's.
    const edge = edgeRef.current;
    const sideM = r.x;
    if (edge?.complete && edge.naturalWidth && sideM > 2) {
      const smoothProfile = (raw: Float32Array) => {
        const n = raw.length;
        const out = new Float32Array(n);
        for (let i = 0; i < n; i += 1) {
          const a = raw[Math.max(0, i - 1)], b = raw[i], c = raw[Math.min(n - 1, i + 1)];
          out[i] = Math.pow(clamp01((a + 2 * b + c) / 4), 0.62);
        }
        return out;
      };
      const left = smoothProfile(edgeProfileAt(ms, 0));
      const right = smoothProfile(edgeProfileAt(ms, 1));

      {
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
          // edge.webp is baked at the FINAL pattern density, but the frames ramp
          // their red in (cloudRise in build-splash-frames.mjs). Match it, or the
          // margins sit at full strength beside a centre that is still ~66%.
          const cloudRise = inForm ? 1 : clamp01(0.12 + 0.88 * Math.pow(p, 0.7));
          // 0 while the design is still travelling, 1 once it has linked up to
          // the screen edges — blends the distance taper away so the extensions
          // end at parity with the centre.
          const connect = inForm ? 1 : smooth(rampUp(p, 0.8, 1));
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

            // Opacity is tied to the spread. Alpha tapers from the frame edge out
            // to the advancing front, so the margin thickens as `reach` grows
            // rather than arriving as a slab; then `connect` — which rises only
            // once the design has actually reached the edges — relaxes the taper
            // away so the extensions finish at the same strength as the centre.
            // At p = 1 connect is 1, so this is continuous into the settled state
            // instead of snapping to full on latch.
            {
              const eX = dir < 0 ? r.x : r.x + r.w;
              const g = octx.createLinearGradient(eX, 0, eX + dir * Math.max(10, mw), 0);
              const N = 10;
              for (let s = 0; s <= N; s += 1) {
                const f = s / N;
                const d = f * mw; // distance out from the frame edge
                const taper = reach > 0 && d <= reach ? Math.pow(1 - d / reach, 1.5) : 0;
                const a = taper + (1 - taper) * connect;
                g.addColorStop(f, `rgba(0,0,0,${a.toFixed(4)})`);
              }
              octx.fillStyle = g;
              octx.fillRect(mx, 0, mw, vh);
            }

            octx.globalCompositeOperation = 'source-over';
            // 'multiply', not 'source-over': edge.webp is ink on white paper, so
            // laying it down normally drags that white field over the margins —
            // a wash the centre, drawn 1:1 into the same white page, never gets.
            // White is multiply's identity, so only the ink lands, and soft ink
            // composites exactly as it would from a transparent tile.
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = cloudRise;
            ctx.drawImage(off, 0, 0, canvas.width, canvas.height, 0, 0, vw, vh);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
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

    // The login box's finished black — labels, ☁, dashed lines — is not baked
    // into the frames any more (only the tendrils that branch toward it are).
    // The DOM overlay carries it for the whole run and this just rides its
    // opacity up, so there is exactly one renderer from the first faint frame to
    // the working form. Drawing a canvas copy during the fade and handing over
    // to the DOM at latch meant two different resamplers on the same artwork —
    // CSS filters a background-image far better than drawImage does, most of all
    // for the 1538px label art landing at ~43px — and the text visibly gained
    // weight the moment it swapped.
    const layer = inkLayerRef.current;
    if (layer) {
      // Only touch the DOM when the number actually moves. The ramp is clamped
      // at 0 for the first 36% of the run and at 1 once latched, so most frames
      // have nothing to say — and a write here invalidates a subtree of a dozen
      // background-image layers whether or not the value changed.
      const next = String(
        inForm ? 1 : smooth(rampUp(p, SPLASH_FORM.fadeFrom, SPLASH_FORM.fadeTo)),
      );
      if (layer.style.opacity !== next) layer.style.opacity = next;
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
          stop();
          settleOnRef.current = false; // hold the baked black until the form has painted
          setPhase('form'); // phaseRef flips synchronously
          paint(posRef.current);
          return;
        }
        paint(posRef.current);
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
      // THE HOLD IS THE DOOR, FOR EVERYONE. This used to include
      // prefers-reduced-motion, so a press jumped straight to the form on any
      // device asking for less motion — which most phones do — and once the
      // long-press was fixed, a tap on a phone went through in a frame with no
      // hold at all. The owner's rule is four seconds on the seal, the whole
      // animation, to reach the login box, on every device. Only the dev flag
      // skips it now.
      process.env.NODE_ENV !== 'production' &&
      new URLSearchParams(window.location.search).has('splashform');

    framesRef.current = splashFrames();
    edgeRef.current = edgeImage();
    settleRef.current = settleImage();
    measure();

    // dev-only: ?splashms=2800 paints one point of the animation and holds;
    // ?splashplay runs it forward from the start without a held pointer, which
    // is the only way to watch the real loop in an automated browser (a
    // scripted pointerdown is cancelled the moment it is dispatched, so it
    // retracts instead of holding).
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
      if (process.env.NODE_ENV !== 'production' && params.has('splashplay')) {
        pressedRef.current = true;
        wantPlayRef.current = true;
        dirRef.current = 1;
        setPhase('play');
        run();
        return;
      }
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
        settleOnRef.current = false; // hold the baked black until the form has painted
        setPhase('form');
        paint(posRef.current);
        return;
      }
      if (!ready) return;
      dirRef.current = 1;
      setPhase('play');
      run();
    },
    [ready, run, setPhase, paint],
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

  // The form has committed and will be in this frame — which still carries the
  // baked black. Drop that on the next one, so exactly one frame shows both.
  const onFormReady = useCallback(() => {
    requestAnimationFrame(() => {
      settleOnRef.current = true;
      paint(SPLASH_DURATION_MS);
    });
  }, [paint]);

  return (
    <div className="splash" role="dialog" aria-label="Enter Far East" data-phase={phase}>
      <canvas ref={canvasRef} className="splash-canvas" aria-hidden="true" />

      {/* One overlay for the whole run: the windows stay mounted from the first
          frame of the animation and paint() rides this wrapper's opacity, so the
          ink is never re-rendered by a different engine partway through. The
          form and its veil only appear once it has latched. */}
      {/* The wrapper carries NO opacity in the JSX on purpose. paint() owns
          that value and writes it every frame; declaring it here too means
          React re-applies its own on every render of this component, so the
          overlay blinks out on any render not immediately followed by a paint
          — the phase flip at latch being exactly that. The ref sets the
          starting 0 instead. */}
      {phase !== 'logo' && (
        <div
          // its own compositor layer: paint() moves this opacity every frame of
          // the fade, and without the hint the browser re-rasterises a dozen
          // background-image children each time instead of just re-blending
          style={{ willChange: 'opacity' }}
          ref={(el) => {
            inkLayerRef.current = el;
            if (el && !el.style.opacity) el.style.opacity = '0';
          }}
        >
          <SplashLoginFields
            box={box}
            next={next}
            notice={notice}
            live={phase === 'form'}
            onFieldFocus={onFieldFocus}
            onReady={onFormReady}
          />
        </div>
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
          // a hold on a phone is a long-press, and a long-press opens the
          // browser's callout or starts a selection — which ends the hold
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </div>
  );
}
