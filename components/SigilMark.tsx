import { LANDING_MARKS } from '@/lib/landing';

/**
 * The 發 tile, the outline beside it, and the number inside the outline — one
 * box, drawn on the plus's line under the cigarette row.
 *
 * THE TILE took the cloud's place on 2026-09-19 (the owner's GIF, its corners
 * redrawn square by `npm run build:tile`). It is an animated WebP, looping at
 * the GIF's own timing — an `<img>` plays it, since nothing here has to scrub
 * it the way the menu and the seal are scrubbed. There is ONE FILE PER PIXEL
 * DENSITY, picked by `srcSet`: each is sharpened at its own size so the
 * filigree's motion survives being 30px tall, and a 1x screen handed the 2x
 * file would shrink it with the browser's own filter and blur the motion
 * away again — which is what the owner saw as "not playing". A reader who
 * has asked for reduced motion gets the first frame instead, through
 * `<picture>`, which the browser settles before it fetches anything.
 *
 * The outline is the artwork's own cut vector at the plus's size; the number
 * is live type over it, in the owner's face, because a cut part is an `<img>`
 * and cannot carry a text node.
 *
 * THE NUMBER counts the share links this reader has made that were worth
 * $100 or more — `profiles.big_shares`, added to in `createShare` in the same
 * transaction that freezes the link. The owner's ask (2026-09-17). A
 * signed-out reader sees 0: there is no row to read and nothing to say, and
 * an empty outline would read as a mark that failed to load rather than as a
 * count of nothing.
 *
 * None of it takes the pointer: it is not a control, and a dead hit area
 * beside the seal's live one would only get in the way of the row.
 */
export function SigilMark({ count }: { count: number }) {
  const { sigil, type } = LANDING_MARKS;
  const { tile, square } = sigil;
  const px = (n: number) => `${n}px`;
  return (
    <span className="sigil-mark" style={{ width: px(sigil.w), height: px(sigil.h) }}>
      <picture>
        <source srcSet={tile.stillSrcSet} media="(prefers-reduced-motion: reduce)" />
        <img
          className="sigil-mark-part"
          src={tile.src}
          srcSet={tile.srcSet}
          alt=""
          width={tile.w}
          height={tile.h}
          style={{ left: px(tile.left), top: px(tile.top) }}
          draggable={false}
        />
      </picture>
      <img
        className="sigil-mark-part"
        src="/landing/parts/square.svg"
        alt=""
        width={square.w}
        height={square.h}
        style={{ left: px(square.left), top: px(square.top) }}
        draggable={false}
      />
      <span
        className="sigil-count"
        style={{
          left: px(square.left),
          top: px(square.top),
          width: px(square.w),
          height: px(square.h),
          fontSize: px(type),
        }}
        aria-label={`${count} share ${count === 1 ? 'link' : 'links'} worth $100 or more`}
      >
        {count}
      </span>
    </span>
  );
}
