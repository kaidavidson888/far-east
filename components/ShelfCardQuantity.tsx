'use client';

import { useState } from 'react';
import type { PackUnit } from '@/lib/db';
import { CigQuantity } from './CigQuantity';

/**
 * THE AMOUNT BOX ON A SHELF CARD, WHICH IS ALSO THE CONTROL.
 *
 * The owner's redraw puts two boxes over each pack — a wide one reading "12x"
 * and a narrow one with the bookmark — and no plus anywhere. Printing the
 * amount and leaving it at that would take away the only way to change it, so
 * the wide box IS the button: pressing it opens the same two wheels the
 * cigarette page's plus opens, saving to the same place.
 *
 * The wheels are a whole piece of machinery with their own geometry, gestures
 * and pointer capture (components/CigQuantity.tsx), so they are borrowed
 * rather than rebuilt — mounted only once the reader has asked for them,
 * because a shelf of forty packs would otherwise carry forty of them.
 */
export function ShelfCardQuantity({
  id,
  name,
  amount,
  unit,
}: {
  id: string;
  name: string;
  amount: number | null;
  unit: PackUnit | null;
}) {
  const [open, setOpen] = useState(false);
  const says = amount && unit ? `${amount}${unit.toLowerCase()}` : '';

  return (
    <div className="shelf-card-wide">
      <button
        type="button"
        className="shelf-card-box shelf-card-amount"
        aria-label={says ? `${name}: ${says}. Change it.` : `Set how much ${name} you have`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>{says}</span>
      </button>
      {open ? (
        <CigQuantity id={id} name={name} amount={amount} unit={unit} />
      ) : null}
    </div>
  );
}
