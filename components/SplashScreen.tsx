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

/**
 * The homepage splash: a faithful copy of the source animation, recoloured and
 * sharpened. Frame 0 is the resting state; press and hold the seal to scrub the
 * clouds forward, release to retract, hold the full 4s to land on the last
 * frame — where the login box becomes real inputs.
 */
export function SplashScreen() {
  const [phase, setPhaseState] = useState<Phase>('logo');
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 });
  const reducedRef = useRef(false);
  const phaseRef = useRef<Phase>('logo');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const posRef = useRef(0);
  const dirRef = useRef(0); // -1 | 0 | 1
  const pressedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const focusRef = useRef<FocusField>(null);

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = coverRect(vw, vh);
    setLayout({ ...r, vw, vh });
    return { vw, vh, r };
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
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, vw, vh);

    const img = frames[frameAt(ms)];
    const r = coverRect(vw, vh); // the frame, contained + centred (source scale)
    if (img?.complete && img.naturalWidth) {
      // Background: the same frame scaled to COVER, so the red design reaches
      // every screen edge. Its centre is softly erased so the zoomed-up
      // composition there doesn't show behind the real one.
      const { w: iw, h: ih } = SPLASH_GEOM.frame;
      const cs = Math.max(vw / iw, vh / ih);
      const cw = iw * cs, ch = ih * cs;
      ctx.drawImage(img, (vw - cw) / 2, (vh - ch) / 2, cw, ch);
      const g = ctx.createRadialGradient(vw / 2, vh / 2, r.w * 0.22, vw / 2, vh / 2, r.w * 0.62);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      // Foreground: the composition at the source scale.
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    }

    if (phaseRef.current !== 'form') return;

    const { rows, box, labelX1, designWeight } = SPLASH_GEOM;
    const px = (fx: number) => r.x + fx * r.w;
    const py = (fy: number) => r.y + fy * r.h;
    const f = focusRef.current;
    const typing = f === 'email' || f === 'password';
    const rowKeys = ['email', 'password', 'submit'] as const;
    // While interacting, the red cloud design drops to 20% — but not the box.
    if (typing && img?.complete && img.naturalWidth) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(0, 0, vw, vh);
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      ctx.drawImage(
        img,
        box.x0 * iw, box.y0 * ih, (box.x1 - box.x0) * iw, (box.y1 - box.y0) * ih,
        px(box.x0), py(box.y0), px(box.x1) - px(box.x0), py(box.y1) - py(box.y0),
      );
    }

    // Opacity of the box's words + clouds.
    if (typing) {
      // focused row: word only to 10%; other rows: word + line + cloud to 10%.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      rowKeys.forEach((k) => {
        const rw = rows[k];
        const x1 = k === f ? labelX1 : box.x1;
        ctx.fillRect(px(box.x0 + 0.01), py(rw.yTop), px(x1) - px(box.x0 + 0.01), py(rw.yBot) - py(rw.yTop));
      });
    } else {
      // idle: words + clouds to 50%, dashed lines stay full.
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      rowKeys.forEach((k) => {
        const rw = rows[k];
        ctx.fillRect(px(box.x0 + 0.01), py(rw.yTop), px(labelX1) - px(box.x0 + 0.01), py(rw.yBot) - py(rw.yTop));
      });
    }

    // Redraw the box border and the dashed lines at the red-design line weight.
    const w = Math.max(1, designWeight * r.w);
    ctx.lineWidth = w;
    ctx.strokeStyle = '#ff0000';
    ctx.setLineDash([]);
    ctx.strokeRect(px(box.x0), py(box.y0), px(box.x1) - px(box.x0), py(box.y1) - py(box.y0));

    ctx.strokeStyle = '#000000';
    ctx.setLineDash([w * 3.2, w * 2.2]);
    rowKeys.forEach((k) => {
      const rw = rows[k];
      const y = py(rw.dashY);
      const dim = typing && k !== f ? 0.1 : 1;
      ctx.globalAlpha = dim;
      ctx.beginPath();
      ctx.moveTo(px(rw.tickX), y);
      ctx.lineTo(px(rw.endX), y);
      ctx.stroke();
      // the little vertical tick the line starts with
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px(rw.tickX), y - w * 3);
      ctx.lineTo(px(rw.tickX), y);
      ctx.stroke();
      ctx.setLineDash([w * 3.2, w * 2.2]);
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
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
  }, [measure, paint, run]);

  // Repaint when the form phase begins so the last frame is definitely drawn.
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
    [ready, run, paint],
  );

  const release = useCallback(() => {
    pressedRef.current = false;
    if (dirRef.current === 0 && posRef.current >= SPLASH_DURATION_MS) return;
    dirRef.current = -1;
    run();
  }, [run]);

  const setFocusField = useCallback(
    (f: FocusField) => {
      focusRef.current = f;
      paint(SPLASH_DURATION_MS);
    },
    [paint],
  );

  // Seal hit-square, in viewport px, from the frame geometry.
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
      <canvas ref={canvasRef} className="splash-canvas" aria-hidden="true" />

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
