import Link from 'next/link';
import { removePackAction } from '@/app/actions';
import { BOOKMARK } from '@/lib/cigPages';
import { HOME } from '@/lib/innerPage';
import { DIVIDER, SHELF_HEADER, SHELF_LOGO, SHELF_QUANTITY_FRAME, SHELF_ROW, shelfLayout, type ShelfEntry } from '@/lib/shelfPage';
import { CigQuantity } from './CigQuantity';
import { ShelfStage } from './ShelfStage';

/**
 * The reader's shelf, drawn from the owner's design — see lib/shelfPage.ts
 * for the template and the rules it holds.
 *
 * Nothing here is a picture of the design. The boxes are boxes, the rules
 * are rules, the clouds are the site's own cloud, the packs are the same
 * cleaned marks the landing row uses, and the type is the owner's face —
 * which is what the owner asked for, and what makes it sharp at any size.
 *
 * THE CONTROLS WORK, as they do on a cigarette's page. The plus opens the
 * same quantity wheels, in the row's own box, and saves to the same place.
 * The bookmark is the other half of the cigarette page's: there it only ever
 * adds ("red permanently"), so here it takes the pack off the shelf — which
 * the page has always said was the shelf's job.
 *
 * INSIDE A RULED BOX, CHILDREN SIT INSIDE THE RULE. An absolutely placed
 * child of a bordered box is positioned from the padding edge, not the
 * border's outer edge, so a mark measured from the box's outer corner has
 * the rule's width taken off its offset — or it lands the rule's width too
 * far in, which is what the owner saw on the plus and the bookmark.
 *
 * THE LOGO GOES HOME, AND IS NOT THE MENU HERE. The owner asked for it sized
 * to the top pack's width, and the logo menu's first frame IS the 40x87 logo,
 * baked — it cannot sit on a mark of any other size without every frame being
 * redrawn. So on this page the logo is what it is on every page but the
 * landing page: a link to /landing.
 *
 * The comment panel is drawn as the design draws it and does nothing yet:
 * the pack shelf has nowhere to keep a note, and inventing that is a bigger
 * change than a page. See Known gaps.
 */
const px = (n: number) => `${n}px`;
type B = { left: number; top: number; width: number; height: number };
const box = (b: B): React.CSSProperties => ({
  left: px(b.left),
  top: px(b.top),
  width: px(b.width),
  height: px(b.height),
});
/** A mark inside a ruled box, offset from the inside of the rule. */
const inside = (mark: B, host: B & { stroke: number }): B => ({
  left: mark.left - host.left - host.stroke,
  top: mark.top - host.top - host.stroke,
  width: mark.width,
  height: mark.height,
});
const type = (t: { left: number; top: number; size: number }): React.CSSProperties => ({
  left: px(t.left),
  top: px(t.top),
  fontSize: px(t.size),
});

export function ShelfPage({ entries }: { entries: ShelfEntry[] }) {
  const { rows, rowsTop, rowsHeight, bottom, topPackWidth } = shelfLayout(entries);
  const R = SHELF_ROW;

  return (
    <div className="shelf">
      <ShelfStage rowsTop={rowsTop} rowsHeight={rowsHeight} bottom={bottom} topPackWidth={topPackWidth}>
        {/* the logo, as wide as the top pack, about its own centre — the stage sizes it */}
        <Link
          href={HOME}
          className="shelf-logo"
          aria-label="遠東 — home"
          style={{ left: 'var(--logo-left)', top: 'var(--logo-top)', width: 'var(--logo-w)', height: 'var(--logo-h)' }}
        >
          <img src={SHELF_LOGO.src} alt="" width={SHELF_LOGO.w} height={SHELF_LOGO.h} draggable={false} />
        </Link>

        {/* the caption's box: the price's width, hung by its right edge from the aligned right margin */}
        <div
          className="shelf-header-box"
          style={{
            left: 'calc(var(--aligned-right) - var(--price-w))',
            top: px(SHELF_HEADER.box.top),
            width: 'var(--price-w)',
            height: px(SHELF_HEADER.box.height),
            borderWidth: px(SHELF_HEADER.box.stroke),
          }}
        >
          {/* the caption, centred inside the rule and scaled to a 3px clearance on its tightest side — the stage fits it */}
          <span className="shelf-type" style={{ left: 'var(--caption-left)', top: 'var(--caption-top)', fontSize: 'var(--caption-size)' }}>
            {SHELF_HEADER.caption.text}
          </span>
        </div>
        {/* the $240, bold, hung by its ink's right edge from the same line */}
        <div
          className="shelf-price"
          style={{
            left: `calc(var(--aligned-right) - ${px(SHELF_HEADER.price.inset)})`,
            top: px(SHELF_HEADER.price.top),
            fontSize: px(SHELF_HEADER.price.size),
            WebkitTextStroke: `${px(SHELF_HEADER.price.stroke)} currentColor`,
            transform: 'translateX(-100%)',
          }}
        >
          {SHELF_HEADER.price.text}
        </div>

        {/* the red rule dividing the header from the shelf, margin to margin */}
        <span
          className="shelf-divider"
          style={{ left: px(DIVIDER.left), top: px(DIVIDER.top), width: `calc(var(--aligned-right) - ${px(DIVIDER.left)})`, height: px(DIVIDER.height), background: DIVIDER.colour }}
          aria-hidden="true"
        />

        {/*
          The rows, zoomed as one block so their right edge (the clouds) lands
          on the aligned right margin. `zoom` multiplies the block's own offsets
          too, so its top is divided out to stay put, and its left is set so the
          left margin — where every pack's rule starts — is the point that does
          not move, which holds that margin at any zoom. See shelfPage.ts.
        */}
        <div
          className="shelf-rows"
          style={
            {
              top: `calc(${px(rowsTop)} / var(--row-scale))`,
              left: 'calc(var(--shelf-anchor) * (1 - var(--row-scale)) / var(--row-scale))',
              zoom: 'var(--row-scale)',
            } as React.CSSProperties
          }
        >
          {rows.map((row) => (
            <div key={row.key} className="shelf-row" style={{ top: px(row.top), height: px(R.height) }}>
              {/* the pack, in the same rule the cigarette pages draw round theirs */}
              <div className="shelf-pack" style={{ ...box(row.frame), '--rule': px(R.rule) } as React.CSSProperties}>
                <img
                  src={`/cigs/${encodeURIComponent(row.pack.id)}.svg`}
                  alt={row.pack.name}
                  width={row.image.width}
                  height={row.image.height}
                  style={{ left: px(row.image.left - row.frame.left), top: px(row.image.top) }}
                  draggable={false}
                />
              </div>

              {/* the plus box is the artwork's; the hit and the menu are CigQuantity's */}
              <span className="shelf-box" style={{ ...box(R.plusBox), borderWidth: px(R.plusBox.stroke) }} aria-hidden="true">
                <span className="shelf-plus-bar" style={box(inside(R.plusH, R.plusBox))} />
                <span className="shelf-plus-bar" style={box(inside(R.plusV, R.plusBox))} />
              </span>

              {/* the bookmark: pressed here, it takes the pack off the shelf */}
              <form action={removePackAction} className="shelf-box shelf-box-form" style={{ ...box(R.bookmarkBox), borderWidth: px(R.bookmarkBox.stroke) }}>
                <input type="hidden" name="pack" value={row.pack.id} />
                <button type="submit" className="shelf-bookmark-hit" aria-label={`Take ${row.pack.name} off your shelf`}>
                  <svg
                    className="shelf-bookmark"
                    viewBox={`0 0 ${BOOKMARK.mark.width} ${BOOKMARK.mark.height}`}
                    preserveAspectRatio="none"
                    style={box(inside(R.bookmark, R.bookmarkBox))}
                    aria-hidden="true"
                  >
                    <path d={BOOKMARK.d} />
                  </svg>
                </button>
              </form>

              <span className="shelf-box" style={{ ...box(R.qtyBox), borderWidth: px(R.qtyBox.stroke) }}>
                {row.quantity ? (
                  <span
                    className="shelf-type"
                    style={type(R.qty)}
                    aria-label={`${row.quantity.slice(0, -1)} ${row.quantity.endsWith('c') ? 'cartons' : 'packs'}`}
                  >
                    {row.quantity}
                  </span>
                ) : null}
              </span>

              <div className="shelf-panel" style={box(R.panel)} aria-hidden="true">
                <span className="shelf-type" style={type({ ...R.line1, left: R.line1.left - R.panel.left, top: R.line1.top - R.panel.top })}>
                  {R.line1.text}
                </span>
                <span className="shelf-type" style={type({ ...R.line2, left: R.line2.left - R.panel.left, top: R.line2.top - R.panel.top })}>
                  {R.line2.text}
                </span>
              </div>

              {R.clouds.map((c, i) => (
                <img key={i} className="shelf-cloud" src="/sigil.webp" alt="" style={box(c)} width={c.width} height={c.height} draggable={false} />
              ))}

              {/* the plus's hit area and the quantity menu, in the row's own box */}
              <CigQuantity id={row.pack.id} name={row.pack.name} amount={row.amount} unit={row.unit} frame={SHELF_QUANTITY_FRAME} />
            </div>
          ))}
        </div>
      </ShelfStage>
    </div>
  );
}
