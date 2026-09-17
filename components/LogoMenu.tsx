'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import barGeometry from '@/lib/menu-geometry.json';
import growGeometry from '@/lib/growmenu-geometry.json';

/**
 * The 遠東 logo, which unfolds into a menu.
 *
 * Hovering the characters (or pressing them, on a touch screen) draws a box
 * around them and unfolds the menu. Pressing the logo while that is running
 * skips to the end. Once open it stays open — hovering away does not close it
 * — until the logo is pressed again or something else on the page is, and then
 * it runs backwards at twice speed.
 *
 * WHY A CANVAS. The source is a GIF, and a GIF cannot be seeked, paused or
 * played backwards. Its frames are baked out by the build and scrubbed here,
 * the same way the splash animation works.
 *
 * WHY IT PAINTS OVER THE LOGO. The first frame IS the logo, baked to land on
 * the page's own to a fraction of a pixel, so the canvas can simply cover it
 * while open rather than the two having to be swapped.
 *
 * THERE ARE TWO MENUS, AND THIS DRAWS EITHER. They are the same machine — the
 * same scrub, the same phases, the same rules about pressing — differing only
 * in what was drawn and what the words do, so both are described entirely by
 * their geometry and neither has its own copy of this component.
 *
 *   bar   the monkey bar (`npm run build:menu`): a red box round the logo and
 *         three labelled boxes unfolding to the right, plus a fourth the bake
 *         synthesises for home. The CIGARETTE PAGES use it, and they need
 *         that fourth box, because there the logo is this switch rather than
 *         a link. `stop` picks the length.
 *
 *   grow  the branching one (`npm run build:growmenu`): a box round the logo
 *         and branches that grow out of it carrying six words — about us,
 *         privacy policy and terms of service across the top, MY SAVED,
 *         OFFERS and RECOMMENDED stacked under the logo — and then recede
 *         again, leaving the words standing. The LANDING PAGE uses it. Those
 *         last three used to be artwork parts printed on the page; the owner
 *         asked for them to come off it and live in here.
 *
 * HOW A WORD ANSWERS THE POINTER is the geometry's `hover`:
 *
 *   invert  the bar's boxes fill and their label reverses out. It cannot be
 *           done by painting over the frame — the label would go with it — so
 *           the bake writes a second image per box and this draws it on top.
 *
 *   dim     the grow menu's words have no box to fill, so they dim instead:
 *           half strength under the pointer and a quarter while held, which
 *           is exactly what OFFERS, My Saved and RECOMMENDED did when they
 *           were parts of the page. Nothing is baked — the word's own box is
 *           cleared and the frame is drawn back into it at that alpha — so
 *           the two states cannot drift apart.
 */
type MenuBox = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A link, and where to. */
  href?: string;
  /** Not a link: a button carrying this `data-part`, for a listener elsewhere. */
  part?: string;
  /** Drawn and hoverable, but it goes nowhere yet. */
  inert?: boolean;
};

type MenuGeometry = {
  dir?: string;
  frame: { w: number; h: number; scale: number };
  frames: number;
  frameMs: number;
  hover?: 'invert' | 'dim';
  logoHit: { x: number; y: number; w: number; h: number };
  boxes: MenuBox[];
  stops: Record<string, { frames: number; viewW: number; boxes: string[] }>;
};

const MENUS: Record<string, MenuGeometry> = {
  bar: barGeometry as MenuGeometry,
  grow: growGeometry as MenuGeometry,
};

export type MenuName = keyof typeof MENUS;

type Phase = 'idle' | 'forward' | 'open' | 'reverse';

/** Backwards runs at twice the speed it went forwards. */
const REVERSE_RATE = 2;

/** Half strength under the pointer, a quarter while it is held. */
const DIM = { hover: 0.5, press: 0.25 };

export function LogoMenu({ menu = 'bar', stop = 'base' }: { menu?: MenuName; stop?: string } = {}) {
  const geometry = MENUS[menu];
  const { frame, frameMs, logoHit, boxes, stops } = geometry;
  const SCALE = frame.scale;
  const VIEW_H = frame.h;
  const DIR = geometry.dir ?? '/menu/frames';
  const HOVER = geometry.hover ?? 'invert';

  const { frames: FRAMES, viewW: VIEW_W, boxes: inPlay } = stops[stop] ?? stops.base;
  const shown = boxes.filter((b) => inPlay.includes(b.id));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<HTMLImageElement[] | null>(null);
  const pressedRef = useRef<Record<string, HTMLImageElement>>({});
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const hoverBoxRef = useRef<string | null>(null);
  const heldBoxRef = useRef<string | null>(null);

  const [phase, setPhaseState] = useState<Phase>('idle');
  const [ready, setReady] = useState(false);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  /** Draw the frame the position is currently on, plus any pressed word. */
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

    // the answer to a pointer only exists once the menu is fully drawn
    const hovered = hoverBoxRef.current;
    if (!hovered || phaseRef.current !== 'open') return;
    const box = shown.find((b) => b.id === hovered);
    if (!box) return;
    const x = box.x * SCALE;
    const y = box.y * SCALE;

    if (HOVER === 'dim') {
      if (!img?.complete || !img.naturalWidth) return;
      const w = box.w * SCALE;
      const h = box.h * SCALE;
      // lift the word out and lay it back down fainter. Clearing first is what
      // makes this a dim rather than a double exposure: drawing at half alpha
      // over the word already there would only darken it.
      ctx.clearRect(x, y, w, h);
      ctx.save();
      ctx.globalAlpha = heldBoxRef.current === box.id ? DIM.press : DIM.hover;
      ctx.drawImage(img, x, y, w, h, x, y, w, h);
      ctx.restore();
      return;
    }

    const overlay = pressedRef.current[box.id];
    if (overlay?.complete) ctx.drawImage(overlay, x, y);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- menu and stop never change for a mounted menu
  }, [FRAMES]);

  /** Load every frame once, off the critical path. */
  const load = useCallback(() => {
    if (framesRef.current) return Promise.resolve();
    const list: HTMLImageElement[] = [];
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < FRAMES; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = `${DIR}/f${String(i).padStart(3, '0')}.webp`;
      list[i] = img;
      jobs.push(img.decode().catch(() => {}));
    }
    if (HOVER === 'invert') {
      for (const box of shown) {
        const img = new Image();
        img.src = `/menu/${box.id}-pressed.webp`;
        pressedRef.current[box.id] = img;
        jobs.push(img.decode().catch(() => {}));
      }
    }
    framesRef.current = list;
    return Promise.all(jobs).then(() => {
      setReady(true);
      paint();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- menu and stop never change for a mounted menu
  }, [paint, FRAMES]);

  useEffect(() => {
    // Frames are worth having ready before the first hover and not worth
    // competing with the page's own artwork for the initial load. The bar is
    // 294KB; the grow menu is several times that, which is what an animation
    // drawn at four times the page's scale and twice the length costs.
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
  }, [paint, setPhase, FRAMES, frameMs]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const reduced = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /**
   * Unfold, from rest or straight out of a retraction.
   *
   * Resuming picks up at whatever frame the retraction had reached, so
   * leaving and returning mid-way reads as one continuous movement rather
   * than a restart.
   */
  const goForward = useCallback(async () => {
    const now = phaseRef.current;
    if (now !== 'idle' && now !== 'reverse') return;
    await load();
    if (reduced()) {
      posRef.current = FRAMES - 1;
      setPhase('open');
      paint();
      return;
    }
    setPhase('forward');
    run();
  }, [load, paint, run, setPhase, FRAMES]);

  /** Retract from wherever it has got to. */
  const goReverse = useCallback(() => {
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

  /** Straight back to rest, no movement. */
  const snapClosed = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    posRef.current = 0;
    hoverBoxRef.current = null;
    heldBoxRef.current = null;
    setPhase('idle');
    paint();
  }, [paint, setPhase]);

  /**
   * Pressing the logo. Mid-unfold it skips to the end; once open it starts
   * retracting; mid-retraction it turns around.
   */
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
      goReverse();
      return;
    }
    void goForward(); // idle, or turning a retraction around
  }, [goForward, goReverse, paint, setPhase, FRAMES]);

  /**
   * Pressing anywhere else. An open menu retracts; one already retracting
   * gives up and snaps shut.
   */
  useEffect(() => {
    if (phase !== 'open' && phase !== 'reverse') return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-menu-root]')) return; // the parts handle their own
      if (phaseRef.current === 'reverse') snapClosed();
      else goReverse();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [phase, goReverse, snapClosed]);

  useEffect(() => {
    paint();
  }, [phase, paint, ready]);

  const setHover = (id: string | null) => {
    hoverBoxRef.current = id;
    if (!id) heldBoxRef.current = null;
    paint();
  };

  const setHeld = (id: string | null) => {
    heldBoxRef.current = id;
    paint();
  };

  const px = (v: number) => `${v}px`;

  /** Everything a word needs, whether it ends up a link or a button. */
  const wordProps = (box: MenuBox) => ({
    className: 'logo-menu-box',
    'aria-label': box.label,
    tabIndex: phase === 'open' ? 0 : -1,
    'aria-hidden': phase === 'open' ? undefined : (true as const),
    style: {
      left: px(box.x),
      top: px(box.y),
      width: px(box.w),
      height: px(box.h),
      pointerEvents: (phase === 'open' ? 'auto' : 'none') as 'auto' | 'none',
    },
    onPointerEnter: () => setHover(box.id),
    onPointerLeave: () => setHover(null),
    onPointerDown: () => setHeld(box.id),
    onPointerUp: () => setHeld(null),
    onFocus: () => setHover(box.id),
    onBlur: () => setHover(null),
  });

  return (
    <div
      data-menu-root
      data-menu={menu}
      className="logo-menu"
      data-phase={phase}
      style={{ width: px(VIEW_W), height: px(VIEW_H) }}
    >
      <canvas
        ref={canvasRef}
        className="logo-menu-canvas"
        width={VIEW_W * SCALE}
        height={VIEW_H * SCALE}
        style={{ width: px(VIEW_W), height: px(VIEW_H) }}
        aria-hidden="true"
      />

      {/* the characters: hover to open, press to skip ahead or to close */}
      <button
        type="button"
        className="logo-menu-logo"
        aria-label="遠東 — menu"
        aria-expanded={phase === 'open'}
        style={{
          left: px(logoHit.x),
          top: px(logoHit.y),
          width: px(logoHit.w),
          height: px(logoHit.h),
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') void goForward();
        }}
        onPointerLeave={(e) => {
          // Leaving mid-unfold turns it straight around. Once it is open it
          // stays open — only a press closes that.
          if (e.pointerType === 'mouse' && phaseRef.current === 'forward') goReverse();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          onLogoPress();
        }}
        // A pointer opens it on pointerdown, which is preventDefault-ed and so
        // never becomes a click. The keyboard has no pointerdown at all, and on
        // the cigarette pages this menu is the only way home — so Enter and
        // Space are handled here rather than left to a click that will not come.
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onLogoPress();
        }}
      />

      {shown.map((box) =>
        box.href ? (
          <Link
            key={box.id}
            {...wordProps(box)}
            href={box.href}
            onClick={() => {
              // Shut it before the route changes. On the bar the canvas is
              // opaque white and the pages it leads to are red, so left up
              // during the transition it shows as a white block in the corner.
              //
              // On CLICK, not pointerdown. Closing sets this link's
              // pointer-events to none, and React flushes a discrete event's
              // state before the browser dispatches the click that follows —
              // so from pointerdown the link was already untouchable by the
              // time the click looked for it, and the menu simply never went
              // anywhere. The navigation runs from this same handler chain
              // rather than from another hit test, so here it is safe.
              setHover(null);
              snapClosed();
            }}
          />
        ) : (
          <button
            key={box.id}
            {...wordProps(box)}
            type="button"
            // The hook whatever owns this word is listening on. My Saved's is
            // `saved`, which `CigScroller` claims in the capture phase to spin
            // the row — the same attribute it used when this was a part of the
            // page, so that listener did not have to change.
            data-part={box.part}
            // NOT `disabled` for an inert word: a disabled control takes no
            // pointer events at all in Chrome, so it would stop answering the
            // pointer as well as going nowhere. OFFERS and RECOMMENDED were
            // pressable-but-inert as page parts too; this is the same thing.
            onClick={() => {
              setHover(null);
              snapClosed();
            }}
          />
        ),
      )}
    </div>
  );
}
