'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cigPaintMs } from '@/lib/cigRow';
import { PACK_RULE, type ShelfEntry } from '@/lib/shelfGrid';
import {
  WHEEL_FAR_SCALE, WHEEL_MARGIN, WHEEL_MOTION,
  wheelCopies, wheelGap, wheelLayout, wheelScaleAt, wheelWidth,
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

/**
 * One drawing of one pack: which entry, where its MIDDLE is on screen, and
 * how big it is drawn — full in the middle, half a step out.
 */
type Slot = { key: string; i: number; mid: number; h: number; s: number };

/**
 * HOW MUCH WHEEL TRAVEL MOVES THE SELECTION BY ONE, in normalised pixels.
 *
 * A mouse notch is about 100 in Chrome, so 40 makes one notch exactly one
 * pack with room to spare either side; a trackpad's much smaller deltas bank
 * up and step in proportion to the swipe. Below about 25 a single notch can
 * arrive split across two events and step twice; above about 90 a shallow
 * notch on some mice would not step at all.
 */
const WHEEL_STEP = 40;

/**
 * How soon the first tick of a run comes. A notch's seek lands in one tick,
 * so at the beat's own 125ms a notch was an eighth of a second of nothing
 * and then the whole move; this makes it answer at once.
 */
const FIRST_TICK_MS = 16;

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
  /** wheel travel banked since the last step — see the roll handler */
  const bucketRef = useRef(0);
  /** which pack the wheel is on — kept in a ref so the tick can read it */
  const pickedRef = useRef(0);
  /** the selected pack's own element, for the quantity menu's width */
  const pickedPackRef = useRef<HTMLAnchorElement | null>(null);

  const [size, setSize] = useState({ h: 0, w: 0 });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [picked, setPicked] = useState(0);
  const [resting, setResting] = useState(false);

  const n = entries.length;

  /**
   * THE WHEEL, LAID OUT. Every pack is the same WIDTH now, so each has its
   * own height and the wheel carries an array of positions — exactly what
   * the landing row carries, and for the mirror-image reason.
   *
   * `offset` is the wheel coordinate currently on the screen's middle, so a
   * pack is selected when its own `pos` is that coordinate.
   */
  const plan = useMemo(() => {
    const H = size.h || 800;
    const W = size.w || 800;
    const ratios = entries.map((e) => e.pack.h / e.pack.w);
    const width = wheelWidth(H, W, button, ratios);
    const one = wheelLayout(ratios, width, H);
    const reps = wheelCopies(one.total, H);
    // the repeats are laid out as one long list, so a lap is longer than the
    // screen and no pack is ever drawn twice at once
    const pos: number[] = [];
    const height: number[] = [];
    for (let r = 0; r < reps; r += 1) {
      for (let i = 0; i < n; i += 1) {
        pos.push(one.pos[i] + r * one.total);
        height.push(one.height[i]);
      }
    }
    return { width, pos, height, step: one.step, lap: one.total * reps };
  }, [entries, n, size.h, size.w, button]);

  /** Where the wheel is. Pure — no DOM, no state. */
  const compute = useCallback(() => {
    const H = size.h;
    const { pos, height, lap } = plan;
    if (!n || !H || !(lap > 0)) return { out: [] as Slot[], near: 0 };
    const mid = H / 2;
    const off = offsetRef.current;
    const laps = Math.ceil((H + WHEEL_MOTION.pad * 2) / lap) + 1;
    const out: Slot[] = [];
    let near = 0;
    let best = Infinity;
    for (let l = -1; l <= laps; l += 1) {
      for (let k = 0; k < pos.length; k += 1) {
        const c = mid + (pos[k] + l * lap - off);
        // FULL IN THE MIDDLE, HALF A STEP OUT, and smoothly between — so a
        // pack grows into the middle as the wheel turns rather than popping
        const s = wheelScaleAt((c - mid) / plan.step);
        const h = height[k] * s;
        if (c - h / 2 > H + WHEEL_MOTION.pad) break;
        if (c + h / 2 < -WHEEL_MOTION.pad) continue;
        const i = k % n;
        out.push({ key: `${l}:${k}`, i, mid: c, h, s });
        const d = Math.abs(c - mid);
        if (d < best) { best = d; near = i; }
      }
    }
    return { out, near };
  }, [n, size.h, plan]);

  /**
   * How far the offset has to move for the nearest pack to be dead centre.
   * Circular, because the wheel has no ends: the short way round.
   */
  const offCentre = useCallback(() => {
    const { pos, lap } = plan;
    if (!n || !size.h || !(lap > 0)) return 0;
    const k = ((offsetRef.current % lap) + lap) % lap;
    let best = 0;
    let bd = Infinity;
    for (const p of pos) {
      let d = p - k;
      if (d > lap / 2) d -= lap;
      if (d < -lap / 2) d += lap;
      if (Math.abs(d) < Math.abs(bd)) { bd = d; best = d; }
    }
    return Number.isFinite(bd) ? best : 0;
  }, [n, size.h, plan]);

  /** The plan the TICK should use, which is not always the one it closed over. */
  const planRef = useRef(plan);
  planRef.current = plan;

  /*
   * THE PACK'S WIDTH IS PUBLISHED UP TO THE PAGE, because the wheel is the
   * only thing that knows it — a pack is sized from the viewport and its own
   * artwork — and the shelf's worth is placed against the pack outline's
   * left edge while living outside the wheel. `CigScroller` hands the
   * mountain button's zoom to its own stage the same way, for the same
   * reason: a sibling needs a number only this component can work out.
   */
  useEffect(() => {
    const up = stageRef.current?.parentElement;
    if (up) up.style.setProperty('--wheel-width', `${plan.width}px`);
  }, [plan.width]);

  /**
   * KEEP THE OFFSET INSIDE ONE LAP.
   *
   * `compute` only draws laps -1..n round the current offset, but nothing was
   * reducing the offset itself — so scrolling one way for long enough walked
   * it past every lap it draws and THE SHELF WENT EMPTY, with no selection at
   * all. About two seconds of scrolling up did it. The offset is wrapped
   * here instead, and anything holding an absolute position — an in-flight
   * seek, a drag's anchor — is shifted by the same amount in the same breath,
   * or wrapping would tear them off the wheel.
   */
  const wrap = useCallback(() => {
    const { lap } = planRef.current;
    if (!(lap > 0)) return;
    const was = offsetRef.current;
    const now = ((was % lap) + lap) % lap;
    if (now === was) return;
    const shift = now - was;
    offsetRef.current = now;
    if (seekRef.current !== null) seekRef.current += shift;
    if (pressRef.current) pressRef.current.off += shift;
  }, []);

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
      wrap();

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
    // THE FIRST TICK COMES AT ONCE, not a whole beat later. A notch's seek
    // lands in a single tick (the seek's time constant is shorter than the
    // beat), so at the beat's own 125ms a notch read as an eighth of a
    // second of nothing and then the whole move — and the controls were
    // gone for 250ms of it. One short tick first makes it move immediately
    // and halves the time they are away.
    timerRef.current = window.setTimeout(tick, FIRST_TICK_MS);
  }, [draw, offCentre, wrap]);

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
    // STOP THE TICK FIRST. It is a closure over the layout that has just
    // been replaced, and it reschedules itself — left running it would go on
    // driving the offset against positions that no longer exist.
    stop();
    // A RESIZE RE-CENTRES THE PACK THAT WAS SELECTED, not whichever happens
    // to be nearest the new middle: every position has changed under it, so
    // the offset has to be put back on the same pack rather than left where
    // it was. The row learned this one the hard way (`offFramed`).
    offsetRef.current = plan.pos[Math.min(pickedRef.current, plan.pos.length - 1)] ?? 0;
    velRef.current = 0;
    seekRef.current = null;
    bucketRef.current = 0;
    draw();
    setResting(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a real resize only
  }, [size.h, size.w, n, plan]);

  useEffect(() => stop, []);

  // ---- the wheel ----------------------------------------------------------
  const rollRef = useRef<(e: WheelEvent) => void>(() => {});
  rollRef.current = (e: WheelEvent) => {
    if (!n) return;
    // React registers `wheel` PASSIVE on the root, so a handler passed as a
    // prop cannot cancel the page's own scroll — this listener is added with
    // { passive: false } below for that reason. CLAUDE.md, the gotchas.

    /*
     * ONE NOTCH, ONE PACK (the owner's 2026-09-21 "make each scroll of a
     * mouse wheel change the selected pack by 1"). The wheel used to push
     * the offset by the raw delta and let the glide and the settle find a
     * pack; now it STEPS, and the seek carries it.
     *
     * A CONTROL INSIDE THE WHEEL GETS THE EVENT FIRST AND KEEPS IT. The
     * quantity stripes are rendered inside the selected slot and cancel
     * their own wheel events, and both listeners are on the bubble path —
     * so without this, rolling a stripe to pick an amount ALSO stepped the
     * shelf, which unmounts the menu mid-gesture and loses the amount. A
     * cancelled event has been dealt with by whatever is under the pointer.
     */
    if (e.defaultPrevented) return;
    e.preventDefault();

    /*
     * A LINE OR A PAGE IS ALREADY ONE NOTCH. `deltaY` is in pixels only
     * when `deltaMode` is 0; Firefox reports LINES, and how many lines a
     * notch is comes from the reader's own system setting — three by
     * default on Windows, but one, six or a whole page are all settings a
     * reader can choose. Multiplying by a guessed line height therefore got
     * one-notch-one-pack right only at the default. These modes are coarse
     * by construction, so one event is taken as one step and the bank is not
     * involved at all.
     */
    if (e.deltaMode !== 0) {
      if (!e.deltaY) return;
      bucketRef.current = 0;
      nudge(Math.sign(e.deltaY));
      return;
    }

    /*
     * AND PIXELS HAVE TO BE ACCUMULATED, because a trackpad is not a notched
     * wheel: it sends a stream of small deltas where a mouse sends one of
     * about 100. Counting events would step a dozen packs per swipe; a bank
     * makes a mouse notch exactly one step and a trackpad swipe a number in
     * proportion to the gesture.
     *
     * THE BANK IS ZEROED ON A STEP rather than drained by the threshold. 40
     * is a test for "a notch happened", not a quantum of travel: drained, a
     * 100px notch would leave 60 behind and step two or three packs, which
     * is the very thing this change is undoing.
     *
     * AN EVENT WITH NO VERTICAL TRAVEL IS NOT A REVERSAL. `Math.sign(0)` is
     * 0, so comparing signs made a horizontal swipe, a tilt wheel, or the
     * zero-delta events Chrome brackets a trackpad gesture with wipe the
     * whole bank — and a shallow diagonal swipe could then never step at
     * all, 160px of real travel selecting nothing.
     */
    const dy = e.deltaY;
    if (!dy) return;
    if (bucketRef.current && (dy > 0) !== (bucketRef.current > 0)) bucketRef.current = 0;
    bucketRef.current += dy;
    if (Math.abs(bucketRef.current) < WHEEL_STEP) return;
    const by = dy > 0 ? 1 : -1;
    bucketRef.current = 0;
    // `nudge` aims from the seek already in flight when there is one, so
    // spinning the wheel quickly queues the packs up rather than losing them
    nudge(by);
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
    // A PRESS THAT NEVER BECAME A DRAG HAS NOTHING TO HAND BACK TO. Running
    // the tick for it takes the controls away and brings them back for
    // nothing, which flickers them on every click.
    if (!draggingRef.current) {
      pressRef.current = null;
      trailRef.current = [];
      return;
    }
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
    /*
     * A PRESS MEANT FOR A CONTROL IS NOT A PRESS ON THE WHEEL, and taking it
     * as one CLOSED THE QUANTITY MENU THE MOMENT IT OPENED. The menu's
     * trigger sits inside the selected slot and cancels its own pointerdown;
     * without this the press also reached the wheel, and the matching
     * pointerup ran `endDrag` -> `run()` -> `setResting(false)`, which
     * unmounts the controls — and the menu is one of them. So the reader
     * pressed the number and nothing appeared.
     */
    if (e.defaultPrevented) return;
    stop();
    // A HAND ON THE WHEEL OUTRANKS ANYTHING THE WHEEL WAS DOING. The seek a
    // notch left in flight has to go, or the drag's anchor is taken from an
    // offset that is still travelling and the release hands back to a target
    // the reader has since dragged away from; and the banked travel has to
    // go with it, or a 3px flick of the wheel afterwards steps a pack on the
    // strength of a gesture that ended.
    seekRef.current = null;
    bucketRef.current = 0;
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
    // THE DISTANCE IS THE ONE ON SCREEN, taken from the instance pressed —
    // that instance is a particular pack on a particular lap, so centring it
    // is always the short way round, where working from the pack's index
    // could send the wheel most of the way round to reach something sitting
    // just off the edge.
    seekRef.current = offsetRef.current + (slot.mid - size.h / 2);
    bucketRef.current = 0;
    velRef.current = 0;
    run();
  };

  const nudge = (by: number) => {
    const { pos, lap } = plan;
    if (!size.h || !(lap > 0)) return;
    const from = seekRef.current ?? offsetRef.current;
    const k = ((from % lap) + lap) % lap;
    // the pack nearest where we are, then `by` places along from it
    let at = 0;
    let bd = Infinity;
    pos.forEach((p, idx) => {
      let d = p - k;
      if (d > lap / 2) d -= lap;
      if (d < -lap / 2) d += lap;
      if (Math.abs(d) < Math.abs(bd)) { bd = d; at = idx; }
    });
    const next = pos[(at + by + pos.length) % pos.length];
    let step = next - pos[at];
    if (step > lap / 2) step -= lap;
    if (step < -lap / 2) step += lap;
    seekRef.current = from + bd + step;
    velRef.current = 0;
    run();
  };

  /**
   * WHERE THE STAR STANDS, from the foot of the pack's own image.
   *
   * The landing page centres its plus between the red frame's foot and the
   * page's foot; here the room is between the pack's outline foot and the
   * top of the pack half-showing below, which is that page's rule with this
   * page's edges. Worked out from the MODEL at rest, never read off a moving
   * wheel — the row's own `cigTagsRight` failure, where an edge read live
   * swung 860 -> 304 -> 794 through one throw.
   */
  const starTop = (slot: Slot) => {
    const { step, height } = plan;
    // the pack below, taken as the shelf's mean so the line does not jog as
    // the wheel passes a tall pack and then a short one
    const mean = height.length ? height.reduce((a, b) => a + b, 0) / height.length : slot.h;
    const gapTop = PACK_RULE;
    const gapFoot = step - slot.h / 2 - (mean * WHEEL_FAR_SCALE) / 2;
    return (gapTop + gapFoot) / 2 - button / 2;
  };

  if (!n) return null;

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
        '--wheel-width': `${plan.width}px`,
        '--wheel-gap': `${wheelGap(button)}px`,
        '--wheel-margin': `${WHEEL_MARGIN}px`,
      } as React.CSSProperties}
    >
      {slots.map((s) => {
        const e = entries[s.i];
        // the instance nearest the middle is the selected one — a pack can be
        // on screen more than once when the shelf is short
        const mine = s.i === picked && Math.abs(s.mid - size.h / 2) < s.h / 2 + WHEEL_MARGIN;
        return (
          <div
            className="shelf-wheel-slot"
            key={s.key}
            style={{ top: `${s.mid}px`, '--slot-scale': s.s } as React.CSSProperties}
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
                starTop={starTop(s)}
              />
            ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
