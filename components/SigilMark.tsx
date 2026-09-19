import { LANDING_MARKS } from '@/lib/landing';

/**
 * The sigil, the outline beside it, and the number inside the outline — one
 * box, drawn on the plus's line under the cigarette row.
 *
 * The two marks are the artwork's own cut vectors, at the sizes `lib/landing`
 * works out from the design (the square at the plus's 30, the cloud in its
 * drawn relation to it); the number is live type over the square, in the
 * owner's face, because every cut part is an `<img>` and none of them can
 * carry a text node.
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
  const px = (n: number) => `${n}px`;
  return (
    <span className="sigil-mark" style={{ width: px(sigil.w), height: px(sigil.h) }}>
      <img
        className="sigil-mark-part"
        src="/landing/parts/cloud.svg"
        alt=""
        width={sigil.cloud.w}
        height={sigil.cloud.h}
        style={{ left: px(sigil.cloud.left), top: px(sigil.cloud.top) }}
        draggable={false}
      />
      <img
        className="sigil-mark-part"
        src="/landing/parts/square.svg"
        alt=""
        width={sigil.square.w}
        height={sigil.square.h}
        style={{ left: px(sigil.square.left), top: px(sigil.square.top) }}
        draggable={false}
      />
      <span
        className="sigil-count"
        style={{
          left: px(sigil.square.left),
          top: px(sigil.square.top),
          width: px(sigil.square.w),
          height: px(sigil.square.h),
          fontSize: px(type),
        }}
        aria-label={`${count} share ${count === 1 ? 'link' : 'links'} worth $100 or more`}
      >
        {count}
      </span>
    </span>
  );
}
