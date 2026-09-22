'use client';

import { useRef, useState, useTransition } from 'react';
import { setPackRatingAction } from '@/app/actions';
import { RATE } from '@/lib/shelfGrid';

/**
 * FIVE SIGILS, BESIDE THE CLOUD STAR (the owner's 2026-09-22).
 *
 * "when the user clicks on the cloud star button have the button keep its
 * outline and move to have its left edge aligned with the cig image outlines
 * left edge after moving its opacity should be 25% and I want 5 sigils to
 * appear all scaled to the same height as the total price number space them
 * evenly including an even space before the first one and after the last one.
 * Make them fit between the newly moved cloud star button and the right edge
 * of the cig image outline. have the sigils be red with black fill normally at
 * 75% opacity then go to 100% opacity and the default black fill with white on
 * hover and click save the amount of sigils filled both to the users profile
 * and to the server as their accounts rating for the cigarette. on subsequent
 * visits or on reopening the menu the same amount of filled sigils should be
 * there for a returning user."
 *
 * THE BLACK FILL IS THE PAGE. The ☁ is drawn as ink with its spirals cut out
 * of it, so what shows inside and around the mark is whatever it stands on —
 * and this page has been black since the 21st. "Red with black fill" and
 * "black fill with white" therefore name the two states of ONE colour: the
 * mark is red at three quarters at rest and white at full when it is lit,
 * which is also this page's own hover language ("black fill with white as the
 * color of the elements inside the box"). Putting a black rectangle behind
 * each mark would draw nothing that is not already there and would change the
 * thing being spaced — the owner asked for five sigils, not five boxes.
 *
 * THE OPACITY IS IN THE COLOUR, never on the element: the page's rule for
 * every control on it, so that a mark's strength is the mark's and nothing
 * else fades with it.
 *
 * HOVERING LIGHTS THE RUN, PRESSING KEEPS IT. Sigil k lit means "k sigils",
 * so hovering the third lights three; taking the pointer away leaves whatever
 * was actually pressed. Focus counts as a reach in the same way the rest of
 * this page's controls treat it, so a keyboard sees the same preview.
 *
 * IT FILLS BEFORE THE SERVER ANSWERS, and puts itself back if the answer is
 * that nothing was saved. Waiting on a round trip to colour a mark under the
 * pointer would feel broken; a mark that stays filled when the rating did not
 * save would be a lie. `setPackRatingAction` answers with what is actually
 * stored, which is how this tells the two apart — see the action, and Known
 * gaps in CLAUDE.md while migration 0008 is unapplied.
 */
export function ShelfRating({
  packId,
  name,
  rating,
  open,
  button,
  starTop,
}: {
  packId: string;
  name: string;
  /** what the database holds for this reader and this pack, 1-5 or null */
  rating: number | null;
  /** whether the cloud star is latched open — shut, the row is not there */
  open: boolean;
  button: number;
  /** the star's own line: the row stands on it, centred on the marks */
  starTop: number;
}) {
  /** what is drawn as pressed — optimistic, so it answers the press at once */
  const [filled, setFilled] = useState(rating ?? 0);
  /** what the server last confirmed, which is what a refused save falls back to */
  const confirmed = useRef(rating ?? 0);
  /** the run being previewed under the pointer or the keyboard, 0 for none */
  const [over, setOver] = useState(0);
  const [, start] = useTransition();

  const lit = over || filled;

  const pick = (k: number) => {
    setFilled(k);
    start(async () => {
      const answer = await setPackRatingAction(packId, k);
      if (answer.rating === null) setFilled(confirmed.current);
      else confirmed.current = answer.rating;
    });
  };

  return (
    <div
      className="shelf-wheel-rate"
      data-open={open ? '' : undefined}
      /* shut, it is not there at all: out of the tab order, out of the
         accessibility tree and taking no pointer. An invisible control that
         can still be pressed is a trap — the row's own shut menus are inert
         for the same reason. */
      inert={!open}
      aria-label={`Rate ${name}`}
      style={{
        '--btn': `${button}px`,
        '--star-top': `${starTop.toFixed(2)}px`,
      } as React.CSSProperties}
      onPointerLeave={() => setOver(0)}
      /* A PRESS ON A SIGIL IS NOT A PRESS ON THE WHEEL. The stage turns any
         press it sees into a drag past six pixels and stops resting, which
         unmounts these controls — so a press with a few pixels of wobble in
         it would take the row of sigils away instead of filling them. A
         WHEEL over them is left alone on purpose: they do not scroll, and a
         hand on the wheel outranks a menu, which is the landing row's rule. */
      onPointerDown={(e) => e.stopPropagation()}
    >
      {Array.from({ length: RATE.count }, (_, i) => i + 1).map((k) => (
        <button
          key={k}
          type="button"
          className="shelf-wheel-sigil"
          data-lit={k <= lit ? '' : undefined}
          aria-pressed={k === filled}
          aria-label={`Rate ${name} ${k} of ${RATE.count}`}
          onPointerEnter={() => setOver(k)}
          onFocus={() => setOver(k)}
          onBlur={() => setOver(0)}
          onClick={() => pick(k)}
        >
          <i aria-hidden />
        </button>
      ))}
    </div>
  );
}
