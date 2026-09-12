'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { setPackQuantityAction } from '@/app/actions';
import { PAGE_QUANTITY_FRAME, wheelFor, type PackUnit, type QuantityFrame } from '@/lib/cigPages';

/**
 * The plus on a cigarette's page, and the menu it opens: how many of this
 * you have, and whether that is cartons or packs.
 *
 * WHAT IT DOES, in the owner's words: hovering the plus shows the menu at
 * half strength, pressing it opens it for real, two white stripes down it
 * are wheels — 1 to 9 on the left, C or P on the right — and once both have
 * been chosen and the finger or the button is let go, the menu closes and the
 * answer is kept with the cigarette on the shelf.
 *
 * THE WHEELS LOOP. Each stripe runs the full height of the menu and touches
 * its red ground top and bottom, so the values above and below the chosen
 * one are in view as the other options. A wheel's position is a continuous
 * number with no ends: pull it either way as far as you like and the values
 * come round again — 9 is followed by 1, and C and P simply alternate. The
 * value in the centred window is the choice.
 *
 * ONE GESTURE CAN DO THE WHOLE THING. The press that opens the menu keeps
 * hold of the pointer, so on a phone you can press the plus, slide onto the
 * left stripe and pull it to a number, slide across to the right stripe and
 * pull it to a letter, and lift — and it is saved. A mouse can do the same,
 * or open it and work the wheels one at a time, or roll them. A wheel counts
 * as chosen once it has been touched: tapping a stripe accepts what is in
 * its window.
 *
 * THE WINDOW IS RED, AND THE VALUE IN IT IS WHITE. A stripe is white and
 * its type is black, so the value in the window would vanish if it went
 * white on white — so the centred slot of each stripe is cut through to the
 * red menu behind it, and the value sitting there is white on red. Choosing
 * (touching the wheel) is what drops the OTHER values to three quarters.
 *
 * The menu grows out of the top-left corner of the outline, out and down,
 * with a black rule the same weight as the plus box's own, so it reads as
 * that outline extending into the menu. It is solid and sits above
 * everything under it, so while it is open nothing underneath can be
 * pressed. Pressing the page outside it, or Escape, closes it without
 * saving.
 *
 * `frame` says where all this lives. The cigarette page passes nothing and
 * gets its own; the shelf passes a frame built from its row, so the same
 * menu opens there in the row's own small box.
 */
const AMOUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const UNITS: readonly PackUnit[] = ['C', 'P'];

type Which = 'amount' | 'unit';
type Wheel = {
  /** where the wheel is, in items — continuous, unbounded, wraps by modulo */
  pos: number;
  /** touched at all — a wheel that has not been is not a choice */
  picked: boolean;
};

const px = (n: number) => `${n}px`;
const mod = (i: number, n: number) => ((i % n) + n) % n;

/** The value a wheel's window holds at position `pos`. */
const valueAt = (which: Which, pos: number) =>
  which === 'amount' ? AMOUNTS[mod(Math.round(pos), AMOUNTS.length)] : UNITS[mod(Math.round(pos), UNITS.length)];

export function CigQuantity({
  id,
  name,
  amount,
  unit,
  frame = PAGE_QUANTITY_FRAME,
}: {
  /** The address's pack id; the action resolves it to the page's own. */
  id: string;
  name: string;
  amount: number | null;
  unit: PackUnit | null;
  frame?: QuantityFrame;
}) {
  const W = useMemo(() => wheelFor(frame.menu, frame.stroke, frame.pitch), [frame]);

  const [mode, setMode] = useState<'closed' | 'preview' | 'open'>('closed');
  const [wheels, setWheels] = useState<Record<Which, Wheel>>(() => ({
    // open on what the shelf already says, if it says anything
    amount: { pos: amount ? amount - 1 : 0, picked: false },
    unit: { pos: unit === 'P' ? 1 : 0, picked: false },
  }));
  const wheelsRef = useRef(wheels);
  wheelsRef.current = wheels;
  const [dragging, setDragging] = useState<Which | null>(null);
  const [pending, startTransition] = useTransition();

  const menuRef = useRef<HTMLDivElement | null>(null);
  const amountRef = useRef<HTMLDivElement | null>(null);
  const unitRef = useRef<HTMLDivElement | null>(null);
  /** The gesture in progress: which stripe the pointer is over, and where it last was. */
  const gestureRef = useRef<{ which: Which | null; y: number } | null>(null);
  const settleRef = useRef(0);

  const update = useCallback((which: Which, patch: Partial<Wheel>) => {
    const next = { ...wheelsRef.current, [which]: { ...wheelsRef.current[which], ...patch } };
    wheelsRef.current = next;
    setWheels(next);
  }, []);

  /** Let a pulled stripe come to rest on the nearest value, and count it chosen. */
  const snap = useCallback(
    (which: Which) => {
      const w = wheelsRef.current[which];
      update(which, { pos: Math.round(w.pos), picked: true });
    },
    [update],
  );

  const close = useCallback(() => {
    gestureRef.current = null;
    setDragging(null);
    setMode('closed');
  }, []);

  /** Both chosen: keep it, and go. */
  const commitIfDone = useCallback(() => {
    const { amount: a, unit: u } = wheelsRef.current;
    if (!a.picked || !u.picked) return false;
    const chosenAmount = valueAt('amount', a.pos) as number;
    const chosenUnit = valueAt('unit', u.pos) as PackUnit;
    close();
    startTransition(() => setPackQuantityAction(id, chosenAmount, chosenUnit));
    return true;
  }, [close, id]);

  /** Which stripe a point on the screen is over, if any. */
  const stripeAt = useCallback((x: number, y: number): Which | null => {
    for (const [which, ref] of [['amount', amountRef], ['unit', unitRef]] as const) {
      const el = ref.current;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return which;
    }
    return null;
  }, []);

  /**
   * How many screen pixels one slot is. The shelf zooms its rows, so a slot
   * there is bigger on screen than `pitch` says; reading the stripe's real
   * height keeps a pull tracking the finger under any zoom.
   */
  const screenPitch = useCallback(
    (which: Which) => {
      const el = (which === 'amount' ? amountRef : unitRef).current;
      if (!el) return W.pitch;
      const r = el.getBoundingClientRect();
      return r.height ? (r.height / W.height) * W.pitch : W.pitch;
    },
    [W.height, W.pitch],
  );

  /** Pointer moved while held: pull whichever stripe it is over. */
  const follow = useCallback(
    (x: number, y: number) => {
      const over = stripeAt(x, y);
      const g = gestureRef.current ?? { which: null, y };
      if (over !== g.which) {
        // crossed off one stripe (settle it) or onto another (start from here)
        if (g.which) snap(g.which);
        gestureRef.current = { which: over, y };
        setDragging(over);
        return;
      }
      if (over) {
        // pulling the stripe down brings the values above it into the window
        update(over, { pos: wheelsRef.current[over].pos - (y - g.y) / screenPitch(over) });
        gestureRef.current = { which: over, y };
      }
    },
    [screenPitch, snap, stripeAt, update],
  );

  /** Pointer lifted: settle what was being pulled, and finish if both are chosen. */
  const release = useCallback(() => {
    const g = gestureRef.current;
    if (g?.which) snap(g.which);
    gestureRef.current = null;
    setDragging(null);
    commitIfDone();
  }, [commitIfDone, snap]);

  // press outside, or Escape: close without saving
  useEffect(() => {
    if (mode !== 'open') return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [close, mode]);

  useEffect(() => () => window.clearTimeout(settleRef.current), []);

  /** Rolling a stripe with a mouse wheel: pull it, and settle once the rolling stops. */
  const roll = (which: Which) => (e: React.WheelEvent) => {
    e.preventDefault();
    update(which, { pos: wheelsRef.current[which].pos + e.deltaY / screenPitch(which) });
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      snap(which);
      commitIfDone();
    }, 160);
  };

  /** Arrow keys on a focused stripe, for a keyboard. */
  const key = (which: Which) => (e: React.KeyboardEvent) => {
    const w = wheelsRef.current[which];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      update(which, { pos: Math.round(w.pos) + (e.key === 'ArrowDown' ? 1 : -1), picked: true });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      update(which, { picked: true });
      commitIfDone();
    }
  };

  // the stripe itself, once the menu is open, can be pressed and pulled directly
  const stripeDown = (which: Which) => (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current = { which, y: e.clientY };
    setDragging(which);
    update(which, { picked: true }); // a tap accepts what is in the window
  };

  /**
   * The values in view for a stripe at position `pos`: every integer index
   * whose slot lands inside the stripe, each mapped onto the looping list.
   * The stripe's centre is the window; index i sits (i - pos) slots from it.
   */
  const slots = (which: Which, pos: number) => {
    const values: readonly (number | string)[] = which === 'amount' ? AMOUNTS : UNITS;
    const centre = W.height / 2;
    const reach = Math.ceil(centre / W.pitch) + 1;
    const c = Math.round(pos);
    const out: { i: number; value: number | string; top: number; centred: boolean }[] = [];
    for (let k = -reach; k <= reach; k++) {
      const i = c + k;
      out.push({
        i,
        value: values[mod(i, values.length)],
        top: centre + (i - pos) * W.pitch - W.pitch / 2,
        centred: i === c,
      });
    }
    return out;
  };

  const stripe = (which: Which, label: string, i: 0 | 1, ref: React.RefObject<HTMLDivElement | null>) => {
    const w = wheels[which];
    return (
      <div
        ref={ref}
        className="cigpage-wheel"
        role="listbox"
        aria-label={label}
        aria-activedescendant={w.picked ? `qty-${which}-${Math.round(w.pos)}` : undefined}
        tabIndex={0}
        data-picked={w.picked ? '' : undefined}
        data-dragging={dragging === which ? '' : undefined}
        style={{ left: px(W.lefts[i]), top: px(W.top), width: px(W.width), height: px(W.height) }}
        onPointerDown={stripeDown(which)}
        onPointerMove={(e) => {
          if (gestureRef.current) follow(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onWheel={roll(which)}
        onKeyDown={key(which)}
      >
        <span className="cigpage-wheel-window" style={{ top: px(W.window), height: px(W.pitch) }} aria-hidden="true" />
        {slots(which, w.pos).map((s) => (
          <span
            key={s.i}
            id={`qty-${which}-${s.i}`}
            role="option"
            aria-selected={w.picked && s.centred}
            className="cigpage-wheel-item"
            data-centred={s.centred ? '' : undefined}
            data-selected={w.picked && s.centred ? '' : undefined}
            style={{ top: px(s.top), height: px(W.pitch), fontSize: px(frame.fontSize) }}
          >
            {s.value}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className="cigpage-plus-hit"
        style={{ left: px(frame.plus.left), top: px(frame.plus.top), width: px(frame.plus.width), height: px(frame.plus.height) }}
        aria-label={`How many ${name} you have`}
        aria-haspopup="dialog"
        aria-expanded={mode === 'open'}
        disabled={pending}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse' && mode === 'closed') setMode('preview');
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && mode === 'preview') setMode('closed');
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.preventDefault();
          // keep the pointer: the same press can go on to work the wheels
          e.currentTarget.setPointerCapture(e.pointerId);
          gestureRef.current = { which: null, y: e.clientY };
          setMode('open');
        }}
        onPointerMove={(e) => {
          if (gestureRef.current && mode === 'open') follow(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          if (mode === 'open') release();
        }}
        onPointerCancel={() => {
          if (mode === 'open') release();
        }}
      />

      {mode !== 'closed' ? (
        <div
          ref={menuRef}
          className="cigpage-quantity"
          data-mode={mode}
          role="dialog"
          aria-label={`How many ${name} you have`}
          aria-hidden={mode === 'preview' || undefined}
          style={{
            left: px(frame.menu.left),
            top: px(frame.menu.top),
            width: px(frame.menu.width),
            height: px(frame.menu.height),
            borderWidth: px(frame.stroke),
          }}
        >
          {stripe('amount', 'How many', 0, amountRef)}
          {stripe('unit', 'Cartons or packs', 1, unitRef)}
        </div>
      ) : null}
    </>
  );
}
