/**
 * Cuts the cloud ornament down to something the age gate can carry.
 *
 *   npm run build:sigil
 *
 * The gate sets three of these beside its question, at the height of the
 * title's own capitals. The obvious source is the landing page's cloud part,
 * and the obvious thing to do is point an <img> at it — but that part is
 * 396KB of traced path data, two decimal places on a mark 54 units wide,
 * which is precision to a hundredth of a pixel. Rounding barely helps: the
 * weight is ~28,000 points, not their precision, and one decimal place only
 * takes it to 333KB.
 *
 * It matters more than it looks because AgeGate is rendered from
 * app/layout.tsx, so it is on EVERY page — including the ones that load none
 * of the landing artwork. The full trace would put 396KB on the first view of
 * /catalog, /about and /login for three ornaments in a heading.
 *
 * So it is rasterised, at three times the size it is drawn, which is the rule
 * the rest of this repo's embedded art follows (OVERSAMPLE in build-cigs).
 *
 * THE WHITE GROUND COMES OFF, and by un-multiplying rather than by keying —
 * exactly as build-menu-frames does, for exactly the same reason. The part is
 * drawn for white paper: a white rectangle behind the cloud, and white inside
 * the spirals. On the gate's red panel that white would show as a box. Ink
 * over white is p = C*a + 255*(1-a), so a = 1 - min(r,g,b)/255 and
 * C = (p - 255*(1-a))/a gives back the ink and its coverage exactly. A colour
 * key would leave a light halo on every curve, and this mark is nothing but
 * curves. The spirals end up transparent too, which is right: they are paper
 * showing through, and on this panel the paper is red.
 *
 * Trimmed to its own ink afterwards, because the part's box is not tight —
 * "the height of the capitals" has to mean the cloud's height, not its
 * artboard's.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'public/landing/parts/cloud.svg';
const OUT = 'public/sigil.webp';

/** Drawn at the title's cap height; see .gate-sigil in globals.css. */
const DRAWN_H = 20;
const SS = 3;

/** Ink over white, back to ink over nothing. */
function unmultiply(rgb) {
  const out = Buffer.alloc((rgb.length / 3) * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const low = r < g ? (r < b ? r : b) : g < b ? g : b;
    const a = 255 - low;
    if (a === 0) continue; // white: nothing was drawn here
    const back = 255 - a;
    out[o] = Math.min(255, Math.round(((r - back) * 255) / a));
    out[o + 1] = Math.min(255, Math.round(((g - back) * 255) / a));
    out[o + 2] = Math.min(255, Math.round(((b - back) * 255) / a));
    out[o + 3] = a;
  }
  return out;
}

const svg = readFileSync(SRC);

// Rendered tall first, so the trim finds the ink at full resolution and the
// final resize lands on the exact pixel height wanted rather than near it.
const TALL = DRAWN_H * SS * 8;
const { data, info } = await sharp(svg, { density: 72 * (TALL / 26) })
  .resize({ height: TALL })
  .flatten({ background: '#ffffff' })
  .raw()
  .toBuffer({ resolveWithObject: true });

const lifted = await sharp(unmultiply(data), {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 1 })
  .toBuffer({ resolveWithObject: true });

const inkW = lifted.info.width;
const inkH = lifted.info.height;
const aspect = inkW / inkH;
const drawnW = Math.round(DRAWN_H * aspect);

const webp = await sharp(lifted.data, {
  raw: { width: inkW, height: inkH, channels: 4 },
})
  .resize({ width: drawnW * SS, height: DRAWN_H * SS, fit: 'fill' })
  .webp({ lossless: true, effort: 6 })
  .toBuffer();

writeFileSync(OUT, webp);

/* ------------------------------------------------------- the cursor ----
 * The same mark again, as the pointer for the whole site.
 *
 * IT NEEDS A WHITE KEYLINE. The ink is black and this site has black
 * surfaces to put a pointer on — the gate's NO button, the comment panel on
 * every cigarette page, the top nav — where a black cloud would simply not
 * be there. Every operating system's own arrow solves this the same way, with
 * a contrasting outline, so this does too: the cloud in black over a white
 * copy of itself spread a pixel or two in each direction.
 *
 * The spread is done by compositing the white copy at eight offsets rather
 * than by blurring and thresholding an alpha. It is a union of translations,
 * which is what a dilation IS, and it keeps hard edges — a blur would have
 * given the keyline a soft ramp that reads as a shadow at cursor size.
 *
 * PNG, not the WebP above: cursor support for WebP is not universal, and this
 * is 2KB either way. Two sizes, handed to CSS through image-set so a retina
 * screen gets the denser one.
 *
 * CURSOR_W is 32 because that is the size browsers agree on; Chrome will
 * ignore anything past 128 outright, and some platforms quietly refuse past
 * 32. The hotspot goes on the cloud's own left tip, which is the one part of
 * this shape that comes to a point.
 */
const CURSOR_W = 32;
const KEYLINE = 1.5; // in final pixels

/**
 * Two of these get made: the resting pointer and the pressable one.
 *
 * THE PRESSABLE ONE IS THE RESTING ONE INVERTED — white cloud, black
 * keyline — which is how the site can keep the affordance without keeping
 * the operating system's hand. It matters here more than on most sites: the
 * artwork pages' hit areas are transparent, the buttons ARE the artwork, so
 * the pointer is the only thing that says a thing can be pressed.
 *
 * Both are built the same way from the same silhouette, so they are the same
 * shape to the pixel and swapping between them reads as a colour change
 * rather than as a different mark arriving.
 */
async function cursor(scale, { ink: inkHex, line: lineHex, name }) {
  const w = CURSOR_W * scale;
  const h = Math.round(w / aspect);
  const pad = Math.ceil(KEYLINE * scale);

  // the silhouette, at size, as an alpha mask — everything below is this
  // shape in one colour or the other
  const shape = await sharp(lifted.data, { raw: { width: inkW, height: inkH, channels: 4 } })
    .resize({ width: w, height: h, fit: 'fill' })
    .png()
    .toBuffer();
  const alpha = await sharp(shape).extractChannel('alpha').raw().toBuffer();

  const paint = async (hex) =>
    sharp({ create: { width: w, height: h, channels: 3, background: hex } })
      .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
      .png()
      .toBuffer();

  const ink = await paint(inkHex);
  const white = await paint(lineHex);

  const offsets = [];
  for (let dx = -pad; dx <= pad; dx++) {
    for (let dy = -pad; dy <= pad; dy++) {
      if (dx * dx + dy * dy > pad * pad) continue;
      offsets.push({ input: white, left: pad + dx, top: pad + dy });
    }
  }

  const out = await sharp({
    create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([...offsets, { input: ink, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const path = scale === 1 ? `public/${name}.png` : `public/${name}@${scale}x.png`;
  writeFileSync(path, out);

  // THE HOTSPOT IS MEASURED, not assumed. The cloud's tail is the only part
  // of this shape that comes to a point, and it is neither at the middle of
  // the image nor at its corner — it sits about three quarters of the way
  // down the left edge. Taking the centre of the leftmost column that has
  // any ink in it puts the pointer on the tip itself, so the thing being
  // pointed at is under the part that looks like it is doing the pointing.
  const { data: px, info: pi } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let hotspot = [0, Math.round(pi.height / 2)];
  for (let x = 0; x < pi.width; x++) {
    const rows = [];
    for (let y = 0; y < pi.height; y++) if (px[(y * pi.width + x) * 4 + 3] > 40) rows.push(y);
    if (rows.length) {
      hotspot = [x, Math.round((rows[0] + rows[rows.length - 1]) / 2)];
      break;
    }
  }

  return { path, bytes: out.length, w: w + pad * 2, h: h + pad * 2, hotspot };
}

const REST = { ink: '#010101', line: '#ffffff', name: 'sigil-cursor' };
const PRESS = { ink: '#ffffff', line: '#010101', name: 'sigil-cursor-press' };

const c1 = await cursor(1, REST);
const c2 = await cursor(2, REST);
const p1 = await cursor(1, PRESS);
const p2 = await cursor(2, PRESS);

const before = readFileSync(SRC).length;
console.log(`${SRC} ${Math.round(before / 1024)}KB -> ${OUT} ${(webp.length / 1024).toFixed(1)}KB`);
console.log(`  ink ${inkW}x${inkH} at full size, aspect ${aspect.toFixed(4)}`);
console.log(`  drawn ${drawnW}x${DRAWN_H}, stored ${drawnW * SS}x${DRAWN_H * SS} (${SS}x)`);
console.log(`  cursor      1x ${c1.w}x${c1.h} ${(c1.bytes / 1024).toFixed(1)}KB, 2x ${(c2.bytes / 1024).toFixed(1)}KB, hotspot ${c1.hotspot.join(',')}`);
console.log(`  pressable   1x ${p1.w}x${p1.h} ${(p1.bytes / 1024).toFixed(1)}KB, 2x ${(p2.bytes / 1024).toFixed(1)}KB, hotspot ${p1.hotspot.join(',')}`);
if (c1.hotspot.join() !== p1.hotspot.join()) {
  throw new Error('the two cursors disagree about the hotspot — they must be the same shape');
}
console.log(`\n  the hotspot below goes in .site-cursor in globals.css, by hand:`);
console.log(`    cursor: url('/sigil-cursor.png') ${c1.hotspot.join(' ')}, auto;`);
