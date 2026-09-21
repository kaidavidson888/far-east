'use client';

import { useEffect, useRef, useState } from 'react';
import type { ShelfEntry } from '@/lib/shelfGrid';
import { ShelfCard } from './ShelfCard';

/**
 * THE GRID, AND WHY IT REMEMBERS WHAT HAS LEFT IT.
 *
 * The owner's 2026-09-21: "The bookmark button should add or remove a pack
 * from the users favorites/saved." A shelf only holds what is saved, so a
 * card is on this page BECAUSE the pack is on the shelf — press the bookmark
 * and the row goes, the card unmounts, and the button has no second
 * direction to be pressed in. Taken literally it could only ever remove.
 *
 * So a card that is taken off stays on screen for as long as the page is
 * open, with its bookmark showing it is no longer saved and pressing it
 * putting it back. The shelf itself is still exactly the rows in the
 * database — this is only about what is DRAWN, and a reload shows the shelf
 * as it really is. It also means a mis-press on a shelf is recoverable,
 * which it was not: /packs/<id> is add-only, so the only way back used to be
 * finding that cigarette again.
 *
 * `entries` is the truth and arrives from the server on every revalidate;
 * `shown` is that list plus anything that has been removed since the page
 * loaded, each kept in the place it already had rather than jumping to the
 * end.
 */
export function ShelfGrid({
  entries,
  bookmark,
  style,
}: {
  entries: ShelfEntry[];
  bookmark: { mark: { width: number; height: number }; d: string };
  style?: React.CSSProperties;
}) {
  const [shown, setShown] = useState<ShelfEntry[]>(entries);
  // what the server last told us, so the effect can tell a real change from
  // a fresh array carrying the same shelf
  const seen = useRef('');

  useEffect(() => {
    const key = entries.map((e) => `${e.pack.id}:${e.amount ?? ''}${e.unit ?? ''}`).join('|');
    if (key === seen.current) return;
    seen.current = key;
    setShown((was) => {
      const live = new Map(entries.map((e) => [e.pack.id, e]));
      const merged = was.map((e) => live.get(e.pack.id) ?? e);
      const known = new Set(was.map((e) => e.pack.id));
      for (const e of entries) if (!known.has(e.pack.id)) merged.push(e);
      return merged;
    });
  }, [entries]);

  const saved = new Set(entries.map((e) => e.pack.id));

  return (
    <ul className="shelf-grid" style={style}>
      {shown.map((entry) => (
        <ShelfCard
          key={entry.pack.id}
          entry={entry}
          bookmark={bookmark}
          saved={saved.has(entry.pack.id)}
        />
      ))}
    </ul>
  );
}
