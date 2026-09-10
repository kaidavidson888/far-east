/**
 * Replaces the About Us page's bitmaps with the artwork the owner supplied.
 *
 * BODY TEXT. The export drew both text blocks as bitmaps, and the Our Focus
 * one is damaged: its last line's descenders are sliced off by the box border
 * six pixels below, so "packaging" renders as "packaqinq". The supplied
 * vector does not have that, so it is used for both blocks.
 *
 * One vector holds both. Placed through the export's own pattern transform
 * its intro lands within 0.35px of where the bitmap's did, so that block
 * needs no adjustment. Its Our Focus paragraph does: the export drew that
 * from a separate bitmap positioned about 19.6px lower, carrying its own box.
 * Matching the two by their centres puts the vector's text exactly where the
 * bitmap's was — they agree to 0.1% in height — and the box, which the vector
 * does not include, is drawn as a rect measured off the bitmap.
 *
 * The vector is a VTracer trace, so it paints its own ground: 57% of the
 * traced intro renders as 240,6,5 against the page's 255,0,0, which shows as
 * a text box sitting on a slightly different red. The full-canvas ground path
 * is dropped and every fill within GROUND_NEAR of it is snapped to the page
 * colour, which leaves the antialiasing gradient between ground and ink
 * intact — only the flat background is touched.
 *
 * BUTTONS. Standalone 54x54 files whose geometry matches the export's boxes
 * exactly, so they drop straight in, wrapped in a translate to carry the page
 * coordinates the other parts use. They are used verbatim: re-encoding their
 * embedded bitmap even at 6x the drawn size measured 7-9% softer at DPR 2
 * than the file as supplied, and on marks this small that is visible.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { inkBoxOnPage } from './split-svg-parts.mjs';

/**
 * "about us" is drawn smaller than the other two labels — 43x9px against
 * 44.9x19.9 and 42x23.5 — and although its strokes measure a comparable
 * 1.35px on the page, at that size they land between pixels: only 10% of its
 * ink renders solid, where terms-of-service manages 23% and privacy-policy
 * 45%. It reads grey and mushy next to them, and no change of file format
 * fixes that, since a vector would rasterise to the same sub-pixel coverage.
 *
 * Growing the mask by 4 source pixels — 0.087px on the page, under a tenth of
 * a pixel — brings it to 23% solid, matching its neighbour. Set to 0 to leave
 * the supplied artwork exactly as it is.
 */
const LABEL_THICKEN = { navAbout: 4 };

/** Grow a mask's alpha by r pixels, as two passes of a 1-D maximum. */
async function thicken(svgText, r) {
  if (!r) return svgText;
  const m = /xlink:href="data:image\/[a-z]+;base64,([^"]+)"/.exec(svgText);
  if (!m) throw new Error('no embedded image to thicken');
  const { data, info } = await sharp(Buffer.from(m[1], 'base64'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  const alpha = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = data[p * C + 3];
  const wide = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let max = 0;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= W) continue;
        if (alpha[y * W + xx] > max) max = alpha[y * W + xx];
      }
      wide[y * W + x] = max;
    }
  }
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let max = 0;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= H) continue;
        if (wide[yy * W + x] > max) max = wide[yy * W + x];
      }
      const o = (y * W + x) * 4;
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = max;
    }
  }
  const png = await sharp(Buffer.from(out), { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return svgText.replace(
    /xlink:href="data:image\/[a-z]+;base64,[^"]+"/,
    `xlink:href="data:image/png;base64,${png.toString('base64')}"`,
  );
}

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

const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c ?? '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Paths with their absolute extents, from the coordinates and the translate. */
function readPaths(svg) {
  return (svg.match(/<path\b[^>]*\/>/g) ?? []).map((src) => {
    const t = /transform="translate\(([-\d.]+),([-\d.]+)\)"/.exec(src);
    const tx = t ? Number(t[1]) : 0;
    const ty = t ? Number(t[2]) : 0;
    const n = (/ d="([^"]+)"/.exec(src)?.[1] ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = n[i] + tx;
      const y = n[i + 1] + ty;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { src, fill: /fill="([^"]+)"/.exec(src)?.[1], x0, y0, x1, y1 };
  });
}

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

export async function substituteArtwork({
  bodyTextFile,
  navFiles,
  partsDir,
  page,
  background,
  geometry,
}) {
  const log = [];
  const pageRGB = hex(background);
  if (!pageRGB) throw new Error(`background must be #rrggbb, got ${background}`);

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

  // ---- body text ---------------------------------------------------------
  const vec = readFileSync(bodyTextFile, 'utf8');
  const paths = readPaths(vec);
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
  log.push(`intro   ${intro.length} vector paths at ${introBox.x},${introBox.y} ${introBox.w}x${introBox.h}`);

  // the bitmap's Our Focus sat lower than the vector's; match their centres
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
    `focus   ${focus.length} vector paths shifted ${dx.toFixed(2)},${dy.toFixed(2)} + a drawn box ` +
      `at ${focusBox.x},${focusBox.y} ${focusBox.w}x${focusBox.h}`,
  );
  log.push(`        snapped ${snapped} traced-ground fills to the page's ${background}`);

  // ---- footer buttons, verbatim -----------------------------------------
  for (const [id, file] of Object.entries(navFiles)) {
    const at = geometry[id];
    if (!at) throw new Error(`no geometry for ${id} to place its replacement against`);
    const r = LABEL_THICKEN[id] ?? 0;
    const supplied = await thicken(readFileSync(file, 'utf8'), r);
    const inner = supplied.slice(supplied.indexOf('>') + 1, supplied.lastIndexOf('</svg>'));
    const content = `<g transform="translate(${at.x},${at.y})">${inner}</g>`;
    const b = await writePart(id, content);
    if (Math.abs(b.x - at.x) > 1 || Math.abs(b.y - at.y) > 1 || Math.abs(b.w - at.w) > 1) {
      throw new Error(
        `${id}: the supplied file lands at ${b.x},${b.y} ${b.w}x${b.h}, not the export's ` +
          `${at.x},${at.y} ${at.w}x${at.h} — its geometry does not match`,
      );
    }
    log.push(`${id.padEnd(7)} supplied file${r ? `, mask grown ${r}px (${((r * b.w) / 1974).toFixed(3)}px on the page)` : ", unaltered"}, at ${b.x},${b.y} ${b.w}x${b.h}`);
  }

  return log;
}
