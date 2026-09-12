'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { setPackQuantityAction } from '@/app/actions';
import { PLUS, QUANTITY_MENU, WHEEL, type PackUnit } from '@/lib/cigPages';

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
 * ONE GESTURE CAN DO THE WHOLE THING. The press that opens the menu keeps
 * hold of the pointer, so on a phone you can press the plus, slide onto the
 * left stripe and pull it to a number, slide across to the right stripe and
 * pull it to a letter, and lift — and it is saved. A mouse can do the same,
 * or open it and work the wheels one at a time, or roll them. A wheel counts
 * as chosen once it has been touched: tapping a stripe accepts what is in
 * its window, so "1" and "C" do not have to be pulled away from and back.
 *
 * THE WINDOW IS RED. A stripe is white and its type is black, so a chosen
 * value turning white would vanish — unless it is sitting on red. The
 * middle slot of each stripe is cut through to the menu behind it, which is
 * where the chosen value sits: white on red, exactly as asked, and the rest
 * of the stripe's values drop to three quarters.
 *
 * The menu is solid and sits above everything under it, so while it is open
 * nothing underneath can be pressed. Pressing the page outside it, or
 * Escape, closes it without saving.
 */
const AMOUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const UNITS: readonly PackUnit[] = ['C', 'P'];

type Which = 'amount' | 'unit';
type Wheel = {
  /** the item in the window once settled */
  index: number;
  /** how far the stripe has been pulled from there, in px, mid-gesture */
  drag: number;
  /** touched at all — a wheel that has not been is not a choice */
  picked: boolean;
};
const fresh = (): Wheel => ({ index: 0, drag: 0, picked: false });

const px = (n: number) => `${n}px`;

export function CigQuantity({
  id,
  name,
  amount,
  unit,
}: {
  /** The address's pack id; the action resolves it to the page's own. */
  id: string;
  name: string;
  amount: number | null;
  unit: PackUnit | null;
}) {
  const [mode, setMode] = useState<'closed' | 'preview' | 'open'>('closed');
  const [wheels, setWheels] = useState<Record<Which, Wheel>>(() => ({
    // open on what the shelf already says, if it says anything
    amount: { ...fresh(), index: amount ? amount - 1 : 0 },
    unit: { ...fresh(), index: unit === 'P' ? 1 : 0 },
  }));
  const wheelsRef = useRef(wheels);
  wheelsRef.current = wheels;
  const [dragging, setDragging] = useState<Which | null>(null);
  const [pending, startTransition] = useTransition();

  const menuRef = useRef<HTMLDivElement | null>(null);
  const stripeRefs = { amount: useRef<HTMLDivElement | null>(null), unit: useRef<HTMLDivElement | null>(null) };
  /** The gesture in progress: which stripe the pointer is over, and where it last was. */
  const gestureRef = useRef<{ which: Which | null; y: number } | null>(null);
  const settleRef = useRef(0);

  const update = useCallback((which: Which, patch: Partial<Wheel>) => {
    const next = { ...wheelsRef.current, [which]: { ...wheelsRef.current[which], ...patch } };
    wheelsRef.current = next;
    setWheels(next);
  }, []);

  /** Let a pulled stripe come to rest on the nearest item, and count it chosen. */
  const snap = useCallback(
    (which: Which) => {
      const w = wheelsRef.current[which];
      const n = which === 'amount' ? AMOUNTS.length : UNITS.length;
      const index = Math.max(0, Math.min(n - 1, Math.round(w.index - w.drag / WHEEL.pitch)));
      update(which, { index, drag: 0, picked: true });
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
    const chosenAmount = AMOUNTS[a.index];
    const chosenUnit = UNITS[u.index];
    close();
    startTransition(() => setPackQuantityAction(id, chosenAmount, chosenUnit));
    return true;
  }, [close, id]);

  /** Which stripe a point on the screen is over, if any. */
  const stripeAt = useCallback((x: number, y: number): Which | null => {
    for (const which of ['amount', 'unit'] as const) {
      const el = stripeRefs[which].current;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return which;
    }
    return null;
    // the refs are stable objects; only their .current changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        update(over, { drag: wheelsRef.current[over].drag + (y - g.y) });
        gestureRef.current = { which: over, y };
      }
    },
    [snap, stripeAt, update],
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
    update(which, { drag: wheelsRef.current[which].drag - e.deltaY });
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      snap(which);
      commitIfDone();
    }, 160);
  };

  /** Arrow keys on a focused stripe, for a keyboard. */
  const key = (which: Which) => (e: React.KeyboardEvent) => {
    const n = which === 'amount' ? AMOUNTS.length : UNITS.length;
    const w = wheelsRef.current[which];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const index = Math.max(0, Math.min(n - 1, w.index + (e.key === 'ArrowDown' ? 1 : -1)));
      update(which, { index, drag: 0, picked: true });
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

  const stripe = (which: Which, values: readonly (number | string)[], label: string, i: 0 | 1) => {
    const w = wheels[which];
    const trackTop = WHEEL.window - w.index * WHEEL.pitch + w.drag;
    return (
      <div
        ref={stripeRefs[which]}
        className="cigpage-wheel"
        role="listbox"
        aria-label={label}
        aria-activedescendant={w.picked ? `qty-${which}-${w.index}` : undefined}
        tabIndex={0}
        data-picked={w.picked ? '' : undefined}
        data-dragging={dragging === which ? '' : undefined}
        style={{ left: px(WHEEL.lefts[i]), top: px(WHEEL.top), width: px(WHEEL.width), height: px(WHEEL.height) }}
        onPointerDown={stripeDown(which)}
        onPointerMove={(e) => {
          if (gestureRef.current) follow(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onWheel={roll(which)}
        onKeyDown={key(which)}
      >
        <span className="cigpage-wheel-window" style={{ top: px(WHEEL.window), height: px(WHEEL.pitch) }} aria-hidden="true" />
        <div className="cigpage-wheel-track" style={{ transform: `translateY(${trackTop}px)` }}>
          {values.map((v, k) => (
            <span
              key={String(v)}
              id={`qty-${which}-${k}`}
              role="option"
              aria-selected={w.picked && k === w.index}
              className="cigpage-wheel-item"
              data-selected={w.picked && k === w.index ? '' : undefined}
              style={{ height: px(WHEEL.pitch) }}
            >
              {v}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className="cigpage-plus-hit"
        style={{ left: px(PLUS.box.left), top: px(PLUS.box.top), width: px(PLUS.box.width), height: px(PLUS.box.height) }}
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
          style={{ left: px(QUANTITY_MENU.left), top: px(QUANTITY_MENU.top), width: px(QUANTITY_MENU.width), height: px(QUANTITY_MENU.height) }}
        >
          {stripe('amount', AMOUNTS, 'How many', 0)}
          {stripe('unit', UNITS, 'Cartons or packs', 1)}
        </div>
      ) : null}
    </>
  );
}
