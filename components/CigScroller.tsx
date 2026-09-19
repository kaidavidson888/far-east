'use client';

import Link from 'next/link';
import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { savedPacksAction } from '@/app/actions';
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
  CIG_BRAKE,
  CIG_SPIN_SPEED,
  CIG_SPIN_LAP,
  CIG_SPIN_CATCH,
  CIG_SPIN_PAINT_MS,
  cigPaintMs,
  REFERENCE_SPEED,
  SPEED,
  cigLayout,
  cigZoom,
  CIG_CONTROLS,
  CIG_MENU_SHUT_MS,
  type CigPack,
} from '@/lib/cigRow';
import { LANDING_ROW_CLEAR } from '@/lib/landing';
import { CIG_HEADING_SIZE, CIG_TAG_MENU, TAG_HEADING, fitLabel, matchingPacks } from '@/lib/cigTags';
import { CIG_TOGGLE_GLYPH } from '@/lib/cigToggleGlyph';

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
/**
 * THE ROW'S CONTENTS ARE NOT FIXED, so its layout cannot be a module
 * constant any more. Pressing My Saved swaps the catalogue for the reader's
 * own shelf mid-spin, and the shelf is a different number of packs of
 * different widths — so `left` and the lap length both change with it. Both
 * live in a ref that the tick reads, alongside the state the render reads.

/** How far a wheel notch pushes the row, at the owner's pace. */
const WHEEL = 0.8 * SPEED;
/**
 * Below this the glide is spent and the row starts settling.
 *
 * Low, so friction carries the row almost the whole way down and the handover
 * to the centring happens while it is already crawling. A high threshold hands
 * over at a speed you can still see, and the change of rule shows as a kink.
 */
const SETTLE_BELOW = 25;
/**
 * How long the settle takes to close the last of the distance.
 *
 * The glide now spends its own last second crawling — at the reference
 * wheel's rate that is the final 100px/s, about a pack a second — so the
 * centring no longer has to supply the unhurried ending, and doing it twice
 * read as hesitancy rather than weight. 0.2 closes about 60% of what is left
 * each tick: enough to place the pack, quick enough not to be a second act.
 */
const SETTLE_TAU = 0.2 / SPEED;
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

/**
 * THE MENU LIVES UNDER THE RED FRAME, SCALED TO ITS WIDTH — the owner's
 * 2026-09-19 ask, in full: "move the + button under the middle cigarette
 * aligned on its vertical axis equidistance between the end of the red
 * outline and the bottom edge of the page. On menu open slide alignment with
 * the left edge of the red outline and maintain the same top and bottom
 * margins. Change to minus. Scale all elements including the + button to make
 * the menu bar and menu catalogue fit within the edges of the red outline."
 *
 * So everything the plus owns — the plus, the bar beside it (seal, 發, the
 * outline, reset), confirm and the tag grid — is ONE BOX, laid out in the
 * design's own px and drawn with a CSS `zoom` (which lays it out again at the
 * new size, so type stays sharp; a transform would scale finished pixels).
 *
 * THE DESIGN WIDTH is the narrowest the menu can be while every part keeps
 * its shape: confirm, then a tag grid two buttons wide — the headings are
 * drawn two buttons wide — with its 15px scrollbar beside it. The bar (plus,
 * seal, 發, outline, reset: 241) is narrower, so the grid decides. The zoom is
 * the frame's width over that, so the menu runs from the frame's left edge to
 * its right edge exactly.
 */
const MENU_DESIGN_W = CIG_CONTROLS.width * 3 + CIG_CONTROLS.gap * 2 + 15;
/**
 * The smallest the menu is ever drawn. At the owner's 1920x947 desktop the
 * frame gives 0.73 to 0.82 for nine packs in ten (measured: 0.7286 on a
 * 50-wide pack, 0.817 on a wider one), and only the narrowest few packs reach
 * this. On a narrow window the frame is so small that the tags' type would
 * fall under the 9px this site knows will not render solid (a heading is
 * 12.86px at full size), so there the menu stops shrinking and runs past the
 * frame's right edge instead. A judgement, not the owner's instruction — the
 * same call as the shelf's ROW_SCALE_FLOOR.
 */
const MENU_MIN_ZOOM = 0.7;

type MenuLayout = {
  /** the menu's zoom */
  s: number;
  /** its top, in screen px from the controls' box: the plus's line */
  top: number;
  /** its left when shut: the plus centred under the middle pack */
  shutLeft: number;
  /** its left when open: the frame's left edge */
  openLeft: number;
  /** how tall the tag grid may be, in the menu's own (design) px */
  room: number;
};

export function CigScroller({
  withPages,
  onPress,
  marks,
}: {
  /**
   * The packs that have a page of their own. The owner supplied 227
   * info-page vectors for 247 packs, so the rest stay unpressable rather
   * than leading to a 404. Passed from the server so the client bundle
   * does not have to carry the page manifest.
   */
  withPages?: string[];
  onPress?: (id: string) => void;
  /**
   * What stands on the controls' line between the plus and reset — on the
   * landing page the seal, then the tile with the outline and number (the
   * owner's 2026-09-19 asks). It comes in from the page because the line it
   * joins is laid out HERE, on the client, from the band's height at the
   * live zoom; nothing placed from the artwork spec could find it. PASS AN
   * ARRAY WITH KEYS, one entry per item: each entry becomes its own slot in
   * the reveal's stagger, and a fragment would arrive as one. The marks size
   * themselves; this only puts them in a row.
   */
  marks?: React.ReactNode;
}) {
  const linked = useMemo(() => new Set(withPages ?? []), [withPages]);

  /**
   * What the row is showing: the whole catalogue, or the reader's shelf after
   * a My Saved spin. The ref is what the tick reads — it has to see the swap
   * the instant it happens, in the middle of a frame — and the state is what
   * the render reads. They are set together and never diverge.
   */
  const [packs, setPacks] = useState<CigPack[]>(CIG_PACKS);
  const packsRef = useRef<CigPack[]>(CIG_PACKS);
  const layoutRef = useRef(cigLayout(CIG_PACKS));

  const rowRef = useRef<HTMLDivElement | null>(null);
  /** The tag grid, which is the box the menu's own scrollbar belongs to. */
  const tagsRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const velRef = useRef(0);
  const draggingRef = useRef(false);
  const timerRef = useRef(0);
  const lastTsRef = useRef(0);
  const widthRef = useRef(0);
  /** How much bigger the row is drawn than it is laid out — see cigZoom. */
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  /** The tag menu: whether the plus has been opened, and what is picked in it. */
  const [tagsOpen, setTagsOpen] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * WHERE THE MENU STANDS, AND HOW BIG IT IS DRAWN — worked out from the red
   * frame, at rest. See `layoutMenu` below. Null until the first measure, and
   * the menu is not shown until then, so it never flashes in the corner.
   */
  const [menu, setMenu] = useState<MenuLayout | null>(null);
  /**
   * Whether the menu's moves are animated yet: from the frame after it was
   * first placed, so its first placement lands rather than sliding in from
   * the corner, and everything after — opening, closing, following the
   * frame to a new pack — slides.
   */
  const [menuSlides, setMenuSlides] = useState(false);
  useEffect(() => {
    if (!menu || menuSlides) return;
    const id = window.setTimeout(() => setMenuSlides(true), 50);
    return () => window.clearTimeout(id);
  }, [menu, menuSlides]);
  /** The controls' own box, which is the page the menu is placed on. */
  const controlsRef = useRef<HTMLDivElement | null>(null);
  /**
   * Whether the menu is PAINTED, which is not the same as open: it is held
   * on for the length of the close so the buttons can be seen leaving.
   *
   * A shut menu that is still painted leaves its scrollbar hanging down the
   * page beside nothing, which is what the owner saw. Visibility is what
   * takes the bar away without touching the layout — the gutter stays
   * reserved, so the grid has the same columns shut or open, where hiding
   * the overflow instead would drop one at the moment of opening.
   */
  const [menuPainted, setMenuPainted] = useState(false);
  const dragRef = useRef<{
    x: number;
    t: number;
    moved: number;
    /** The tail of the gesture, for working out how fast it was let go. */
    hist: { t: number; x: number }[];
  }>({ x: 0, t: 0, moved: 0, hist: [] });
  const capturedRef = useRef(false);
  /** Takes down the window's release listeners for the drag in progress. */
  const releaseRef = useRef<(() => void) | null>(null);

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

  /**
   * The My Saved spin, or null when the row is behaving normally.
   *
   * `travelled` counts the distance covered since the throw, so the swap can
   * happen after exactly one lap rather than after a wall-clock guess.
   * `ids` is the shelf, which arrives from the server WHILE the wheel is
   * already turning — the round trip happens inside the spin instead of in
   * front of it, so the press answers instantly and the network is free.
   *
   * If the shelf is slow the row keeps spinning past one lap and swaps on the
   * next frame after it lands. It never swaps early, and it never stops to
   * wait: both would show the reader the seam this is built to hide.
   */
  const spinRef = useRef<{
    /** 'throw' is the fast lap; 'catch' is the wheel being caught after it. */
    phase: 'throw' | 'catch';
    travelled: number;
    ids: string[] | null;
  } | null>(null);

  /**
   * Set for the whole of the My Saved animation, which the owner asked to be
   * unskippable. Every input the row has — wheel, drag, arrow keys, and
   * pressing a pack — checks it and does nothing. It is cleared in one place
   * only: where the tick decides the row has come to rest.
   */
  const lockRef = useRef(false);
  const [locked, setLocked] = useState(false);

  /** Everything that lands on screen at the current offset, and the pick. */
  const compute = useCallback(() => {
    const w = widthRef.current;
    if (!w) return null;
    const list = packsRef.current;
    const { left: LEFT, total: LAP } = layoutRef.current;
    const start = ((offsetRef.current % LAP) + LAP) % LAP;
    const laps = Math.ceil((w + PAD * 2) / LAP) + 1;
    const out: Shown[] = [];
    for (let lap = -1; lap <= laps; lap++) {
      const base = lap * LAP - start;
      for (let i = 0; i < list.length; i++) {
        const x = base + LEFT[i];
        if (x > w + PAD) break; // packs are in order, so nothing later fits
        if (x + list[i].w >= -PAD) out.push({ key: `${lap}:${i}`, i, x });
      }
    }
    const mid = w / 2;
    let pick = -1;
    let pickAt = 0;
    let best = Infinity;
    for (const s of out) {
      const d = Math.abs(s.x + list[s.i].w / 2 - mid);
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
      const d = Math.abs(s.x + packsRef.current[s.i].w / 2 - m.w / 2);
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
    return m.pickAt + packsRef.current[m.pick].w / 2 - m.w / 2;
  }, [compute]);

  /**
   * How far the row is from having the FRAMED pack dead centre.
   *
   * What a resize wants: the pack in the frame is the one the reader was
   * looking at, so it is the one to bring back to the new middle — the
   * nearest pack to a middle that has just moved is somebody else. Where the
   * framed pack is no longer on screen at all (or nothing is framed yet)
   * there is nothing to keep, and the nearest is the answer after all; the
   * paint that follows hands the frame over at once in that case.
   */
  const offFramed = useCallback(() => {
    const m = compute();
    if (!m || m.pick < 0) return 0;
    const list = packsRef.current;
    const i = frameRef.current.i;
    let at: number | null = null;
    if (i >= 0 && i < list.length) {
      let best = Infinity;
      for (const s of m.out) {
        if (s.i !== i) continue;
        const d = Math.abs(s.x + list[i].w / 2 - m.w / 2);
        if (d < best) {
          best = d;
          at = s.x;
        }
      }
    }
    if (at === null) return m.pickAt + list[m.pick].w / 2 - m.w / 2;
    return at + list[i].w / 2 - m.w / 2;
  }, [compute]);

  /**
   * Where the menu goes, worked out from the red frame AT REST — which is
   * when this is called: on every measure, and whenever the row comes to a
   * stop. At rest the framed pack is dead centre (the row's own rule), so the
   * frame is the pack's width plus its outline, times the row's zoom, centred
   * on the page; and it is always the band's height, centred on the page's
   * middle, so its foot is the middle plus half its height. Worked from that
   * model rather than read off the DOM, because the tick decides it has
   * stopped before React has drawn the frame where it stopped.
   *
   * While the row MOVES the menu holds where it was, the grid's old rule
   * ("measured once, then held") — a menu that chased every pack sliding past
   * would never be still. When the row settles on a pack of another width,
   * the menu slides to its new frame and takes its new size.
   *
   *   - the plus, shut: centred under the middle pack, and its line halfway
   *     between the frame's foot and the page's foot;
   *   - open: the same line (the owner's "maintain the same top and bottom
   *     margins"), slid left until the menu's left is the frame's;
   *   - the tag grid below it runs down to the page's foot, less the
   *     controls' own 12px edge, and scrolls inside that.
   */
  const layoutMenu = useCallback(() => {
    const el = controlsRef.current;
    if (!el) return;
    const Wc = el.clientWidth;
    const Hc = el.clientHeight;
    const list = packsRef.current;
    const i = frameRef.current.i;
    if (!Wc || !Hc || i < 0 || i >= list.length) return;
    const z = zoomRef.current;
    const frameW = (list[i].w + CIG_OUTLINE.x * 2) * z;
    const frameFoot = Hc / 2 + (CIG_FRAME_H * z) / 2;
    const s = +Math.max(MENU_MIN_ZOOM, frameW / MENU_DESIGN_W).toFixed(4);
    const plus = CIG_CONTROLS.height * s;
    const top = Math.round(frameFoot + (Hc - frameFoot - plus) / 2);
    const gridTop = top + (CIG_CONTROLS.height + CIG_CONTROLS.gap) * s;
    const next: MenuLayout = {
      s,
      top,
      shutLeft: Math.round(Wc / 2 - plus / 2),
      openLeft: Math.round(Wc / 2 - frameW / 2),
      room: Math.max(CIG_CONTROLS.height, Math.floor((Hc - CIG_CONTROLS.edge - gridTop) / s)),
    };
    setMenu((was) =>
      was &&
      was.s === next.s &&
      was.top === next.top &&
      was.shutLeft === next.shutLeft &&
      was.openLeft === next.openLeft &&
      was.room === next.room
        ? was
        : next,
    );
  }, []);

  /**
   * Put a different set of packs on the row, mid-spin.
   *
   * The shelf holds ids; the row needs the packs themselves, in the shelf's
   * own order — most recently saved first, which is what `savedPackIds`
   * returns. Anything the row cannot draw is already filtered server-side.
   *
   * AN EMPTY SHELF IS LEFT ALONE. A row of nothing has no packs to frame and
   * no lap to travel, so the spin plays out on the catalogue instead and the
   * reader is put back where they started. See the note in the header about
   * what that says and does not say.
   */
  const swapTo = useCallback((ids: string[]) => {
    const byId = new Map(CIG_PACKS.map((p) => [p.id, p] as const));
    const next = ids.map((id) => byId.get(id)).filter((p): p is CigPack => !!p);
    if (!next.length) return;

    packsRef.current = next;
    layoutRef.current = cigLayout(next);
    setPacks(next);

    // The offset is taken modulo the lap and the lap has just changed length,
    // so it is reset rather than carried across. Nothing on screen is legible
    // at spin speed, so there is no continuity to protect — and starting from
    // zero means where the row finally stops depends only on the physics,
    // which makes it the same every time.
    offsetRef.current = 0;
    frameRef.current = { i: -1, pendingSince: 0 };
  }, []);

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
      const spin = spinRef.current;
      if (spin) {
        // Nothing else in the tick gets a say while a spin is running — that
        // is what unskippable means here, and it is why this branch is first.
        if (spin.phase === 'throw') {
          // The fast lap: one constant speed, no braking, until a whole lap
          // has gone by AND the shelf is loaded.
          const v = velRef.current;
          offsetRef.current += v * dt;
          spin.travelled += v * dt;
          if (spin.travelled >= CIG_SPIN_LAP && spin.ids) {
            swapTo(spin.ids);
            spin.phase = 'catch';
          }
        } else {
          // The catch: the momentum comes back down to the ordinary amount
          // over CIG_SPIN_CATCH rather than being assigned there between two
          // frames. Same trapezoidal step the ordinary brake uses, so the
          // distance is right for a constant rate rather than over-run.
          const was = velRef.current;
          const drop = CIG_SPIN_CATCH * dt;
          const now2 = Math.max(CIG_FLING_MAX, was - drop);
          velRef.current = now2;
          offsetRef.current += ((was + now2) / 2) * dt;
          if (now2 <= CIG_FLING_MAX) {
            // Caught. From here the row is braked by CIG_BRAKE and centred by
            // the settle exactly as it is after any other throw — the rest of
            // the animation is not animation code at all.
            spinRef.current = null;
          }
        }
      } else if (!draggingRef.current && seekRef.current !== null) {
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
          // One constant rate of braking, measured off the owner's reference
          // wheel — see CIG_BRAKE. Position is integrated against the AVERAGE
          // of the velocity before and after the step rather than either end
          // of it: for a constant rate that is exact, where taking one end
          // over-runs and the other falls short, each by half the step's own
          // change in speed.
          const was = velRef.current;
          const drop = CIG_BRAKE * dt;
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
          } else {
            // The last half pixel is taken in one go, so the row rests with
            // the pack EXACTLY centred rather than wherever inside that half
            // pixel the exponential happened to give up — times the zoom,
            // that was up to a pixel and a half out on screen (measured:
            // -1.6px after one throw, 0.3 after the next). Too small a step
            // to see, and it makes where the row rests the same every time.
            offsetRef.current += off;
          }
        }
      }

      // THE ROW MAY NOT STOP OFF-CENTRE, however it got here. The owner's
      // rule (2026-09-19): "make sure the selector red rectangle always ends
      // up on the middle image by the end of the scroll". The settle above is
      // what centres a pack, but it only runs on a tick that reaches it, and
      // three ways of arriving at rest skipped it: a late tick (a throttled
      // timer, dt up to 0.25s) that braked the velocity straight to 0 from
      // just above SETTLE_BELOW; a seek landing on a target worked out from a
      // position a few px stale; and a resize while the row was moving. So
      // the stop test asks the question itself rather than trusting how the
      // row got here: if nothing is steering it and no pack is centred, it
      // is settling, and the next tick settles it.
      if (
        !settling &&
        !draggingRef.current &&
        !spinRef.current &&
        seekRef.current === null &&
        velRef.current === 0 &&
        Math.abs(offCentre()) > 0.5
      ) {
        settling = true;
      }

      paint();

      // A handover that has not landed yet is a reason to keep painting, even
      // with the row at a standstill: the half second has to be able to run
      // out after everything else has stopped.
      const owed = frameRef.current.pendingSince !== 0;
      if (draggingRef.current || velRef.current !== 0 || settling || owed) {
        // THE WHOLE SPIN IS PAINTED SMOOTHLY, throw to standstill, not just
        // the fast part. Handing back to the owner's 8fps at the moment the
        // wheel starts slowing left the slowdown visibly stepping — 379px/s
        // at 125ms is 47px a frame, half a pack at a time — and the owner
        // called that choppy. It is: 8fps describes the idle scroll the
        // reference recording measured, and a wheel coming to rest after a
        // throw is not that motion.
        //
        // So while the spin holds the lock the row paints at
        // CIG_SPIN_PAINT_MS, and it only returns to 8fps once the row has
        // actually stopped — where a change of frame rate cannot be seen,
        // because nothing is moving. Every ordinary motion still runs at
        // PAINT_MS, because none of them take the lock. cigPaintMs is what
        // covers those, and it returns PAINT_MS for all of them.
        timerRef.current = window.setTimeout(
          tick,
          lockRef.current ? CIG_SPIN_PAINT_MS : cigPaintMs(velRef.current),
        );
      } else {
        timerRef.current = 0;
        // The row has come to rest, which is the end of the My Saved
        // animation and the only place the lock comes off.
        if (lockRef.current) {
          lockRef.current = false;
          setLocked(false);
        }
        // ...and where the menu takes its place under the frame it stopped on
        layoutMenu();
      }
    };
    timerRef.current = window.setTimeout(tick, PAINT_MS);
  }, [layoutMenu, offCentre, paint, swapTo]);

  const nudge = useCallback(
    (dx: number) => {
      // a hand on the row outranks a seek it did not ask for
      seekRef.current = null;
      // THE MENU CLOSES THE MOMENT THE READER STARTS TO SCROLL (the owner's
      // 2026-09-19 ask: "make it so the menu automatically closes and plays
      // the closing animation as soon as the user begins to scroll"). It
      // stands under the red frame, sized to it, and the frame is about to
      // move to another pack. Closing is just the state the minus sets, so
      // the closing animation is the minus's own: the bar gathers back into
      // the plus, the tags leave, the plus slides back to the middle. Four
      // ways a reader moves the row, four calls: the arrow keys (here), the
      // wheel, a press that becomes a drag, and pressing another pack to
      // fetch it. The row moving on its own — a spin from My Saved, reset
      // or confirm — does not close it; reset in particular leaves it open
      // by the owner's earlier rule. Already shut, it costs nothing: React
      // drops a state set to the value it already has.
      setTagsOpen(false);
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
      // Where the pressed pack is NOW. `x` is where the last paint drew it,
      // and the offset can have moved since without a paint — the press's
      // own few px of wobble, a wheel notch — so a target worked out from
      // the drawn position lands that far off-centre. Take the instance of
      // this pack nearest where it was drawn, at its live position.
      let at = x;
      let best = Infinity;
      for (const s of m.out) {
        if (s.i !== i) continue;
        const d = Math.abs(s.x - x);
        if (d < best) {
          best = d;
          at = s.x;
        }
      }
      velRef.current = 0;
      seekRef.current = offsetRef.current + (at + packsRef.current[i].w / 2 - m.w / 2);
      // fetching a pack scrolls the row to it, so the menu goes away — see `nudge`
      setTagsOpen(false);
      run();
    },
    [compute, run],
  );

  /**
   * Throw the wheel. This is the whole My Saved animation.
   *
   * The spin starts on the press, and the shelf is fetched alongside it, so
   * the wheel is already turning while the server answers. By the time a lap
   * has gone by the list is almost always there; if it is not, the tick keeps
   * spinning and swaps on the frame after it lands.
   */
  /**
   * Have the browser decode a set of packs before the row is asked to draw
   * them.
   *
   * WITHOUT THIS THE SWAP IS THE JITTER. Handing React fifteen new `src`es
   * mid-spin means fifteen fetches and fifteen decodes, and until those land
   * the slots are empty — the row visibly thins out for a beat at the exact
   * moment it is supposed to be turning too fast to read. Decoding first
   * costs nothing, because it happens while the wheel is already spinning.
   *
   * It resolves rather than rejects on a failed image: one pack that will not
   * load is not a reason to spin forever.
   */
  const preload = useCallback(async (ids: string[]) => {
    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((done) => {
            const img = new Image();
            img.onload = () => done();
            img.onerror = () => done();
            img.src = `/cigs/${encodeURIComponent(id)}.svg`;
          }),
      ),
    );
  }, []);

  /**
   * Throw the wheel, and swap the row for `next` when a lap has gone by.
   *
   * `next` is given a list to show, or null to mean "ask the server what is
   * on this reader's shelf". Reset passes the whole catalogue; My Saved
   * passes null. Everything after that — the lap, the catch, the handover to
   * the ordinary physics — is the same for both, which is what the owner
   * asked for when they said reset should do the same animation.
   */
  const startSpin = useCallback(
    (next: string[] | null) => {
      if (lockRef.current) return; // already running, and it cannot be skipped
      lockRef.current = true;
      setLocked(true);
      seekRef.current = null;
      draggingRef.current = false;
      capturedRef.current = false;
      releaseRef.current?.();
      spinRef.current = { phase: 'throw', travelled: 0, ids: null };
      velRef.current = CIG_SPIN_SPEED;
      run();

      const arrive = (ids: string[]) =>
        preload(ids).then(() => {
          if (spinRef.current) spinRef.current.ids = ids;
        });

      if (next) {
        arrive(next);
        return;
      }
      savedPacksAction()
        .then(({ ids }) => arrive(ids))
        .catch(() => {
          // A signed-out reader is redirected to the splash by the action, and
          // that rejects here as the navigation takes over. Anything else that
          // fails still has to let the spin end rather than turn forever, so
          // either way the row comes back to the catalogue.
          if (spinRef.current) spinRef.current.ids = [];
        });
    },
    [preload, run],
  );

  /** The whole catalogue, which is what reset spins back to. */
  const allIds = useMemo(() => CIG_PACKS.map((p) => p.id), []);

  /**
   * My Saved lives in the page's artwork, not in this component.
   *
   * `ArtworkPage` draws it as a plain button with no destination, and it is
   * rendered by a SERVER component, so a handler cannot be handed down to it.
   * Rather than restructure that boundary for one button, the row listens for
   * the press itself: the mark carries `data-part="saved"`, which is the same
   * hook the stylesheet uses for it. Capture phase, so the press is claimed
   * before anything else can act on it.
   */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.closest('[data-part="saved"]')) return;
      e.preventDefault();
      startSpin(null);
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [startSpin]);

  /** Width, and the first paint. */
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    let first = true;
    const measure = () => {
      // the zoom first: it changes the row's own width, and a change here
      // re-lays the row out and brings this observer straight back
      const screenW = document.documentElement.clientWidth;
      const z = cigZoom(screenW, window.innerHeight, LANDING_ROW_CLEAR);
      if (z !== zoomRef.current) {
        zoomRef.current = z;
        setZoom(z);
      }
      // THE ROW'S WIDTH IN ITS OWN PX IS WORKED OUT, NOT READ OFF THE ROW.
      // It used to be `el.clientWidth`, which is right only once the zoom
      // set two lines up has been APPLIED — and it has not been: that is
      // state, and the row is still laid out at the old zoom when this line
      // runs. So the width was the old zoom's (on a first load, the whole
      // screen's, 1100 where the row is really 582 wide), the middle the
      // settle aims at was out by the same factor, and every scroll ended
      // with the frame on a pack well right of the screen's middle (x=1040
      // of 1100, measured). It only ever came right because applying the
      // zoom resizes the row and brings this observer back for a second go —
      // and an embedded webview that is not painting delivers no
      // ResizeObserver callbacks at all (0 in two seconds, measured), so
      // there it never came right. The row stretches across the box it is
      // placed in, which is not zoomed, so that box's width over the zoom we
      // have just decided is the row's width whatever has or has not been
      // applied yet. It also stops being rounded to a whole px, which put
      // the middle a quarter of a pixel out.
      const box = el.offsetParent instanceof HTMLElement ? el.offsetParent : el.parentElement;
      const w = (box ? box.clientWidth : 0) / z;
      // Hidden, or not laid out yet: there is no middle to aim at. `first`
      // stays set, so the arrival below happens when there is one.
      if (!w) return;
      widthRef.current = w;
      if (first) {
        // Arrive with the first pack framed dead centre rather than with
        // whichever one an offset of zero happens to leave nearest, so the
        // page looks the same on every load and at every width — which is
        // what the design's own still shows.
        offsetRef.current = packsRef.current[0].w / 2 - widthRef.current / 2;
        first = false;
      } else if (!timerRef.current && !draggingRef.current) {
        // A resize moves the middle; bring the FRAMED pack back to it. It
        // used to bring back whichever pack was NEAREST the new middle,
        // which after a real change of width is a different pack from the
        // one in the frame — and then the frame was owed a hand-over that
        // nothing was running to deliver, so it sat on its old pack, off to
        // one side, until the next scroll.
        offsetRef.current += offFramed();
      }
      paint();
      // THE RULE THIS COMPONENT KEEPS: at rest, a pack is dead centre and the
      // frame is on it. Only the tick can finish either of those — it is what
      // settles, and what lets a held frame change hands — so anything a
      // measure leaves unfinished starts it, rather than being left until
      // somebody next touches the row.
      if (!timerRef.current && (frameRef.current.pendingSince !== 0 || Math.abs(offCentre()) > 0.5)) run();
      // at rest already, the menu is placed now; otherwise the tick places it
      // when it stops
      if (!timerRef.current) layoutMenu();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The zoom is capped by the window's HEIGHT as well as set by its width,
    // and a change of height alone does not resize the row, so the observer
    // above never hears of it.
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [layoutMenu, offCentre, offFramed, paint, run]);

  // Zeroed as well as cleared: `run()` treats a non-zero timer as "already
  // running" and returns, so a stale id surviving a remount (Fast Refresh in
  // dev) would leave the row unable to move again.
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    },
    [],
  );

  /** Painted the instant it opens, and until the buttons have finished leaving. */
  useEffect(() => {
    if (tagsOpen) {
      setMenuPainted(true);
      return;
    }
    const done = window.setTimeout(() => setMenuPainted(false), CIG_MENU_SHUT_MS);
    return () => window.clearTimeout(done);
  }, [tagsOpen]);

  /**
   * WHETHER THE POINTER IS ON THE MENU'S SCROLLBAR, so that the whole bar
   * reddens together — the thumb and both arrows — rather than only the part
   * under the pointer. The owner's ask.
   *
   * CSS cannot say this on its own. `::-webkit-scrollbar-thumb:hover` reaches
   * the thumb and nothing else: the scrollbar's parts are siblings with no
   * selector between them, so hovering one cannot colour another. What the
   * page CAN see is where the pointer is, because Chrome still delivers
   * pointermove for the gutter — with the scroller itself as the target and
   * an offsetX past its `clientWidth`, which excludes the bar. That is the
   * whole test.
   *
   * THE ATTRIBUTE IS SET ON THE NODE, NOT IN STATE. There are 81 buttons
   * under this element and a state change would reconcile every one of them
   * on every pointer move across the menu. The stylesheet is the only reader,
   * so the DOM is the right place to put it.
   *
   * While the thumb is being dragged the page gets no moves at all — the
   * scrollbar has the pointer — so the attribute simply stays as it was when
   * it was grabbed, which is on. `:active` on the thumb backs that up.
   */
  useEffect(() => {
    const el = tagsRef.current;
    if (!el) return;
    if (!tagsOpen) {
      el.removeAttribute('data-bar');
      return;
    }
    const move = (e: PointerEvent) => {
      const on = e.target === el && e.offsetX >= el.clientWidth;
      if (on !== el.hasAttribute('data-bar')) el.toggleAttribute('data-bar', on);
    };
    const leave = () => el.removeAttribute('data-bar');
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [tagsOpen]);

  /** Wheel. Non-passive, because a vertical wheel is turned sideways here. */
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (lockRef.current) return; // the My Saved spin is unskippable
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      // a hand on the row puts the menu away — see `nudge`
      setTagsOpen(false);
      // screen px in, row px out: the row is zoomed (see cigZoom)
      const by = (d / zoomRef.current) * WHEEL;
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
    if (lockRef.current) return; // the My Saved spin is unskippable
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
    // THE RELEASE IS HEARD FROM THE WINDOW TOO. The row only captures the
    // pointer once a press has become a drag (below), so a press that slides
    // off the band before that — the usual way to back out of a click — is
    // released over something else, the row's own onPointerUp never runs,
    // and the drag never ended: the row sat off-centre with the settle shut
    // out, and then followed the bare mouse the next time it crossed. After
    // the row's own handler, so this is a no-op whenever that one ran.
    releaseRef.current?.();
    const id = e.pointerId;
    const onRelease = (ev: PointerEvent) => {
      if (ev.pointerId === id) finishDrag(id);
    };
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
    releaseRef.current = () => {
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      releaseRef.current = null;
    };
    run();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    // a mouse with no button down is not dragging, whatever was missed
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      finishDrag(e.pointerId);
      return;
    }
    const now = performance.now();
    // the pointer moves in screen px and the row is zoomed, so a drag is
    // divided by the zoom to keep the packs under the hand one for one
    const dx = (e.clientX - dragRef.current.x) / zoomRef.current;
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
    const v = span > 0 ? -((e.clientX - first.x) / zoomRef.current) / span : 0;
    velRef.current = Math.max(-CIG_FLING_MAX, Math.min(CIG_FLING_MAX, v));
    // Capture only once this is really a drag. Capturing on pointerdown
    // retargets the compatibility mouse events to the row, so the click
    // landed on the row instead of the pack's link and the packs were not
    // pressable. A press that never moves never captures.
    if (!capturedRef.current && dragRef.current.moved > SLOP) {
      capturedRef.current = true;
      // guarded: throws InvalidPointerId if the pointer has already gone
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* no pointer */ }
      // the press has become a scroll, so the menu goes away — see `nudge`
      setTagsOpen(false);
    }
  };
  /** End a drag from wherever the release was heard — the row, or the window. */
  function finishDrag(pointerId: number) {
    releaseRef.current?.();
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (capturedRef.current) {
      capturedRef.current = false;
      try { rowRef.current?.releasePointerCapture?.(pointerId); } catch { /* was never captured */ }
    }
    run();
  }
  const endDrag = (e: React.PointerEvent) => finishDrag(e.pointerId);

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
    const list = packsRef.current;
    const n = list.length;
    const from = dir === 1 ? selected : (selected - 1 + n) % n;
    return (list[from].w + CIG_GAP) * dir;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (lockRef.current) return; // the My Saved spin is unskippable
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudge(stepBy(1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudge(stepBy(-1));
    }
  };

  const pick = selected >= 0 ? (packs[selected] ?? null) : null;

  return (
    <>
    <div
      ref={rowRef}
      className="cig-row"
      style={
        {
          height: `${CIG_BAND_H}px`,
          // drawn bigger, laid out the same — see cigZoom
          zoom: String(zoom),
          '--cig-rule': `${CIG_RULE.thickness}px`,
          '--cig-red': CIG_OUTLINE.colour,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragStart={(e) => e.preventDefault()}
      // a drag on a phone begins as a long-press, which raises a contextmenu
      // on Android whatever the CSS says; the row's gestures are its own
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="Cigarettes"
      aria-busy={locked || undefined}
      data-spinning={locked || undefined}
    >
      <div className="cig-track">
        {shown.map((s) => {
          const p = packs[s.i];
          // One render can arrive between a swap and the paint that follows
          // it, and the old indices do not all exist in the new list.
          if (!p) return null;
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
              if (lockRef.current) {
                e.preventDefault();
                return;
              }
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
            if (lockRef.current) {
              e.preventDefault();
              return;
            }
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

      {/*
        THE ROW'S CONTROLS: the plus, and everything it opens.

        Siblings of the row rather than children: the row is overflow:hidden
        so its packs do not spill past the edges, and a button inside it
        would be clipped the moment it sat below the band. The wrapper lets
        the pointer through to the row and is the page the menu is placed
        on. The sizes come down from `CIG_CONTROLS` so the arithmetic here
        and the stylesheet's placement cannot drift apart.

        THE MENU IS ONE BOX UNDER THE RED FRAME (the owner's 2026-09-19 ask;
        see `layoutMenu`): placed in screen px by `left` and `top` — `left`
        is what slides when it opens — and scaled by `zoom` on the inner box,
        inside which everything is laid out in the design's own px from its
        corner. Hidden until the first measure has placed it.
      */}
      <div
        ref={controlsRef}
        className="cig-controls"
        style={
          {
            '--cig-band': `${CIG_BAND_H * zoom}px`,
            '--cig-edge': `${CIG_CONTROLS.edge}px`,
            '--cig-btn-w': `${CIG_CONTROLS.width}px`,
            '--cig-btn-h': `${CIG_CONTROLS.height}px`,
            '--cig-btn-gap': `${CIG_CONTROLS.gap}px`,
            '--cig-shut-ms': `${CIG_MENU_SHUT_MS}ms`,
            '--cig-menu-w': `${MENU_DESIGN_W}px`,
          } as React.CSSProperties
        }
      >
      <div
        className="cig-menu"
        data-open={tagsOpen ? '' : undefined}
        data-placed={menu ? '' : undefined}
        data-slides={menuSlides ? '' : undefined}
        style={
          menu
            ? ({
                left: `${tagsOpen ? menu.openLeft : menu.shutLeft}px`,
                top: `${menu.top}px`,
                '--cig-menu-zoom': menu.s,
                '--cig-menu-room': `${menu.room}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
      <div className="cig-menu-scale">
        {/* the plus, and the minus it becomes — the owner's own marks, drawn
            inline so they take the button's ink and invert with it. Shut, it
            is the only thing showing: centred under the middle pack. */}
        <button
          type="button"
          className="cig-tags-toggle"
          aria-expanded={tagsOpen}
          aria-label={tagsOpen ? 'Hide the tag filters' : 'Filter by tag'}
          onClick={() => setTagsOpen((open) => !open)}
        >
          {(() => {
            const glyph = tagsOpen ? CIG_TOGGLE_GLYPH.minus : CIG_TOGGLE_GLYPH.plus;
            return (
              <svg
                viewBox={glyph.viewBox}
                width={glyph.width}
                height={glyph.height}
                aria-hidden="true"
                focusable="false"
              >
                <g transform={glyph.transform}>
                  <path d={glyph.d} fill="currentColor" fillRule={glyph.fillRule} />
                </g>
              </svg>
            );
          })()}
        </button>

        {/*
          THE REST OF THE LINE, WHICH THE PLUS REVEALS (the owner's
          2026-09-19 ask): the seal, the tile, the outline with the number,
          and reset at the end — one gap between each, reset standing off the
          outline by the gap it used to stand off the plus. "Hidden to start
          then revealed … on user click on the + button … with the same type
          of animation as the menu": each item is a slot that fades in and
          drifts the last few px out from the plus, nearest first, on the
          compositor, exactly as the tag buttons below do; closing gathers
          them back. A shut bar is `inert` — out of the tab order, out of the
          accessibility tree and deaf to the pointer — because an invisible
          control that can still be pressed is a trap (the tag menu learned
          that one already).

          Laid out by the stylesheet from the plus's own custom properties,
          so the line follows the band at any zoom. Only the seal and reset
          are controls; the slots and the tile refuse the pointer.
        */}
        <div className="cig-bar" data-open={tagsOpen ? '' : undefined} inert={!tagsOpen}>
          {[
            ...Children.toArray(marks),
            /*
              RESET. Puts the whole catalogue back and clears the filtering —
              the My Saved shelf and the tags too — through the same spin,
              because the owner asked for the same animation rather than a
              cut. It drops every tag but LEAVES THE MENU OPEN, which is what
              they asked for: reset undoes the filtering, not the reaching
              for it.
            */
            <button
              key="reset"
              type="button"
              className="cig-reset"
              onClick={() => {
                setPicked(new Set());
                startSpin(allIds);
              }}
              disabled={locked}
            >
              reset
            </button>,
          ].map((item, i) => (
            <span
              key={isValidElement(item) && item.key != null ? item.key : i}
              className="cig-bar-slot"
              style={{ '--i': i } as React.CSSProperties}
            >
              {item}
            </span>
          ))}
        </div>

        {/*
          CONFIRM. The same spin My Saved runs, over the packs the tags
          match rather than over the reader's shelf — `startSpin` takes the
          ids either way, so the throw, the lap, the catch and the handover
          are one code path for all three buttons.
        */}
        <button
          type="button"
          className="cig-confirm"
          data-open={tagsOpen ? '' : undefined}
          aria-hidden={tagsOpen ? undefined : true}
          tabIndex={tagsOpen ? undefined : -1}
          onClick={() => startSpin(matchingPacks(allIds, picked))}
          disabled={locked || !tagsOpen}
        >
          confirm
        </button>

        <div
          ref={tagsRef}
          className="cig-tags"
          data-open={tagsOpen ? '' : undefined}
          data-shown={menuPainted ? '' : undefined}
          aria-hidden={tagsOpen ? undefined : true}
          role="group"
          aria-label="Filter the row by tag"
        >
          {CIG_TAG_MENU.map((item, i) => {
            /* A HEADING OPENS EACH GROUP — the owner's red outline, two
               buttons wide and one tall, with the group's name in it. It is
               a `.cig-tag-slot` like everything else in the grid so that it
               arrives in the same wave and takes its turn in the stagger;
               only its look and the line it takes are its own. Bold is a
               stroke on the outline, the face having one weight. */
            if (item.kind === 'heading') {
              return (
                <span
                  key={item.key}
                  className="cig-tag-slot cig-tag-head"
                  style={
                    {
                      '--i': i,
                      fontSize: `${CIG_HEADING_SIZE}px`,
                      WebkitTextStrokeWidth: `${TAG_HEADING.stroke}em`,
                    } as React.CSSProperties
                  }
                >
                  {item.heading}
                </span>
              );
            }
            const { tag, first } = item;
            const on = picked.has(item.key);
            const fit = fitLabel(tag.em);
            return (
              // the wrapper is what arrives, so the button's own half-strength
              // opacity and the arrival's never fight over the one property
              <span
                key={item.key}
                className="cig-tag-slot"
                // the first of each group starts a line under its heading, and
                // --i staggers the arrival nearest-the-plus first — see the CSS
                data-first={first ? '' : undefined}
                style={{ '--i': i } as React.CSSProperties}
              >
                <button
                  type="button"
                  className="cig-tag"
                  // long brand names take two lines and a smaller size, in the
                  // same box as every other button — see fitLabel
                  style={{ fontSize: `${fit.size}px`, whiteSpace: fit.lines === 1 ? 'nowrap' : 'normal' }}
                  data-on={on ? '' : undefined}
                  aria-pressed={on}
                  tabIndex={tagsOpen ? undefined : -1}
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(item.key)) next.add(item.key);
                      return next;
                    })
                  }
                >
                  {tag.label}
                </button>
              </span>
            );
          })}
        </div>
      </div>
      </div>
      </div>
    </>
  );
}
