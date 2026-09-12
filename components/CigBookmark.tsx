'use client';

import { useFormStatus } from 'react-dom';
import { savePackAction } from '@/app/actions';
import { BOOKMARK } from '@/lib/cigPages';

/**
 * The bookmark on a cigarette's page: press it and the cigarette goes on
 * your shelf.
 *
 * THE MARK IS DRAWN HERE, NOT IN THE ARTWORK. The vector had it as a filled
 * path, and a page loaded through <img> is out of CSS's reach — nothing on
 * the page can colour it. So the build strips it (stripBookmark in
 * scripts/build-cigpages.mjs) and this draws the same path back at the same
 * coordinates, where a stylesheet can get at it. The box round it stays in
 * the artwork: that is the control's outline and it does not change.
 *
 * THE BOX IS THE BUTTON, the mark is what reddens. That is what the design
 * draws — the box beside it holds a plus and is plainly a control too — and
 * it gives a 72x66 target rather than a 34px one.
 *
 * ADD-ONLY. The owner asked for red to be permanent, so once it is saved
 * this stops being a button at all: a <span> carrying the state, rather than
 * a dead control that still invites a press. Taking something off the shelf
 * is the shelf's job.
 *
 * The red is the artwork's own #FF0000 — not --negative, which is warm grey
 * and is never an error colour, per the spec.
 */
const { box, mark, d } = BOOKMARK;

/** Where the button sits on the body. Shared, so the two states cannot drift. */
const PLACE: React.CSSProperties = {
  left: `${box.left}px`,
  top: `${box.top}px`,
  width: `${box.width}px`,
  height: `${box.height}px`,
};

/** The mark, placed against the button's own edge from the same measurement. */
function Mark() {
  return (
    <svg
      className="cigpage-bookmark-mark"
      width={mark.width}
      height={mark.height}
      viewBox={`0 0 ${mark.width} ${mark.height}`}
      style={{ left: `${mark.left - box.left}px`, top: `${mark.top - box.top}px` }}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * Reddens the moment it is pressed rather than when the round trip lands.
 * The server sends back the saved page and this unmounts; until it does,
 * `pending` is what makes the press feel immediate.
 */
function Pressable({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="cigpage-bookmark-hit"
      data-pressed={pending ? '' : undefined}
      aria-label={`Save ${name} to your shelf`}
      aria-disabled={pending || undefined}
    >
      <Mark />
    </button>
  );
}

export function CigBookmark({
  id,
  name,
  saved,
}: {
  /** The address's pack id; the action resolves it to the page's own. */
  id: string;
  name: string;
  saved: boolean;
}) {
  if (saved) {
    return (
      <span
        className="cigpage-bookmark"
        data-saved=""
        role="img"
        aria-label={`${name} is on your shelf`}
        style={PLACE}
      >
        <Mark />
      </span>
    );
  }

  return (
    <form action={savePackAction} className="cigpage-bookmark" style={PLACE}>
      <input type="hidden" name="pack" value={id} />
      <Pressable name={name} />
    </form>
  );
}
