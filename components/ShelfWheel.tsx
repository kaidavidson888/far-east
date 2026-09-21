'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cigPaintMs } from '@/lib/cigRow';
import { PACK_RULE, type ShelfEntry } from '@/lib/shelfGrid';
import {
  WHEEL_MARGIN, WHEEL_MOTION, wheelCopies, wheelGap, wheelLayout, wheelScale,
} from '@/lib/shelfWheel';
import { ShelfWheelControls } from './ShelfWheelControls';

/**
 * THE SHELF, AS A VERTICAL WHEEL (the owner's 2026-09-21: "like the one on
 * the landing page only vertical rather than horizontal").
 *
 * IT IS THE ROW'S MOTION, NOT THE ROW'S CODE, and that is a deliberate
 * choice with a cost. `CigScroller` is 1834 lines, of which about half is
 * the landing page's own furniture — three menus, the My Saved spin, the
 * search, the tag grid, `layoutMenu`'s 180 lines of horizontal placement —
 * and none of that has a vertical meaning. Generalising it over an axis
 * would put the shelf's branches in the page the whole site opens on. So
 * the MOTION CONSTANTS are imported (`WHEEL_MOTION`, straight off
 * `lib/cigRow`) and the tick is written again, shorter, because the vertical
 * case is genuinely simpler: every pack is drawn the same HEIGHT, so the
 * pitch is one number where the row needs an array of positions.
 * **The debt is real: the two ticks are now two places.** If one gains a
 * fix, look at the other.
 *
 * THE FOUR WAYS THE ROW USED TO COME TO REST WRONG are all reproduced as
 * fixes here rather than rediscovered — CLAUDE.md records them, and three of
 * the four apply:
 *   - a RESIZE re-centres the SELECTED pack, not whichever is nearest the
 *     new middle;
 *   - the STOP TEST asks the rule itself (nothing steering, nothing within
 *     half a pixel of the middle), and the last half pixel is snapped, so
 *     the rest position is exact rather than wherever the exponential gave
 *     up;
 *   - a POINTER RELEASED OFF THE WHEEL ends the drag, heard from the window.
 * The fourth — measuring the row's width before a zoom had applied — cannot
 * happen here, because this wheel has no zoom.
 */

type Props = {
  entries: ShelfEntry[];
  bookmark: { mark: { width: number; height: number }; d: string };
  /** the mountain button's size on this page: every control matches it */
  button: number;
};

type Slot = { key: string; i: number; y: number };

export function ShelfWheel({ entries, bookmark, button }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  // the motion's own state lives in refs: the tick runs on a timer and must
  // not re-render the page to move a pack
  const offsetRef = useRef(0);
  const velRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const seekRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const pressRef = useRef<{ y: number; off: number; moved: boolean } | null>(null);
  const trailRef = useRef<{ t: number; y: number }[]>([]);
  /** which pack the wheel is on — kept in a ref so the tick can read it */
  const pickedRef = useRef(0);
  /** the selected pack's own element, for the quantity menu's width */
  const pickedPackRef = useRef<HTMLAnchorElement | null>(null);

  const [size, setSize] = useState({ h: 0, w: 0 });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [picked, setPicked] = useState(0);
  const [resting, setResting] = useState(false);

  const n = entries.length;
  const geom = wheelScale(size.h || 800, button);
  const PITCH = geom.pitch;
  const copies = wheelCopies(n, PITCH, size.h || 800);
  const LAP = wheelLayout(n * copies, PITCH).total;

  /** Where the wheel is, laid out. Pure — no DOM, no state. */
  const compute = useCallback(() => {
    const H = size.h;
    if (!n || !H) return { out: [] as Slot[], near: 0 };
    const pitch = wheelScale(H, button).pitch;
    const reps = wheelCopies(n, pitch, H);
    const lap = n * reps * pitch;
    const mid = H / 2;
    const start = ((offsetRef.current % lap) + lap) % lap;
    const laps = Math.ceil((H + WHEEL_MOTION.pad * 2) / lap) + 1;
    const out: Slot[] = [];
    let near = 0;
    let best = Infinity;
    // A SLOT IS ONE PITCH TALL WITH ITS PACK IN THE MIDDLE, so an offset of
    // zero has to put that MIDDLE on the screen's middle, not the slot's top
    // on the screen's top. Without this half-pitch the wheel rests with the
    // pack a quarter-screen high and nothing ever reads as selected.
    const home = mid - pitch / 2;
    for (let l = -1; l <= laps; l += 1) {
      const base = l * lap - start + home;
      for (let k = 0; k < n * reps; k += 1) {
        const y = base + k * pitch;
        if (y > H + WHEEL_MOTION.pad) break;
        if (y + pitch < -WHEEL_MOTION.pad) continue;
        const i = k % n;
        out.push({ key: `${l}:${k}`, i, y });
        // the middle of this slot's PACK against the middle of the screen
        const d = Math.abs(y + pitch / 2 - mid);
        if (d < best) { best = d; near = i; }
      }
    }
    return { out, near };
  }, [n, size.h, button]);

  /** How far the nearest pack is from the middle. */
  const offCentre = useCallback(() => {
    const H = size.h;
    if (!n || !H) return 0;
    const pitch = wheelScale(H, button).pitch;
    // a pack's own middle sits on the wheel at (k + 1/2) * pitch; the wheel
    // is centred when that lands on the screen's middle
    const k = offsetRef.current / pitch;
    const rest = k - Math.round(k);
    return -rest * pitch;
  }, [n, size.h, button]);

  const draw = useCallback(() => {
    const { out, near } = compute();
    setSlots(out);
    pickedRef.current = near;
    setPicked(near);
  }, [compute]);

  const run = useCallback(() => {
    if (timerRef.current) return;
    setResting(false);
    lastTsRef.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - lastTsRef.current) / 1000);
      lastTsRef.current = now;

      let settling = false;
      if (!draggingRef.current && seekRef.current !== null) {
        const rest = seekRef.current - offsetRef.current;
        if (Math.abs(rest) > 0.5) {
          offsetRef.current += rest * Math.min(1, dt / WHEEL_MOTION.seekTau);
          settling = true;
        } else {
          offsetRef.current = seekRef.current;
          seekRef.current = null;
        }
      } else if (!draggingRef.current) {
        if (Math.abs(velRef.current) > WHEEL_MOTION.settleBelow) {
          // trapezoidal: exact for a constant rate, where either end alone
          // over-runs or falls short by half the step's own change in speed
          const was = velRef.current;
          const drop = WHEEL_MOTION.brake * dt;
          velRef.current = Math.abs(was) <= drop ? 0 : was - Math.sign(was) * drop;
          offsetRef.current += ((was + velRef.current) / 2) * dt;
        } else {
          velRef.current = 0;
          const off = offCentre();
          if (Math.abs(off) > 0.5) {
            offsetRef.current += off * Math.min(1, dt / WHEEL_MOTION.settleTau);
            settling = true;
          } else {
            // THE LAST HALF PIXEL IS SNAPPED, so the rest position is exact
            offsetRef.current += off;
          }
        }
      }

      draw();

      // THE STOP TEST ASKS THE RULE ITSELF: with nothing steering the wheel
      // and no pack more than half a pixel off the middle, it has settled.
      // A late tick braking straight to 0, and a resize mid-motion, both
      // used to stop the row off-centre.
      const done = !settling
        && !draggingRef.current
        && velRef.current === 0
        && Math.abs(offCentre()) <= 0.5;
      if (done) {
        timerRef.current = null;
        setResting(true);
        return;
      }
      timerRef.current = window.setTimeout(tick, cigPaintMs(Math.abs(velRef.current)));
    };
    timerRef.current = window.setTimeout(tick, WHEEL_MOTION.paintMs);
  }, [draw, offCentre]);

  const stop = () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
  };

  // ---- measuring, and holding the SELECTED pack through a resize ----------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const read = () => {
      const b = el.getBoundingClientRect();
      setSize((was) => (Math.abs(was.h - b.height) < 0.5 && Math.abs(was.w - b.width) < 0.5
        ? was : { h: b.height, w: b.width }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('resize', read);
    return () => { ro.disconnect(); window.removeEventListener('resize', read); };
  }, []);

  useEffect(() => {
    if (!size.h || !n) return;
    // A RESIZE RE-CENTRES THE PACK THAT WAS SELECTED, not whichever happens
    // to be nearest the new middle: the pitch has changed under it, so the
    // offset has to be put back on the same pack rather than left where it
    // was. The row learned this one the hard way (`offFramed`).
    offsetRef.current = pickedRef.current * wheelScale(size.h, button).pitch;
    velRef.current = 0;
    seekRef.current = null;
    draw();
    setResting(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a real resize only
  }, [size.h, size.w, n]);

  useEffect(() => stop, []);

  // ---- the wheel ----------------------------------------------------------
  const rollRef = useRef<(e: WheelEvent) => void>(() => {});
  rollRef.current = (e: WheelEvent) => {
    if (!n) return;
    // React registers `wheel` PASSIVE on the root, so a handler passed as a
    // prop cannot cancel the page's own scroll — this listener is added with
    // { passive: false } below for that reason. CLAUDE.md, the gotchas.
    e.preventDefault();
    seekRef.current = null;
    offsetRef.current += e.deltaY * WHEEL_MOTION.wheel;
    velRef.current = 0;
    draw();
    run();
  };
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const h = (e: WheelEvent) => rollRef.current(e);
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  // ---- the drag -----------------------------------------------------------
  const endDrag = useCallback(() => {
    if (!draggingRef.current && !pressRef.current) return;
    const trail = trailRef.current;
    const now = performance.now();
    const old = trail.find((s) => now - s.t <= WHEEL_MOTION.flingWindowMs) ?? trail[0];
    if (old && now - old.t > 8) {
      const v = ((trail[trail.length - 1].y - old.y) / (now - old.t)) * 1000;
      velRef.current = Math.max(-WHEEL_MOTION.flingMax, Math.min(WHEEL_MOTION.flingMax, -v));
    }
    draggingRef.current = false;
    pressRef.current = null;
    trailRef.current = [];
    run();
  }, [run]);

  useEffect(() => {
    // A POINTER RELEASED OFF THE WHEEL ENDS THE DRAG. The stage captures only
    // once a press is really a drag, so one that slid off first was released
    // elsewhere, `draggingRef` stayed true, the settle was shut out and the
    // wheel then followed the bare mouse.
    const up = () => endDrag();
    const move = (e: PointerEvent) => { if (draggingRef.current && e.buttons === 0) endDrag(); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('pointermove', move);
    };
  }, [endDrag]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!n || e.button !== 0) return;
    stop();
    seekRef.current = null;
    velRef.current = 0;
    pressRef.current = { y: e.clientY, off: offsetRef.current, moved: false };
    trailRef.current = [{ t: performance.now(), y: e.clientY }];
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press) return;
    const dy = e.clientY - press.y;
    if (!press.moved) {
      if (Math.abs(dy) < WHEEL_MOTION.slop) return;
      press.moved = true;
      draggingRef.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no pointer */ }
    }
    offsetRef.current = press.off - dy;
    trailRef.current.push({ t: performance.now(), y: e.clientY });
    if (trailRef.current.length > 12) trailRef.current.shift();
    draw();
    setResting(false);
  };

  /** Press a pack that is not in the middle and it comes to the middle. */
  const seekTo = (slot: Slot) => {
    if (!size.h) return;
    const pitch = wheelScale(size.h, button).pitch;
    // the offset that puts THIS instance in the middle: it is the one on
    // screen, so it is always the short way round
    seekRef.current = offsetRef.current + (slot.y + pitch / 2 - size.h / 2);
    velRef.current = 0;
    run();
  };

  const nudge = (by: number) => {
    if (!size.h) return;
    const pitch = wheelScale(size.h, button).pitch;
    seekRef.current = (seekRef.current ?? offsetRef.current) + by * pitch;
    velRef.current = 0;
    run();
  };

  if (!n) return null;
  const { image, outline } = geom;

  return (
    <div
      className="shelf-wheel"
      ref={stageRef}
      role="listbox"
      aria-label="Your shelf"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onContextMenu={(e) => { if (draggingRef.current) e.preventDefault(); }}
      onDragStart={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); nudge(1); }
        if (e.key === 'ArrowUp') { e.preventDefault(); nudge(-1); }
      }}
      style={{
        '--wheel-pitch': `${PITCH}px`,
        '--wheel-image': `${image}px`,
        '--wheel-outline': `${outline}px`,
        '--wheel-gap': `${wheelGap(button)}px`,
        '--wheel-margin': `${WHEEL_MARGIN}px`,
      } as React.CSSProperties}
    >
      {slots.map((s) => {
        const e = entries[s.i];
        const mine = s.i === picked && Math.abs(s.y + PITCH / 2 - size.h / 2) < PITCH / 2;
        return (
          <div
            className="shelf-wheel-slot"
            key={s.key}
            style={{ top: `${s.y}px` }}
            data-picked={mine ? '' : undefined}
            aria-hidden={mine ? undefined : true}
          >
            {/* THE CONTROLS HANG OFF THE PACK, NOT OFF THE SLOT. A slot is
                the full width of the page — it has to be, to centre a pack
                of any width — so a control placed at its 100% lands at the
                page's edge rather than at the pack's. This stand is exactly
                the pack's box, and it is a sibling of the link rather than
                inside it, because a button inside a link is neither. */}
            <div className="shelf-wheel-stand">
            <Link
              href={`/packs/${e.pack.id}`}
              className="shelf-wheel-pack"
              ref={mine ? pickedPackRef : undefined}
              tabIndex={mine ? 0 : -1}
              onClick={(ev) => {
                // one press brings a pack to the middle, a second opens it —
                // the row's own rule
                if (!mine || pressRef.current?.moved) { ev.preventDefault(); seekTo(s); }
              }}
            >
              <img src={`/cigs/${e.pack.id}.svg`} alt={e.pack.name} draggable={false} />
              <span className="sr-only">{e.pack.name}</span>
            </Link>
            {/* THE CONTROLS ONLY EXIST WHEN THE WHEEL HAS STOPPED — the
                owner's "after it fully stops spinning" — and only on the
                pack in the middle. */}
            {mine && resting ? (
              <ShelfWheelControls
                entry={e}
                bookmark={bookmark}
                button={button}
                packRef={pickedPackRef}
              />
            ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
