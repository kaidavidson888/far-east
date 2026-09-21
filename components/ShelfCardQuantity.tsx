'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PackUnit } from '@/lib/db';
import { cardAmount, cardQuantityFrame } from '@/lib/shelfGrid';
import { CigQuantity } from './CigQuantity';

/**
 * THE AMOUNT BOX ON A SHELF CARD, WHICH IS ALSO THE QUANTITY CONTROL.
 *
 * The owner's redraw puts two boxes over each pack — a wide one with a number
 * in it and a narrow one with the bookmark — and no plus anywhere. So the
 * wide box IS the control: hovering it shows the cigarette page's own wheels
 * at half strength, pressing opens them solid, and they save to the same
 * place. The owner's words are "the same + button selector menu … coming from
 * the top left corner of the outline and going down and to the right … the
 * same width as the outline around the cig image".
 *
 * THE WHEELS ARE BORROWED WHOLE AND NOT TOUCHED. `CigQuantity` is a piece of
 * machinery with its own gestures, pointer capture and a non-passive wheel
 * listener, and 235 cigarette pages depend on it. It draws its own invisible
 * trigger and owns its own open/closed state, so rather than teach it to be
 * driven from outside, its trigger is given the amount box's exact footprint
 * and laid over it. That is why the box below is a SPAN and not a button:
 * two stacked controls would mean two labels and two focus rings for one
 * thing. The hover fill is keyed off the wrapper instead (`.shelf-card-wide:
 * hover`), since the pointer is over the overlay rather than the box.
 *
 * WHAT IT SHOWS IS THE COUNT IN PACKS, no letter — `cardAmount`, which is the
 * owner's "multiply by 1 if P was selected and 10 if C was selected". The
 * unit is kept in the accessible label, where dropping it would cost a screen
 * reader the only thing that says what the number counts.
 *
 * THE OUTLINE'S WIDTH HAS TO BE MEASURED. A pack is `height: var(--pack-h);
 * width: auto`, so how wide its outline comes out depends on that pack's own
 * artwork and is not a number any stylesheet or server render knows. A
 * ResizeObserver on the pack is the honest way to it; until it has reported,
 * no menu is mounted, which costs nothing because the menu only exists once
 * the pointer has arrived.
 */
export function ShelfCardQuantity({
  id,
  name,
  amount,
  unit,
  packRef,
}: {
  id: string;
  name: string;
  amount: number | null;
  unit: PackUnit | null;
  /** the pack's own element, whose border box plus the rule is the outline */
  packRef: React.RefObject<HTMLElement | null>;
}) {
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState<{ outline: number; w: number; h: number; pack: number } | null>(null);

  useEffect(() => {
    const pack = packRef.current;
    const box = boxRef.current;
    if (!pack || !box) return undefined;

    const read = () => {
      const p = pack.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (!p.width || !b.width) return;
      // the rule is drawn OUTSIDE the image (see .shelf-card-pack::after), so
      // the outline is the picture plus one rule at each end
      const rule = parseFloat(
        getComputedStyle(pack).getPropertyValue('--pack-rule'),
      ) || 0;
      setSize((was) => {
        const next = {
          outline: p.width + rule * 2, w: b.width, h: b.height, pack: p.height,
        };
        return was
          && Math.abs(was.outline - next.outline) < 0.5
          && Math.abs(was.w - next.w) < 0.5
          && Math.abs(was.h - next.h) < 0.5
          && Math.abs(was.pack - next.pack) < 0.5
          ? was : next;
      });
    };

    read();
    const ro = new ResizeObserver(read);
    ro.observe(pack);
    ro.observe(box);
    return () => ro.disconnect();
  }, [packRef]);

  const frame = useMemo(
    // rebuilt only when a measurement really moves — `wheelFor` runs off this
    // object's identity inside the component
    () => (size ? cardQuantityFrame(size.outline, { w: size.w, h: size.h }, size.pack) : null),
    [size],
  );

  const says = cardAmount(amount, unit);
  const unitWord = unit === 'C' ? 'carton' : 'pack';
  const has = amount && unit ? `${amount} ${unitWord}${amount === 1 ? '' : 's'}` : null;

  return (
    <div className="shelf-card-wide">
      <span ref={boxRef} className="shelf-card-box shelf-card-amount">
        <span aria-hidden>{says ?? ''}</span>
        {/* THE LETTER IS GONE FROM THE FACE OF IT, NOT FROM THE PAGE. The
            number alone is the owner's ask; a screen reader handed a bare
            "30" has no way to know what is being counted, so the unit is
            said here. */}
        <span className="sr-only">
          {has ? `${name}: ${has}, ${says} in packs` : `${name}: no amount set`}
        </span>
      </span>
      {frame ? (
        <CigQuantity id={id} name={name} amount={amount} unit={unit} frame={frame} />
      ) : null}
    </div>
  );
}
