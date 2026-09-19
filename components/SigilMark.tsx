import { LANDING_MARKS } from '@/lib/landing';

/**
 * The animated 發, the outline beside it, and the number inside the outline — one
 * box, drawn on the plus's line under the cigarette row.
 *
 * THE ANIMATED 發 took the cloud's place on 2026-09-19 — the character from
 * the owner's tile GIF, without the tile's rings, at the bar's 30px height
 * (`npm run build:tile`) — and it PLAYS, LOOPED, WHILE THE MENU IS OPEN, the
 * owner's words. The whole tile was tried first at this height and its
 * moving swirls came out thinner than a pixel; the character alone is nearly
 * twice the size it had inside the tile, and the motion reads. Its 72 frames are one tall strip per
 * pixel density (`srcSet` picks; each is sharpened at its own size so the
 * filigree's motion survives being 30px tall), shown through a window one
 * frame high, and `.cig-bar[data-open] .sigil-tile img` in the stylesheet
 * steps the strip up a frame every 50ms. That animation only exists while
 * the bar is open, so opening starts the tile from its first frame and
 * closing stops it — which an animated image, running on the browser's own
 * clock from the moment it loads, could not do. A reader who has asked for
 * reduced motion sees the first frame.
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
      <span
        className="sigil-tile"
        style={
          {
            left: px(tile.left),
            top: px(tile.top),
            width: px(tile.w),
            height: px(tile.h),
            '--tile-frames': tile.frames,
            '--tile-loop': `${tile.frames * tile.frameMs}ms`,
          } as React.CSSProperties
        }
      >
        <img
          src={tile.strip1x}
          srcSet={`${tile.strip1x} 1x, ${tile.strip2x} 2x`}
          alt=""
          width={tile.w}
          height={tile.h * tile.frames}
          draggable={false}
        />
      </span>
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
