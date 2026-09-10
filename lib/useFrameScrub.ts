'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A baked animation that a pointer scrubs, forwards and backwards.
 *
 * Both the logo menu and the seal behave the same way, so they share this.
 * A GIF can be none of seeked, paused or reversed, which is why the frames
 * are baked out and drawn to a canvas instead.
 *
 * The phases, and what moves between them:
 *
 *   idle     nothing drawn; the page's own artwork shows through
 *   forward  running out. Leaving turns it round from where it is; pressing
 *            skips to the end
 *   open     finished, or skipped to. Leaving does NOT close it — only a
 *            press does, or whatever else the caller decides
 *   reverse  running back, faster. Returning turns it round again from the
 *            frame it had reached, so leaving and coming back reads as one
 *            movement rather than a restart
 */
export type ScrubPhase = 'idle' | 'forward' | 'open' | 'reverse';

export type FrameScrub = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  phase: ScrubPhase;
  /** the frame it is on, for callers that need to know */
  position: () => number;
  paint: () => void;
  /** hover in, or resume out of a retraction */
  enter: () => void;
  /** hover out: turns an unfinished run around, leaves a finished one alone */
  leave: () => void;
  /** press: skips an unfinished run to the end, else turns it around */
  press: () => void;
  /** straight back to rest, no movement */
  snapClosed: () => void;
  /** start it retracting from wherever it is */
  retract: () => void;
};

export function useFrameScrub({
  frames,
  frameMs,
  src,
  reverseRate = 2,
  preload = true,
  decorate,
}: {
  frames: number;
  frameMs: number;
  src: (i: number) => string;
  /** how much faster it comes back than it went out */
  reverseRate?: number;
  preload?: boolean;
  /** anything to draw over the frame, e.g. a pressed box */
  decorate?: (ctx: CanvasRenderingContext2D, phase: ScrubPhase) => void;
}): FrameScrub {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[] | null>(null);
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const phaseRef = useRef<ScrubPhase>('idle');
  const [phase, setPhaseState] = useState<ScrubPhase>('idle');

  const setPhase = useCallback((next: ScrubPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const list = framesRef.current;
    if (!canvas || !list) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const i = Math.max(0, Math.min(frames - 1, Math.round(posRef.current)));
    const ready = (k: number) => {
      const img = list[k];
      return img?.complete && img.naturalWidth ? img : null;
    };
    // Hold the last frame that did arrive rather than blanking. The frames
    // are fetched while the animation is already running, so a frame can be
    // a moment late; showing nothing for it would read as a flicker.
    let img = ready(i);
    for (let k = i - 1; !img && k >= 0; k--) img = ready(k);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // scaled to the canvas, so a frame baked at one size still fills a
    // surface sized from the page's own geometry
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    decorate?.(ctx, phaseRef.current);
  }, [decorate, frames]);

  const load = useCallback(() => {
    if (framesRef.current) return Promise.resolve();
    const list: HTMLImageElement[] = [];
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < frames; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src(i);
      list[i] = img;
      jobs.push(img.decode().catch(() => {}));
    }
    framesRef.current = list;
    return Promise.all(jobs).then(() => paint());
  }, [frames, paint, src]);

  useEffect(() => {
    if (!preload) return;
    // ready before the first hover, without competing with the page's own art
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void load());
    else window.setTimeout(() => void load(), 600);
  }, [load, preload]);

  const run = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = 0;
    const step = (ts: number) => {
      const prev = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = Math.min(64, ts - prev);
      const now = phaseRef.current;
      if (now === 'forward') {
        posRef.current += dt / frameMs;
        if (posRef.current >= frames - 1) {
          posRef.current = frames - 1;
          paint();
          setPhase('open');
          return;
        }
      } else if (now === 'reverse') {
        posRef.current -= (dt / frameMs) * reverseRate;
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
  }, [frameMs, frames, paint, reverseRate, setPhase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const reduced = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const enter = useCallback(() => {
    const now = phaseRef.current;
    if (now !== 'idle' && now !== 'reverse') return;
    // Start straight away and let the frames arrive underneath. Waiting for
    // all of them would stall the first hover by however long the set takes
    // to fetch, and the run is long enough that loading keeps ahead of it.
    void load();
    if (reduced()) {
      posRef.current = frames - 1;
      setPhase('open');
      paint();
      return;
    }
    setPhase('forward');
    run();
  }, [frames, load, paint, run, setPhase]);

  const retract = useCallback(() => {
    const now = phaseRef.current;
    if (now !== 'open' && now !== 'forward') return;
    if (reduced()) {
      posRef.current = 0;
      setPhase('idle');
      paint();
      return;
    }
    setPhase('reverse');
    run();
  }, [paint, run, setPhase]);

  /** Only an unfinished run turns around; a finished one is left alone. */
  const leave = useCallback(() => {
    if (phaseRef.current === 'forward') retract();
  }, [retract]);

  const snapClosed = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    posRef.current = 0;
    setPhase('idle');
    paint();
  }, [paint, setPhase]);

  const press = useCallback(() => {
    const now = phaseRef.current;
    if (now === 'forward') {
      cancelAnimationFrame(rafRef.current);
      posRef.current = frames - 1;
      setPhase('open');
      paint();
      return;
    }
    if (now === 'open') {
      retract();
      return;
    }
    enter(); // idle, or turning a retraction around
  }, [enter, frames, paint, retract, setPhase]);

  useEffect(() => {
    paint();
  }, [phase, paint]);

  return {
    canvasRef,
    phase,
    position: () => posRef.current,
    paint,
    enter,
    leave,
    press,
    snapClosed,
    retract,
  };
}
