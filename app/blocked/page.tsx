import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Try again in 30 minutes',
  robots: { index: false, follow: false },
};

/**
 * THREE FAILURES OF ONE SECTION AND THE SITE SHUTS FOR HALF AN HOUR.
 *
 * The owner's 2026-09-20 rule: "on the third failure of the same section kick
 * the user out of all login processes and fully block them from accessing the
 * site for 30 minutes. Take them to a new page that is entirely red and just
 * says in bold webfont TRY AGAIN IN 30 MINUTES."
 *
 * So: the artwork's own #FF0000 edge to edge, one line of the owner's face in
 * white, and nothing else on the page — no header, no footer, no way on. The
 * root layout draws this in place of whatever was asked for while the block
 * stands, so it is not a page a reader can simply navigate away from.
 *
 * BOLD IS A STROKE. The face has one weight and these pages set
 * font-synthesis: none, so `font-weight: bold` would ask for the very thing
 * the browser has been told not to fake — the shelf's price and the age gate
 * make their bold the same way.
 *
 * THIRTY MINUTES IS SAID, NOT COUNTED DOWN. That is the sentence the owner
 * wrote, and a clock ticking down is an invitation to sit and watch it.
 */
export default function BlockedPage() {
  return (
    <div className="blocked-page">
      <p className="blocked-page-say">TRY AGAIN IN 30 MINUTES</p>
    </div>
  );
}
