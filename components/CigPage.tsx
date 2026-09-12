import landing from '@/lib/landing-geometry.json';
import geometry from '@/lib/cigpages.json';
import type { ArtDevice } from '@/lib/artpage';
import { LogoMenu } from './LogoMenu';
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
 * The body is cropped to a frame (see `npm run build:cigpages`) and centred,
 * which is what makes the left and right margins equal at any width. It
 * holds the design's 18px top margin.
 *
 * TWO ARRANGEMENTS. The desktop gets the one the owner asked for: the title
 * block up under the logo on the landing page's own left edge, and
 * everything below it spread down the whole page instead of stopping three
 * quarters of the way. The phone keeps the design as it was drawn, which is
 * a phone-shaped page to begin with. They are two cuts of the same vector,
 * chosen on the server so the page arrives already right rather than
 * rearranging itself after hydration.
 *
 * AND THEY ARE PLACED DIFFERENTLY. The phone's is centred, which is what
 * makes its side margins equal. The desktop's is anchored to the page's left
 * margin instead, because its title has to stay under the logo — and the
 * logo is pinned to the page's edge, so a centred column would carry the
 * title away from it the moment the window grew. The space that would have
 * been a right margin flexes between the body and the seal's corner.
 *
 * THE LOGO AND THE SEAL ARE THE PAGE'S, NOT THE ARTWORK'S. Both are taken
 * out of the vector by the build and placed here instead, against the
 * page's own edges rather than against the body — the margin rule, the
 * same as every other page on the site. Two reasons beyond consistency:
 * the vector draws its logo as a raster, which reads soft at the size it
 * is shown, and a logo that travelled with a centred body would sit in a
 * different place on every width.
 *
 * Both come from the landing page's geometry, so the mark, its size and
 * its margins are identical wherever you are: the logo at the landing's
 * own 45 and 28, the seal as tall as the logo at the corner it always
 * occupies.
 *
 * THE LOGO IS THE MENU HERE, not a link home. It unfolds the same monkey
 * bar the landing page's does, with one more box on the end — home — and
 * that box is what carries you back. So the mark below is drawn and not
 * wrapped in an anchor: two controls on one mark would be announced twice,
 * which is how the landing page handles its logo too.
 */
const { body: drawn, top: drawnTop, desktop } = geometry;
const LOGO = landing.parts.logo;
const SEAL_SIZE = landing.parts.logo.h;

export function CigPage({ id, name, device }: { id: string; name: string; device: ArtDevice }) {
  const phone = device === 'mobile';
  const body = phone ? drawn : desktop.body;
  const top = phone ? drawnTop : desktop.top;
  const src = phone ? `/cigpages/${id}.svg` : `/cigpages/desktop/${id}.svg`;
  // centred on the phone (the stylesheet rounds the 50% to a whole pixel),
  // held at the page's left margin on the desktop
  const place = phone
    ? // in pixels, not -50%: a half-pixel offset resamples the artwork
      { transform: `translateX(-${Math.round(body.w / 2)}px)` }
    : { left: `${desktop.left}px`, transform: 'none' };

  return (
    <div className="cigpage">
      <div className="cigpage-stage" style={{ minHeight: `${top + body.h + top}px` }}>
        <div
          className="cigpage-body"
          style={{ width: `${body.w}px`, height: `${body.h}px`, top: `${top}px`, ...place }}
        >
          <img
            className="cigpage-art"
            src={src}
            alt={name}
            width={body.w}
            height={body.h}
            draggable={false}
          />
        </div>

        {/* the mark the menu's own first frame is baked to sit on, to the pixel */}
        <span className="cigpage-logo" style={{ left: `${LOGO.x}px`, top: `${LOGO.y}px` }}>
          <img
            src="/landing/parts/logo.svg"
            alt=""
            width={LOGO.w}
            height={LOGO.h}
            draggable={false}
          />
        </span>

        <LogoMenu stop="home" />
        <SealButton size={SEAL_SIZE} />
      </div>
    </div>
  );
}
