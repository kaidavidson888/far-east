import landing from '@/lib/landing-geometry.json';
import geometry from '@/lib/cigpages.json';
import { INFO_BOX, RULE, type PackUnit } from '@/lib/cigPages';
import { CigBookmark } from './CigBookmark';
import { CigQuantity } from './CigQuantity';
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
 * The body is cut to the design's own frame (see `npm run build:cigpages`)
 * and centred, which is what makes the left and right margins equal at any
 * width. It holds the design's 18px top margin. The one change to the design
 * is the title block, which the build moves up under the logo onto the
 * landing page's own left edge; everything else is where it was drawn, and
 * the same page serves a phone and a desktop.
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
 * THE BOOKMARK IS A BUTTON, and it is drawn here for the same reason the
 * logo is: the artwork had it as a filled path inside an <img>, where no
 * stylesheet can reach it. The build takes it out and CigBookmark puts the
 * same path back at the same coordinates — inside the body, so it travels
 * with the artwork rather than with the page's edges. The box round it is
 * still the artwork's; only the mark changes colour.
 *
 * THE LOGO IS THE MENU HERE, not a link home. It unfolds the same monkey
 * bar the landing page's does, with one more box on the end — home — and
 * that box is what carries you back. So the mark below is drawn and not
 * wrapped in an anchor: two controls on one mark would be announced twice,
 * which is how the landing page handles its logo too.
 */
const { body, top } = geometry;
const LOGO = landing.parts.logo;
const SEAL_SIZE = landing.parts.logo.h;

export function CigPage({
  id,
  name,
  gap,
  packId,
  saved,
  amount,
  unit,
}: {
  id: string;
  name: string;
  gap: number;
  /** The id in the address, which is the page's own except for the twelve twins. */
  packId: string;
  saved: boolean;
  /** How many the reader said they have, if they have said. */
  amount: number | null;
  unit: PackUnit | null;
}) {
  // The rule stands off the info by the page's own brand-to-flavour gap, so
  // it reaches below the artwork; the stage grows to keep the design's own
  // margin underneath it rather than letting it sit on the page's edge. The
  // stand-off itself is worked out in CSS, which is the only place that knows
  // how much room the window has — see .cigpage-frame. This is the roomy case,
  // so a narrow screen simply ends up with a little more air at the foot.
  const foot = INFO_BOX.top + INFO_BOX.height + gap + RULE;

  return (
    <div className="cigpage">
      <div
        className="cigpage-stage"
        style={{ minHeight: `${top + Math.max(body.h, foot) + top}px` }}
      >
        <div
          className="cigpage-body"
          style={{
            width: `${body.w}px`,
            height: `${body.h}px`,
            top: `${top}px`,
            // in pixels, not -50%: a half-pixel offset resamples the artwork
            transform: `translateX(-${Math.round(body.w / 2)}px)`,
          }}
        >
          <img
            className="cigpage-art"
            src={`/cigpages/${id}.svg`}
            alt={name}
            width={body.w}
            height={body.h}
            draggable={false}
          />

          {/* the artwork's own bookmark, given back as a control */}
          <CigBookmark id={packId} name={name} saved={saved} />

          {/* the plus beside it, and the menu it opens — see CigQuantity */}
          <CigQuantity id={packId} name={name} amount={amount} unit={unit} />

          {/* a rule round the info, inside the body so it travels with it */}
          <div
            className="cigpage-frame"
            style={
              {
                '--x': INFO_BOX.left,
                '--y': INFO_BOX.top,
                '--w': INFO_BOX.width,
                '--h': INFO_BOX.height,
                '--gap': gap,
              } as React.CSSProperties
            }
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
