import Link from 'next/link';
import geometry from '@/lib/cigpages.json';
import { SealButton } from './SealButton';

/**
 * One cigarette's page, built from the supplied info-page vector.
 *
 * These are not laid out like the other artwork pages, because they do not
 * need to be: the whole design is one vector, so there is one mark to place
 * rather than a dozen. What it shares with them is the rule — the body
 * keeps its drawn size at every viewport and the space around it flexes,
 * never scaling to fit.
 *
 * The body is cropped to its own content (see `npm run build:cigpages`) and
 * centred, which is what makes the left and right margins equal at any
 * width. It holds the design's 18px top margin.
 *
 * The logo is drawn by the vector and takes a transparent link on top,
 * which is how the landing page handles its own logo. It sits inside the
 * body rather than against the page edge, so it travels with the artwork
 * when the page is wider than the design. The seal does the opposite: it is
 * the animation button, pinned to the page's own right margin like every
 * other page on the site, and the vector's drawn copy is stripped out so
 * there are not two of them.
 */
const { body, top, logo } = geometry;

export function CigPage({ id, name }: { id: string; name: string }) {
  return (
    <div className="cigpage">
      <div
        className="cigpage-stage"
        style={{ minHeight: `${top + body.h + top}px` }}
      >
        <div
          className="cigpage-body"
          style={{ width: `${body.w}px`, height: `${body.h}px`, top: `${top}px` }}
        >
          <img
            className="cigpage-art"
            src={`/cigpages/${id}.svg`}
            alt={name}
            width={body.w}
            height={body.h}
            draggable={false}
          />
          <Link
            className="cigpage-logo"
            href="/landing"
            aria-label="遠東 — home"
            style={{
              left: `${logo.x}px`,
              top: `${logo.y}px`,
              width: `${logo.w}px`,
              height: `${logo.h}px`,
            }}
          />
        </div>
        <SealButton size={logo.h} />
      </div>
    </div>
  );
}
