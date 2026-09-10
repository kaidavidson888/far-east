'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import geometry from '@/lib/menu-geometry.json';

/**
 * The 遠東 logo, which unfolds into a menu.
 *
 * Hovering the characters (or pressing them, on a touch screen) draws a red
 * box around them and unfolds three labelled boxes to the right. Pressing
 * the logo while that is running skips to the end. Once open it stays open —
 * hovering away does not close it — until the logo is pressed again or
 * something else on the page is, and then it runs backwards at twice speed.
 *
 * WHY A CANVAS. The source is a GIF, and a GIF cannot be seeked, paused or
 * played backwards. Its frames are baked out by `npm run build:menu` and
 * scrubbed here, the same way the splash animation works.
 *
 * WHY IT PAINTS OVER THE LOGO. The first frame IS the logo, baked to land on
 * the page's own to half a pixel, so the canvas can simply cover it while
 * open rather than the two having to be swapped. Its white ground would
 * cover the seal too, so it is only as wide as the animation's content —
 * everything is drawn by x=289.
 */
type Phase = 'idle' | 'forward' | 'open' | 'reverse';

const { frame, frames: FRAMES, frameMs, logoHit, boxes } = geometry;
const SCALE = frame.scale;

/** Wide enough for the animation, narrow enough to leave the seal alone. */
const VIEW_W = 300;
const VIEW_H = frame.h;

/** Backwards runs at twice the speed it went forwards. */
const REVERSE_RATE = 2;

const src = (i: number) => `/menu/frames/f${String(i).padStart(3, '0')}.webp`;

export function LogoMenu() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[] | null>(null);
  const pressedRef = useRef<Record<string, HTMLImageElement>>({});
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const hoverBoxRef = useRef<string | null>(null);

  const [phase, setPhaseState] = useState<Phase>('idle');
  const [ready, setReady] = useState(false);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  /** Draw the frame the position is currently on, plus any pressed box. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const list = framesRef.current;
    if (!canvas || !list) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const i = Math.max(0, Math.min(FRAMES - 1, Math.round(posRef.current)));
    const img = list[i];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img?.complete && img.naturalWidth) ctx.drawImage(img, 0, 0);

    // the pressed state only exists once the boxes are fully drawn
    const hovered = hoverBoxRef.current;
    if (hovered && phaseRef.current === 'open') {
      const box = boxes.find((b) => b.id === hovered);
      const overlay = box ? pressedRef.current[box.id] : null;
      if (box && overlay?.complete) ctx.drawImage(overlay, box.x * SCALE, box.y * SCALE);
    }
  }, []);

  /** Load every frame once, off the critical path. */
  const load = useCallback(() => {
    if (framesRef.current) return Promise.resolve();
    const list: HTMLImageElement[] = [];
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < FRAMES; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src(i);
      list[i] = img;
      jobs.push(img.decode().catch(() => {}));
    }
    for (const box of boxes) {
      const img = new Image();
      img.src = `/menu/${box.id}-pressed.webp`;
      pressedRef.current[box.id] = img;
      jobs.push(img.decode().catch(() => {}));
    }
    framesRef.current = list;
    return Promise.all(jobs).then(() => {
      setReady(true);
      paint();
    });
  }, [paint]);

  useEffect(() => {
    // 294KB of frames: worth having ready before the first hover, not worth
    // competing with the page's own artwork for the initial load
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void load());
    else window.setTimeout(() => void load(), 600);
  }, [load]);

  /** The scrub loop. Forward at the gif's own rate, back at twice it. */
  const run = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = 0;
    const step = (ts: number) => {
      const prev = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = Math.min(64, ts - prev);
      const phaseNow = phaseRef.current;

      if (phaseNow === 'forward') {
        posRef.current += dt / frameMs;
        if (posRef.current >= FRAMES - 1) {
          posRef.current = FRAMES - 1;
          paint();
          setPhase('open');
          return;
        }
      } else if (phaseNow === 'reverse') {
        posRef.current -= (dt / frameMs) * REVERSE_RATE;
        if (posRef.current <= 0) {
          posRef.current = 0;
          paint();
          setPhase('idle');
          return;
        }
      } else {
        paint();
        return;
      }
      paint();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [paint, setPhase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const reduced = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const open = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    await load();
    if (reduced()) {
      posRef.current = FRAMES - 1;
      setPhase('open');
      paint();
      return;
    }
    setPhase('forward');
    run();
  }, [load, paint, run, setPhase]);

  const close = useCallback(() => {
    if (phaseRef.current !== 'open') return;
    if (reduced()) {
      posRef.current = 0;
      setPhase('idle');
      paint();
      return;
    }
    setPhase('reverse');
    run();
  }, [paint, run, setPhase]);

  /** Pressing the logo: skip to the end while it runs, close once it is open. */
  const onLogoPress = useCallback(() => {
    const now = phaseRef.current;
    if (now === 'forward') {
      cancelAnimationFrame(rafRef.current);
      posRef.current = FRAMES - 1;
      setPhase('open');
      paint();
      return;
    }
    if (now === 'open') {
      close();
      return;
    }
    if (now === 'idle') void open();
  }, [close, open, paint, setPhase]);

  /** Anything pressed elsewhere closes an open menu. */
  useEffect(() => {
    if (phase !== 'open') return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-menu-root]')) return; // handled by the parts themselves
      close();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [phase, close]);

  useEffect(() => {
    paint();
  }, [phase, paint, ready]);

  const setHover = (id: string | null) => {
    hoverBoxRef.current = id;
    paint();
  };

  const pct = (v: number) => `${v}px`;

  return (
    <div
      data-menu-root
      className="logo-menu"
      data-phase={phase}
      style={{ width: pct(VIEW_W), height: pct(VIEW_H) }}
    >
      <canvas
        ref={canvasRef}
        className="logo-menu-canvas"
        width={VIEW_W * SCALE}
        height={VIEW_H * SCALE}
        style={{ width: pct(VIEW_W), height: pct(VIEW_H) }}
        aria-hidden="true"
      />

      {/* the characters: hover to open, press to skip ahead or to close */}
      <button
        type="button"
        className="logo-menu-logo"
        aria-label="遠東 — menu"
        aria-expanded={phase === 'open'}
        style={{
          left: pct(logoHit.x),
          top: pct(logoHit.y),
          width: pct(logoHit.w),
          height: pct(logoHit.h),
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') void open();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          onLogoPress();
        }}
      />

      {boxes.map((box) => (
        <a
          key={box.id}
          href={box.href}
          className="logo-menu-box"
          aria-label={box.label}
          tabIndex={phase === 'open' ? 0 : -1}
          aria-hidden={phase === 'open' ? undefined : true}
          style={{
            left: pct(box.x),
            top: pct(box.y),
            width: pct(box.w),
            height: pct(box.h),
            pointerEvents: phase === 'open' ? 'auto' : 'none',
          }}
          onPointerEnter={() => setHover(box.id)}
          onPointerLeave={() => setHover(null)}
          onPointerDown={() => setHover(box.id)}
          onPointerUp={() => setHover(null)}
          onFocus={() => setHover(box.id)}
          onBlur={() => setHover(null)}
        />
      ))}
    </div>
  );
}
