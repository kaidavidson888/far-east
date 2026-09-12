import landing from '@/lib/landing-geometry.json';
import { BOOKMARK } from '@/lib/cigPages';
import { SHELF_HEADER, SHELF_ROW, shelfLayout, type ShelfEntry } from '@/lib/shelfPage';
import { LogoMenu } from './LogoMenu';

/**
 * The reader's shelf, drawn from the owner's design — see lib/shelfPage.ts
 * for the template and the rules it holds.
 *
 * Nothing here is a picture of the design. The boxes are boxes, the rules
 * are rules, the clouds are the site's own cloud, the packs are the same
 * cleaned marks the landing row uses, and the type is the owner's face —
 * which is what the owner asked for, and what makes it sharp at any size.
 *
 * The comment panel is drawn as the design draws it and does nothing yet:
 * the pack shelf has nowhere to keep a note, and inventing that is a bigger
 * change than a page. See Known gaps.
 */
const LOGO = landing.parts.logo;
const px = (n: number) => `${n}px`;
const box = (b: { left: number; top: number; width: number; height: number }): React.CSSProperties => ({
  left: px(b.left),
  top: px(b.top),
  width: px(b.width),
  height: px(b.height),
});
const type = (t: { left: number; top: number; size: number }): React.CSSProperties => ({
  left: px(t.left),
  top: px(t.top),
  fontSize: px(t.size),
});

export function ShelfPage({ entries }: { entries: ShelfEntry[] }) {
  const { rows, minHeight } = shelfLayout(entries);
  const R = SHELF_ROW;

  return (
    <div className="shelf">
      <div className="shelf-stage" style={{ minHeight: px(minHeight) }}>
        {/* the mark the menu's first frame is baked to sit on, at the landing margins */}
        <span className="shelf-logo" style={{ left: px(LOGO.x), top: px(LOGO.y) }}>
          <img src="/landing/parts/logo.svg" alt="" width={LOGO.w} height={LOGO.h} draggable={false} />
        </span>

        <div
          className="shelf-header-box"
          style={{
            right: px(SHELF_HEADER.box.right),
            top: px(SHELF_HEADER.box.top),
            width: px(SHELF_HEADER.box.width),
            height: px(SHELF_HEADER.box.height),
            borderWidth: px(SHELF_HEADER.box.stroke),
            fontSize: px(SHELF_HEADER.click.size),
          }}
        >
          {SHELF_HEADER.click.text}
        </div>
        <div
          className="shelf-price"
          style={{ right: px(SHELF_HEADER.price.right), top: px(SHELF_HEADER.price.top), fontSize: px(SHELF_HEADER.price.size) }}
        >
          {SHELF_HEADER.price.text}
        </div>

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

            <span className="shelf-box" style={{ ...box(R.plusBox), borderWidth: px(R.plusBox.stroke) }} aria-hidden="true">
              <span className="shelf-plus-bar" style={box({ ...R.plusH, left: R.plusH.left - R.plusBox.left, top: R.plusH.top - R.plusBox.top })} />
              <span className="shelf-plus-bar" style={box({ ...R.plusV, left: R.plusV.left - R.plusBox.left, top: R.plusV.top - R.plusBox.top })} />
            </span>

            <span className="shelf-box" style={{ ...box(R.bookmarkBox), borderWidth: px(R.bookmarkBox.stroke) }} role="img" aria-label="On your shelf">
              <svg
                className="shelf-bookmark"
                viewBox={`0 0 ${BOOKMARK.mark.width} ${BOOKMARK.mark.height}`}
                preserveAspectRatio="none"
                style={box({ ...R.bookmark, left: R.bookmark.left - R.bookmarkBox.left, top: R.bookmark.top - R.bookmarkBox.top })}
                aria-hidden="true"
              >
                <path d={BOOKMARK.d} />
              </svg>
            </span>

            <span className="shelf-box" style={{ ...box(R.qtyBox), borderWidth: px(R.qtyBox.stroke) }}>
              {row.quantity ? (
                <span
                  className="shelf-type"
                  style={type({ ...R.qty, left: R.qty.left - R.qtyBox.left, top: R.qty.top - R.qtyBox.top })}
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
          </div>
        ))}

        <LogoMenu stop="home" />
      </div>
    </div>
  );
}
