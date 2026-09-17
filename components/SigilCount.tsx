import { LANDING_COUNT } from '@/lib/landing';

/**
 * The number inside the outline beside the sigil.
 *
 * It counts the share links this reader has made that were worth $100 or more
 * — `profiles.big_shares`, added to in `createShare` in the same transaction
 * that freezes the link. The owner's ask (2026-09-17).
 *
 * IT IS IN THE OVERLAY, NOT THE ARTWORK. Every part of these pages is an
 * `<img>` of a cut SVG and none of them carries a text node, so live type
 * belongs over the top — the same place the cigarette row's own controls set
 * text in the owner's face. The square underneath is still the artwork's; this
 * only fills it.
 *
 * A SIGNED-OUT READER SEES 0. There is no row to read and nothing to say, and
 * an empty outline would read as a mark that failed to load rather than as a
 * count of nothing.
 *
 * It takes no pointer: the outline is not a control, and letting it take one
 * would put a dead hit area over the corner of the page.
 */
export function SigilCount({ value }: { value: number }) {
  return (
    <span
      className="sigil-count"
      style={{
        right: `${LANDING_COUNT.right}px`,
        top: `${LANDING_COUNT.top}px`,
        width: `${LANDING_COUNT.size}px`,
        height: `${LANDING_COUNT.size}px`,
        fontSize: `${LANDING_COUNT.type}px`,
      }}
      aria-label={`${value} share ${value === 1 ? 'link' : 'links'} worth $100 or more`}
    >
      {value}
    </span>
  );
}
