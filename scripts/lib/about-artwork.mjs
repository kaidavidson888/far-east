/**
 * About Us is the only page whose body copy is substituted.
 *
 * The export drew its two text blocks as bitmaps, and the Our Focus one is
 * damaged: its last line's descenders are sliced off by the box border six
 * pixels below, so "packaging" renders as "packaqinq". The supplied vector
 * does not have that, so it is used for both blocks.
 *
 * One vector holds both. Placed through the export's own pattern transform
 * its intro lands within 0.35px of where the bitmap's did, so that block
 * needs no adjustment. Its Our Focus paragraph does: the export drew that
 * from a separate bitmap positioned about 19.6px lower, carrying its own
 * box. Matching the two by their centres puts the vector's text exactly
 * where the bitmap's was — they agree to 0.1% in height — and the box, which
 * the vector does not include, is drawn as a rect measured off the bitmap.
 *
 * The vector is a trace, so it paints its own ground: 57% of the traced
 * intro renders as 240,6,5 against the page's 255,0,0, which shows as a text
 * box sitting on a slightly different red. The full-canvas ground path is
 * dropped and every fill within GROUND_NEAR of it is snapped to the page
 * colour, leaving the antialiasing gradient between ground and ink intact.
 *
 * Privacy Policy and Terms of Service need none of this: their bodies are
 * single unclipped bitmaps on a transparent ground.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inkBoxOnPage } from './split-svg-parts.mjs';
import { hex, readPaths } from './page-pipeline.mjs';

/** How the export maps the body-text image onto the page. */
const PLACE = { scale: 0.3098075, x: 50 - 0.264952008, y: 127 };

/** Vector y that separates the intro block from the Our Focus paragraph. */
const BAND_SPLIT = 800;

/** Per-channel distance from the trace's ground that still counts as ground. */
const GROUND_NEAR = 12;

/**
 * The Our Focus box, measured off the bitmap the export drew: outer edge
 * 57.5..333.5 by 393.5..612.5, painted with a 1.25px white stroke.
 */
const FOCUS_BOX = { x0: 57.5, y0: 393.5, x1: 333.5, y1: 612.5, stroke: 1.25 };

const extent = (list) => ({
  x0: Math.min(...list.map((p) => p.x0)),
  y0: Math.min(...list.map((p) => p.y0)),
  x1: Math.max(...list.map((p) => p.x1)),
  y1: Math.max(...list.map((p) => p.y1)),
});

const centre = (b) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });

const toPage = (b) => ({
  x0: PLACE.x + b.x0 * PLACE.scale,
  y0: PLACE.y + b.y0 * PLACE.scale,
  x1: PLACE.x + b.x1 * PLACE.scale,
  y1: PLACE.y + b.y1 * PLACE.scale,
});

export async function substituteBodyVector({
  bodyTextFile,
  partsDir,
  page,
  background,
  geometry,
}) {
  const log = [];
  const writePart = async (id, content) => {
    const b = await inkBoxOnPage(content, { ...page, background });
    if (!b) throw new Error(`${id}: the replacement rendered nothing`);
    writeFileSync(
      `${partsDir}/${id}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
        `width="${b.w}" height="${b.h}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" fill="none">\n${content}\n</svg>\n`,
    );
    geometry[id] = {
      x: +b.x.toFixed(2),
      y: +b.y.toFixed(2),
      w: +b.w.toFixed(2),
      h: +b.h.toFixed(2),
    };
    return b;
  };

  const paths = readPaths(readFileSync(bodyTextFile, 'utf8'));
  if (paths.length < 100) {
    throw new Error(`${bodyTextFile}: expected a traced vector, got ${paths.length} paths`);
  }
  const ground = paths.filter((p) => p.x1 - p.x0 > 900 && p.y1 - p.y0 > 1600);
  if (ground.length !== 1) {
    throw new Error(
      `${bodyTextFile}: expected exactly one full-canvas ground path, found ${ground.length}`,
    );
  }
  const groundRGB = hex(ground[0].fill);
  if (!groundRGB) throw new Error(`${bodyTextFile}: could not read the ground colour`);

  let snapped = 0;
  const recolour = (src) =>
    src.replace(/fill="([^"]+)"/, (whole, colour) => {
      const c = hex(colour);
      if (!c || !c.every((v, i) => Math.abs(v - groundRGB[i]) <= GROUND_NEAR)) return whole;
      snapped++;
      return `fill="${background}"`;
    });

  // one unit here is 0.31px on the page, so two decimals is already finer
  // than any screen and costs half the file
  const trim = (src) =>
    src.replace(/ d="([^"]+)"/, (whole, d) =>
      ` d="${d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100))}"`,
    );

  const body = paths.filter((p) => p !== ground[0]);
  const intro = body.filter((p) => (p.y0 + p.y1) / 2 < BAND_SPLIT);
  const focus = body.filter((p) => (p.y0 + p.y1) / 2 >= BAND_SPLIT);
  if (!intro.length || !focus.length) {
    throw new Error(`${bodyTextFile}: the two blocks did not separate at y=${BAND_SPLIT}`);
  }

  const place = (list, dx = 0, dy = 0) =>
    `<g transform="translate(${(PLACE.x + dx).toFixed(4)},${(PLACE.y + dy).toFixed(4)}) scale(${PLACE.scale})">\n` +
    `${list.map((p) => trim(recolour(p.src))).join('\n')}\n</g>`;

  const introBox = await writePart('intro', place(intro));
  log.push(`intro ${intro.length} vector paths at ${introBox.x},${introBox.y} ${introBox.w}x${introBox.h}`);

  const inset = FOCUS_BOX.stroke / 2;
  const bitmapText = {
    x0: FOCUS_BOX.x0 + 6.75,
    y0: FOCUS_BOX.y0 + 6.75,
    x1: FOCUS_BOX.x1 - 6.75,
    y1: FOCUS_BOX.y1 - 6.75,
  };
  const vectorFocus = toPage(extent(focus));
  const dx = centre(bitmapText).x - centre(vectorFocus).x;
  const dy = centre(bitmapText).y - centre(vectorFocus).y;
  const focusContent =
    `${place(focus, dx, dy)}\n` +
    `<rect x="${FOCUS_BOX.x0 + inset}" y="${FOCUS_BOX.y0 + inset}" ` +
    `width="${FOCUS_BOX.x1 - FOCUS_BOX.x0 - FOCUS_BOX.stroke}" ` +
    `height="${FOCUS_BOX.y1 - FOCUS_BOX.y0 - FOCUS_BOX.stroke}" ` +
    `fill="none" stroke="#ffffff" stroke-width="${FOCUS_BOX.stroke}"/>`;
  const focusBox = await writePart('focus', focusContent);
  log.push(
    `focus ${focus.length} vector paths shifted ${dx.toFixed(2)},${dy.toFixed(2)} + a drawn box ` +
      `at ${focusBox.x},${focusBox.y} ${focusBox.w}x${focusBox.h}`,
  );
  log.push(`snapped ${snapped} traced-ground fills to the page's ${background}`);
  return log;
}
