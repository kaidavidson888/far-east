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
  /**
   * A trigger the page can SEE, drawn by this component rather than being an
   * invisible hit over a logo the page draws. The landing page's I button
   * (the owner's 2026-09-19 ask): a black box `rule` px wide round a bold
   * `letter` in the owner's face, set at `font` px and nudged down `dy` px so
   * its ink rather than its em box is centred. See `npm run build:growmenu`.
   */
  badge?: { letter: string; rule: number; cap: number; font: number };
  /**
   * Where the menu's own corner goes on the page. The grow menu is laid out
   * from the I button's corner and placed at the page's 10px margin, so that
   * scaling it (see `--logo-menu-zoom`) keeps that margin. The bar menu has
   * no `place` and is laid out from the page's corner, as it always was.
   */
  place?: { left: number; top: number };
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

/**
 * How fast each menu plays against the rate its own gif was drawn at.
 *
 * `frameMs` in the geometry is the gif's measured rate and stays that — a
 * measurement, not a preference. This is the preference, and it is per menu
 * because it is the owner's judgement about one of them: 20% slower than the
 * gif's own timing (2026-09-17), so the grow menu runs at 0.8 and takes 10.3s
 * where the gif gives 8.3. The bar is untouched at 1.
 *
 * (It went to 0.88 for an afternoon and came back. That 10% was asked for
 * against a view that was ramping — see the dt note in `run` — so it was
 * judging the pane's frame supply rather than this number.)
 *
 * Reverse still runs at REVERSE_RATE times whatever forward is doing, so
 * "backwards at twice the speed" holds at any rate.
 */
const PLAY_RATE: Record<string, number> = { bar: 1, grow: 0.8 };

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
  /**
   * WHERE THE I SITS IN ITS BOX, WORKED OUT FROM ITS OWN INK.
   *
   * The owner: "make sure the circle and dot in the I are clearly visible".
   * This face draws its I as a ring with a hole above a stem, and at the
   * plus's size the hole is about two pixels and the gap under the ring
   * about one — so whether they read at all comes down to whether they land
   * ON pixels or across them. Centring the letter's em box leaves its ink on
   * a fraction and both of them turn to grey mush.
   *
   * So the ink is measured in the page, on a canvas with the letter's own
   * computed font once the face has loaded (the shelf's price does the
   * same), and the letter is placed by where its ink has to land: centred in
   * the box, rounded to whole pixels. Until then the flex centring in the
   * stylesheet holds it, which is right to within half a pixel.
   */
  const letterRef = useRef<HTMLSpanElement | null>(null);
  const [inkAt, setInkAt] = useState<{ left: number; top: number } | null>(null);
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

  /**
   * The scrub loop. Forward at this menu's own rate, back at twice it.
   *
   * EVERY MILLISECOND THAT PASSES COUNTS, AND THAT IS DELIBERATE. `dt` used to
   * be clamped at 64ms so that a frame arriving late could not jump the
   * animation. The cost of that clamp is that late time is DISCARDED: a frame
   * 2 seconds late advanced the menu by 64ms and threw the other 1,938 away,
   * so wherever frames were scarce the animation crawled and wherever they
   * were plentiful it ran true. The owner saw exactly that and read it as the
   * menu "increasing in speed exponentially each time I used it" — it was the
   * frame supply changing, not the menu (the Browser pane hands out rAF in
   * bursts: measured, five frames in six seconds, one gap of 2,002ms).
   *
   * Unclamped, a run takes the same wall-clock time whatever the frame rate.
   * Where frames are scarce it now STEPS rather than crawling, which is the
   * honest picture of two seconds having passed, and where they are plentiful
   * — every real browser, at 60 or 120Hz — nothing changes at all, because dt
   * was never near the clamp to begin with.
   *
   * The one case the clamp was really there for is handled properly below
   * instead: a hidden tab gets no rAF at all, so its first frame back would
   * carry the whole time it was away. `lastTsRef` is reset when the page
   * becomes visible again, and that gap contributes nothing.
   */
  const run = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = 0;
    const step = (ts: number) => {
      const prev = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = ts - prev;
      const phaseNow = phaseRef.current;

      const rate = (dt / frameMs) * (PLAY_RATE[menu] ?? 1);

      if (phaseNow === 'forward') {
        posRef.current += rate;
        if (posRef.current >= FRAMES - 1) {
          posRef.current = FRAMES - 1;
          paint();
          setPhase('open');
          return;
        }
      } else if (phaseNow === 'reverse') {
        posRef.current -= rate * REVERSE_RATE;
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
  }, [paint, setPhase, FRAMES, frameMs, menu]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /**
   * Time spent on another tab does not count. A hidden page gets no rAF, so
   * the first frame after coming back carries however long that was — with an
   * unclamped dt that would run the whole animation out in one step. Forget
   * the last timestamp instead, and the gap contributes nothing.
   */
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) lastTsRef.current = 0;
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

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
   * The I, placed by its ink rather than by its em box — see `inkAt`.
   *
   * Measured in the PAGE's pixels, not the menu's own: this menu is drawn at
   * the row's scale, so a whole pixel inside it is not a whole pixel on the
   * page, and it is the page's that the hole has to land on. The button is
   * watched for a change of size, which is how a change of that scale
   * arrives.
   */
  const badge = geometry.badge;
  useEffect(() => {
    const el = letterRef.current;
    const btn = el?.parentElement;
    if (!badge || !el || !btn) return;
    let live = true;
    const place = () => {
      if (!live) return;
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      const box = btn.getBoundingClientRect();
      if (!ctx || !box.width) return;
      // The scale comes from the button's own drawn size: `getComputedStyle`
      // reports the font size BEFORE a CSS zoom while a rect is after it, so
      // the two cannot be mixed. Everything below is in the page's px.
      const z = box.width / logoHit.w;
      const size = badge.font * z;
      ctx.font = `${size}px ${cs.fontFamily}`;
      const m = ctx.measureText(badge.letter);
      if (!m.actualBoundingBoxAscent) return;
      const rule = badge.rule * z;
      const inkW = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
      const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      // where the ink has to land: centred in the box, on the page's own pixels
      const wantLeft = Math.round(box.left + rule + (box.width - 2 * rule - inkW) / 2);
      const wantTop = Math.round(box.top + rule + (box.height - 2 * rule - inkH) / 2);
      // the pen sits `left` inside the ink, and a line-height:1 box puts the
      // baseline 0.825 of the size down (measured in Chrome for the shelf)
      const penX = wantLeft + m.actualBoundingBoxLeft;
      const spanTop = wantTop + m.actualBoundingBoxAscent - 0.825 * size;
      const next = {
        left: +((penX - (box.left + rule)) / z).toFixed(2),
        top: +((spanTop - (box.top + rule)) / z).toFixed(2),
      };
      setInkAt((was) => (was && was.left === next.left && was.top === next.top ? was : next));
    };
    place();
    // WATCHING THE SCALE, NOT THE BOX. A CSS zoom on an ancestor does not
    // change this element's own layout size, so a ResizeObserver on it never
    // fires; what changes is the custom property the row writes on the stage
    // (see `layoutMenu` in CigScroller), which is an attribute change.
    const stage = btn.closest('[data-menu-root]')?.parentElement ?? null;
    const mo = stage ? new MutationObserver(place) : null;
    mo?.observe(stage as Element, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', place);
    if (document.fonts && !document.fonts.check(`${badge.font}px "Far East"`)) void document.fonts.ready.then(place);
    return () => {
      live = false;
      mo?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [badge, logoHit.w]);

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
      style={{
        width: px(VIEW_W),
        height: px(VIEW_H),
        // The stylesheet divides these by the zoom: `zoom` multiplies an
        // element's own offsets too, so a margin stated here would shrink
        // with the menu instead of holding at the page's 10px.
        ...(geometry.place
          ? ({
              '--logo-menu-x': px(geometry.place.left),
              '--logo-menu-y': px(geometry.place.top),
            } as React.CSSProperties)
          : null),
      }}
    >
      <canvas
        ref={canvasRef}
        className="logo-menu-canvas"
        width={VIEW_W * SCALE}
        height={VIEW_H * SCALE}
        style={{ width: px(VIEW_W), height: px(VIEW_H) }}
        aria-hidden="true"
      />

      {/* the trigger — the characters, or the I button where the geometry
          has one: hover to open, press to skip ahead or to close */}
      <button
        type="button"
        className={geometry.badge ? 'logo-menu-logo logo-menu-badge' : 'logo-menu-logo'}
        aria-label={geometry.badge ? 'Menu' : '遠東 — menu'}
        aria-expanded={phase === 'open'}
        style={{
          left: px(logoHit.x),
          top: px(logoHit.y),
          width: px(logoHit.w),
          height: px(logoHit.h),
          ...(geometry.badge ? { borderWidth: px(geometry.badge.rule) } : null),
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
      >
        {geometry.badge ? (
          <span
            ref={letterRef}
            className="logo-menu-badge-letter"
            aria-hidden="true"
            style={{
              fontSize: px(geometry.badge.font),
              ...(inkAt ? { position: 'absolute', left: px(inkAt.left), top: px(inkAt.top) } : null),
            }}
          >
            {geometry.badge.letter}
          </span>
        ) : null}
      </button>

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
