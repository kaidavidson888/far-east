'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CIG_BAND_H,
  CIG_FRAME_H,
  CIG_GAP,
  CIG_HEIGHT,
  CIG_OUTLINE,
  CIG_PACKS,
  CIG_RULE,
  PAINT_MS,
  CIG_FLING_MAX,
  CIG_FLING_WINDOW_MS,
  CIG_FRAME_HOLD_MS,
  CIG_GLIDE_FRICTION,
  REFERENCE_SPEED,
  SPEED,
  cigLayout,
} from '@/lib/cigRow';

/**
 * The row of packs across the middle of the landing page.
 *
 * It scrolls sideways, forever, and whichever pack is under the frame at the
 * centre is the one you can press. See `lib/cigRow.ts` for where every number
 * comes from — all of it is measured off the two references the owner gave.
 *
 * THE LOOP. The packs are laid end to end into one lap; the offset is taken
 * modulo the lap, and what gets rendered is whatever falls across the
 * viewport, from as many laps as it takes to cover it. So there is no
 * beginning to reach: the 282nd pack is followed by the 1st with the same
 * 26px between them as anywhere else, nothing is duplicated and nothing is
 * teleported. Only the dozen packs actually on screen are ever in the DOM.
 *
 * THE JANK. The source animation runs at 8fps, dead constant, and the owner
 * likes it. The scroll position is integrated smoothly — input has to feel
 * attached to the finger — but the row is only repainted every 125ms, so it
 * steps rather than glides, at exactly the source's cadence. It is one
 * constant (PAINT_MS) if that ever wants softening.
 *
 * THE FRAME. It belongs to the pack, not to the screen: it is drawn around
 * whichever pack is nearest the middle, 8px clear of it on every side, so it
 * travels with that pack and then hops to the next as the lead changes. The
 * source animation has it standing still at the centre, but the packs there
 * are half the size these are and sat well inside it with room to spare; at
 * the size the design draws them, a frame pinned to the centre cuts across
 * whichever pack is passing. The margin is the part that was specified, so
 * the margin is what is kept.
 *
 * Its width comes from the pack for the same reason: these packs are all one
 * height but their own widths, 42 to 92, so a fixed width would cut into the
 * broad ones.
 */
const { left: LEFT, total: LAP } = cigLayout();

/** How far a wheel notch pushes the row, at the owner's pace. */
const WHEEL = 0.8 * SPEED;
/** Below this the glide is spent and the row starts settling. */
const SETTLE_BELOW = 40;
/** How long the settle takes to close the distance — a fifth slower too. */
const SETTLE_TAU = 0.18 / SPEED;
/**
 * Pressing a pack that is not the one in the frame fetches it, at twice the
 * speed the row settles at — the owner's 200%.
 *
 * Half the time constant is twice the speed: both are the same exponential
 * approach, and tau is how long it takes to close 1/e of what is left. It is
 * deliberately the settle's own curve rather than a new easing, so arriving
 * looks like the row coming to rest, which is what it is doing.
 */
const SEEK_TAU = SETTLE_TAU / 2;
/** Rendered a little past each edge so nothing pops in at the boundary. */
const PAD = 120;
/** A pointer that travelled further than this was scrolling, not pressing. */
const SLOP = 6;

type Shown = { key: string; i: number; x: number };

export function CigScroller({
  withPages,
  onPress,
}: {
  /**
   * The packs that have a page of their own. The owner supplied 227
   * info-page vectors for 247 packs, so the rest stay unpressable rather
   * than leading to a 404. Passed from the server so the client bundle
   * does not have to carry the page manifest.
   */
  withPages?: string[];
  onPress?: (id: string) => void;
}) {
  const linked = useMemo(() => new Set(withPages ?? []), [withPages]);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const velRef = useRef(0);
  const draggingRef = useRef(false);
  const timerRef = useRef(0);
  const lastTsRef = useRef(0);
  const widthRef = useRef(0);
  const dragRef = useRef<{
    x: number;
    t: number;
    moved: number;
    /** The tail of the gesture, for working out how fast it was let go. */
    hist: { t: number; x: number }[];
  }>({ x: 0, t: 0, moved: 0, hist: [] });
  const capturedRef = useRef(false);

  const [shown, setShown] = useState<Shown[]>([]);
  const [selected, setSelected] = useState(-1);
  /** Where the frame goes: the picked pack's own left edge on screen. */
  const [pickX, setPickX] = useState(0);
  /**
   * Which pack the FRAME is on, which is not always the one nearest the
   * middle — see CIG_FRAME_HOLD_MS. `pendingSince` is when some other pack
   * first took the middle, or 0 if none has.
   *
   * A ref rather than state because the tick reads it to decide whether to
   * keep running, and a handover that has not landed yet is a reason to keep
   * painting even when nothing else is moving.
   */
  const frameRef = useRef({ i: -1, pendingSince: 0 });

  /**
   * An offset the row is travelling to, set by pressing a pack that is not
   * the picked one. Null the rest of the time.
   *
   * It has to be an absolute target rather than a distance, because the
   * settle below recomputes from wherever the row IS on every tick and always
   * aims at whatever pack is nearest the middle. Aiming at a fixed number is
   * what stops the two fighting over which pack is being fetched — and when
   * the seek lands, the pack it fetched IS the nearest one, so the settle
   * agrees with it and has nothing left to do.
   */
  const seekRef = useRef<number | null>(null);

  /** Everything that lands on screen at the current offset, and the pick. */
  const compute = useCallback(() => {
    const w = widthRef.current;
    if (!w) return null;
    const start = ((offsetRef.current % LAP) + LAP) % LAP;
    const laps = Math.ceil((w + PAD * 2) / LAP) + 1;
    const out: Shown[] = [];
    for (let lap = -1; lap <= laps; lap++) {
      const base = lap * LAP - start;
      for (let i = 0; i < CIG_PACKS.length; i++) {
        const x = base + LEFT[i];
        if (x > w + PAD) break; // packs are in order, so nothing later fits
        if (x + CIG_PACKS[i].w >= -PAD) out.push({ key: `${lap}:${i}`, i, x });
      }
    }
    const mid = w / 2;
    let pick = -1;
    let pickAt = 0;
    let best = Infinity;
    for (const s of out) {
      const d = Math.abs(s.x + CIG_PACKS[s.i].w / 2 - mid);
      if (d < best) {
        best = d;
        pick = s.i;
        pickAt = s.x;
      }
    }
    return { out, pick, pickAt, w };
  }, []);

  const paint = useCallback(() => {
    const m = compute();
    if (!m) return;
    setShown(m.out);

    // The frame keeps its pack until another has held the middle for
    // CIG_FRAME_HOLD_MS without interruption. A pack that takes the middle
    // and loses it again inside that window never gets the frame at all,
    // which is what stops it flickering as the row settles across a boundary.
    const now = performance.now();
    const f = frameRef.current;
    if (f.i < 0) {
      f.i = m.pick;
      f.pendingSince = 0;
    } else if (m.pick === f.i) {
      f.pendingSince = 0;
    } else if (f.pendingSince === 0) {
      f.pendingSince = now;
    } else if (now - f.pendingSince >= hold(velRef.current)) {
      f.i = m.pick;
      f.pendingSince = 0;
    }

    // Where that pack is now. It has kept moving while the frame held it, and
    // it can be on screen more than once, so take the instance nearest the
    // middle.
    let at = null;
    let best = Infinity;
    for (const s of m.out) {
      if (s.i !== f.i) continue;
      const d = Math.abs(s.x + CIG_PACKS[s.i].w / 2 - m.w / 2);
      if (d < best) {
        best = d;
        at = s.x;
      }
    }

    // If the pack has left the screen there is no position to draw the frame
    // at, so it hands over at once. There is no distance clamp beside this any
    // more: the hold shortens as the row speeds up, which caps the drift at
    // HOLD * REFERENCE_SPEED — 47px — without a second rule to arrive at it.
    if (at === null) {
      f.i = m.pick;
      f.pendingSince = 0;
      at = m.pickAt;
    }

    setSelected(f.i);
    setPickX(at);
  }, [compute]);

  /**
   * How long the frame holds its pack, given how fast the row is going.
   *
   * A fixed hold is the wrong shape, because what it is suppressing is not
   * fixed. The flicker worth ignoring happens when the row is BARELY moving —
   * it crosses a boundary as it settles, comes back, and the frame would
   * change hands twice for a movement of a few pixels. At speed there is no
   * flicker to suppress: packs pass the middle decisively, one after another,
   * and a frame that keeps holding the last one just falls behind the row.
   *
   * So the hold is scaled by momentum: full at a standstill, and shrinking as
   * the row moves, against REFERENCE_SPEED — the pace the owner's own
   * recording runs at, which is the natural yardstick for "moving".
   *
   *   at rest            250ms, the full hold
   *   reference speed    125ms, one frame of the row's 8fps
   *   three times it      62ms, less than a frame: no hold at all
   *
   * This is also what keeps the frame near the middle without a separate
   * distance clamp doing it: the faster the pack is travelling, the less time
   * it is allowed to carry the frame, so the drift cannot run away with speed
   * the way a fixed hold let it.
   */
  const hold = (v: number) => CIG_FRAME_HOLD_MS / (1 + Math.abs(v) / REFERENCE_SPEED);

  /** How far the row is from having the nearest pack dead centre. */
  const offCentre = useCallback(() => {
    const m = compute();
    if (!m || m.pick < 0) return 0;
    return m.pickAt + CIG_PACKS[m.pick].w / 2 - m.w / 2;
  }, [compute]);

  /**
   * The clock.
   *
   * The row is an 8fps animation on purpose, so it is driven by a 125ms
   * timer rather than by rAF: the cadence is the design, not a consequence
   * of when the compositor happens to be free, and a timer holds it whatever
   * else the page is doing. The motion is integrated on the same beat, which
   * makes every step exactly one frame's worth.
   */
  const run = useCallback(() => {
    if (timerRef.current) return;
    lastTsRef.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - lastTsRef.current) / 1000);
      lastTsRef.current = now;

      let settling = false;
      if (!draggingRef.current && seekRef.current !== null) {
        // fetching a pressed pack: aim at the fixed target, ignore the settle
        const rest = seekRef.current - offsetRef.current;
        if (Math.abs(rest) > 0.5) {
          offsetRef.current += rest * Math.min(1, dt / SEEK_TAU);
          settling = true;
        } else {
          offsetRef.current = seekRef.current;
          seekRef.current = null;
        }
      } else if (!draggingRef.current) {
        if (Math.abs(velRef.current) > SETTLE_BELOW) {
          // Friction: a constant rate of braking, not a decay proportional to
          // the speed. Position is integrated against the AVERAGE of the
          // velocity before and after the step rather than either end of it —
          // for a constant acceleration that is exact, where taking one end
          // over-runs and the other falls short, each by half the step's own
          // change in speed.
          const was = velRef.current;
          const drop = CIG_GLIDE_FRICTION * dt;
          velRef.current = Math.abs(was) <= drop ? 0 : was - Math.sign(was) * drop;
          offsetRef.current += ((was + velRef.current) / 2) * dt;
        } else {
          // The glide is spent, so bring the nearest pack to the middle
          // rather than resting wherever it happened to stop. The source
          // animation never stops, so it says nothing about how to come to
          // rest; the design's own still has the framed pack dead centre.
          velRef.current = 0;
          const off = offCentre();
          if (Math.abs(off) > 0.5) {
            offsetRef.current += off * Math.min(1, dt / SETTLE_TAU);
            settling = true;
          }
        }
      }

      paint();

      // A handover that has not landed yet is a reason to keep painting, even
      // with the row at a standstill: the half second has to be able to run
      // out after everything else has stopped.
      const owed = frameRef.current.pendingSince !== 0;
      if (draggingRef.current || velRef.current !== 0 || settling || owed) {
        timerRef.current = window.setTimeout(tick, PAINT_MS);
      } else {
        timerRef.current = 0;
      }
    };
    timerRef.current = window.setTimeout(tick, PAINT_MS);
  }, [offCentre, paint]);

  const nudge = useCallback(
    (dx: number) => {
      // a hand on the row outranks a seek it did not ask for
      seekRef.current = null;
      offsetRef.current += dx;
      run();
    },
    [run],
  );

  /**
   * Bring a pack that is not the picked one into the frame.
   *
   * The distance is the one on screen: the slot pressed is a particular
   * instance of that pack on a particular lap, so centring THAT instance is
   * always the short way round. Working from the pack's index instead would
   * have to choose a lap, and could send the row most of the way across the
   * set to reach a pack sitting just off the edge of the frame.
   */
  const seekTo = useCallback(
    (x: number, i: number) => {
      const m = compute();
      if (!m) return;
      velRef.current = 0;
      seekRef.current = offsetRef.current + (x + CIG_PACKS[i].w / 2 - m.w / 2);
      run();
    },
    [compute, run],
  );

  /** Width, and the first paint. */
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    let first = true;
    const measure = () => {
      widthRef.current = el.clientWidth;
      if (first) {
        // Arrive with the first pack framed dead centre rather than with
        // whichever one an offset of zero happens to leave nearest, so the
        // page looks the same on every load and at every width — which is
        // what the design's own still shows.
        offsetRef.current = CIG_PACKS[0].w / 2 - widthRef.current / 2;
        first = false;
      } else if (!timerRef.current && !draggingRef.current) {
        // a resize moves the middle; bring the framed pack back to it
        offsetRef.current += offCentre();
      }
      paint();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [offCentre, paint]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /** Wheel. Non-passive, because a vertical wheel is turned sideways here. */
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      const by = d * WHEEL;
      offsetRef.current += by;
      // a wheel is already a series of shoves, so the glide only carries the
      // tail of it — enough that it does not stop dead under the finger. Half
      // what a deliberate fling may reach: a notch is not a throw.
      const cap = CIG_FLING_MAX / 2;
      velRef.current = Math.max(-cap, Math.min(cap, by * 6));
      run();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [run]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // NOT preventDefault here. Doing that stops the browser picking a pack
    // up as an image, but it also suppresses the compatibility mouse
    // events that follow — including the click — so the pack underneath
    // stopped being pressable at all. Dragging is held off by
    // draggable={false} on the image and by onDragStart below, which cost
    // nothing else; selection is held off by user-select in the CSS.
    draggingRef.current = true;
    velRef.current = 0;
    dragRef.current = {
      x: e.clientX,
      t: performance.now(),
      moved: 0,
      hist: [{ t: performance.now(), x: e.clientX }],
    };
    run();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const now = performance.now();
    const dx = e.clientX - dragRef.current.x;
    offsetRef.current -= dx;

    // Keep the tail of the gesture and take the speed across the whole of it,
    // not from the last pair of points. Pointer events do not arrive evenly,
    // and one short gap between two of them is enough to report a throw twice
    // as fast as the hand really moved.
    const hist = dragRef.current.hist;
    hist.push({ t: now, x: e.clientX });
    while (hist.length > 2 && now - hist[0].t > CIG_FLING_WINDOW_MS) hist.shift();

    dragRef.current = {
      x: e.clientX,
      t: now,
      moved: dragRef.current.moved + Math.abs(dx),
      hist,
    };

    const first = hist[0];
    const span = (now - first.t) / 1000;
    const v = span > 0 ? -(e.clientX - first.x) / span : 0;
    velRef.current = Math.max(-CIG_FLING_MAX, Math.min(CIG_FLING_MAX, v));
    // Capture only once this is really a drag. Capturing on pointerdown
    // retargets the compatibility mouse events to the row, so the click
    // landed on the row instead of the pack's link and the packs were not
    // pressable. A press that never moves never captures.
    if (!capturedRef.current && dragRef.current.moved > SLOP) {
      capturedRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (capturedRef.current) {
      capturedRef.current = false;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    run();
  };

  /**
   * One pack along.
   *
   * The distance between two packs is set by the width of the left one of
   * the pair, so stepping back is the *previous* pack's pitch, not this
   * one's — packs are 38 to 80 wide and using the wrong end of the pair
   * lands short of where you came from.
   */
  const stepBy = (dir: 1 | -1) => {
    if (selected < 0) return CIG_GAP * dir;
    const n = CIG_PACKS.length;
    const from = dir === 1 ? selected : (selected - 1 + n) % n;
    return (CIG_PACKS[from].w + CIG_GAP) * dir;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudge(stepBy(1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudge(stepBy(-1));
    }
  };

  const pick = selected >= 0 ? CIG_PACKS[selected] : null;

  return (
    <div
      ref={rowRef}
      className="cig-row"
      style={
        {
          height: `${CIG_BAND_H}px`,
          '--cig-rule': `${CIG_RULE.thickness}px`,
          '--cig-red': CIG_OUTLINE.colour,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragStart={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="Cigarettes"
    >
      <div className="cig-track">
        {shown.map((s) => {
          const p = CIG_PACKS[s.i];
          const style: React.CSSProperties = {
            left: `${Math.round(s.x)}px`,
            width: `${p.w}px`,
            height: `${CIG_HEIGHT}px`,
          };
          const img = (
            <img
              className="cig-pack"
              src={`/cigs/${p.id}.svg`}
              alt=""
              width={p.w}
              height={CIG_HEIGHT}
              draggable={false}
              decoding="async"
            />
          );
          if (s.i !== selected) {
            // Pressing a pack that is not in the frame fetches it rather than
            // opening it: one press to bring it in, a second to go to it.
            //
            // A button, so a pointer gets the right semantics and the press
            // cursor — but tabIndex -1 and aria-hidden, because the ROW is the
            // control as far as a keyboard and a screen reader are concerned.
            // Fifteen more tab stops that each only scroll the thing you are
            // already standing on would be worse than none, and the arrow keys
            // already move the selection a pack at a time.
            const fetch = (e: React.MouseEvent) => {
              if (dragRef.current.moved > SLOP) {
                e.preventDefault();
                return;
              }
              seekTo(s.x, s.i);
            };
            return (
              <button
                key={s.key}
                type="button"
                tabIndex={-1}
                className="cig-slot"
                style={style}
                data-cig={p.id}
                aria-hidden="true"
                onClick={fetch}
              >
                {img}
              </button>
            );
          }
          // a drag that happens to end over the pack is not a press
          const pressed = (e: React.MouseEvent) => {
            if (dragRef.current.moved > SLOP) {
              e.preventDefault();
              return;
            }
            onPress?.(p.id);
          };
          if (linked.has(p.id)) {
            return (
              <Link
                key={s.key}
                href={`/packs/${encodeURIComponent(p.id)}`}
                className="cig-slot cig-slot-picked"
                style={style}
                data-cig={p.id}
                aria-label={p.name}
                draggable={false}
                onClick={pressed}
              >
                {img}
              </Link>
            );
          }
          return (
            <button
              key={s.key}
              type="button"
              className="cig-slot cig-slot-picked"
              style={style}
              data-cig={p.id}
              aria-label={p.name}
              onClick={pressed}
            >
              {img}
            </button>
          );
        })}
      </div>

      {pick ? (
        <span
          className="cig-frame"
          aria-hidden="true"
          style={{
            left: `${Math.round(pickX) - CIG_OUTLINE.x}px`,
            top: `${(CIG_BAND_H - CIG_FRAME_H) / 2}px`,
            width: `${pick.w + CIG_OUTLINE.x * 2}px`,
            height: `${CIG_FRAME_H}px`,
            borderWidth: `${CIG_OUTLINE.stroke}px`,
            borderColor: CIG_OUTLINE.colour,
          }}
        />
      ) : null}

      {/* the keyboard rules, above and below — see CIG_RULE */}
      <span className="cig-rule cig-rule-top" aria-hidden="true" />
      <span className="cig-rule cig-rule-bottom" aria-hidden="true" />
    </div>
  );
}
