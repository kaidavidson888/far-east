/**
 * Bakes the landing page's logo menu — the one that GROWS.
 *
 *   npm run build:growmenu
 *
 * monkey-grow.gif draws a box around the 遠東 logo and then grows branches out
 * of it, carrying six words: about us / privacy policy / terms of service
 * across the top, and MY SAVED / OFFERS / RECOMMENDED stacked underneath. Over
 * its last thirty frames the branches recede again and leave the words standing
 * on their own. A GIF cannot be seeked, paused or run backwards and all three
 * are needed, so the frames are baked out here and a canvas scrubs them —
 * exactly as `build-menu-frames.mjs` does for the monkey bar, which this is
 * modelled on and which still serves the cigarette pages.
 *
 * THE THREE LANDING LABELS MOVED INTO IT. OFFERS, My Saved and RECOMMENDED
 * used to be three artwork parts standing under the logo all the time; the
 * owner asked for them to come off the page and for this menu to carry them.
 * So this bake's six words are the menu, and `lib/landing.ts` no longer places
 * those parts.
 *
 * ---------------------------------------------------------------------
 * THE THREE THINGS THIS HAS TO GET RIGHT.
 *
 * 1. SCALE. The monkey bar was drawn at the page's own size; this is drawn at
 *    4.15x it (1840x1136 against a 390-wide page). The scale is not chosen —
 *    it is MEASURED: the gif's first frame is the logo and nothing else, so its
 *    ink box over the logo part's own box IS the scale, and the two axes have
 *    to agree or the source is not what we think it is. They agree to a
 *    thousandth: 40/166 and 87/361 are both 0.2410.
 *
 * 2. ALIGNMENT. The canvas is drawn over the page's own logo — at rest the
 *    vector shows and the canvas is transparent; the moment the menu runs, the
 *    canvas covers it, and frame 0 IS that logo. A half-pixel out reads as a
 *    double image at the exact moment the eye is on it. So the frame is
 *    resized and then EXTRACTED at a whole device pixel chosen to put the
 *    gif's logo ink on the page's logo box, and the residual is printed: it
 *    comes to a tenth of a CSS pixel, where the monkey bar's rule was half of
 *    one.
 *
 * 3. THE GROUND. The gif paints white paper. The canvas sits over the page, so
 *    that white would cut a rectangle out of whatever is under it. Every frame
 *    is un-multiplied out of white on the way out — ink over white is
 *    p = C*a + 255*(1-a), so a = 1 - min(r,g,b)/255 recovers both the colour
 *    and the coverage exactly, for any ink colour. Not a colour key: those
 *    leave a halo on every antialiased edge, and this leaves none, being the
 *    arithmetic the gif's own renderer did, run backwards.
 *
 * ---------------------------------------------------------------------
 * THE SIX WORDS ARE MEASURED, NOT TYPED IN.
 *
 * The monkey bar's four boxes are a table of coordinates in its build with a
 * comment saying they were measured off the last frame. Here they are measured
 * by the build itself, every time: the final frame's ink is grouped into blobs
 * (dilated, so letters join into a phrase and phrases stay apart), the blob
 * holding the logo is set aside, and the remaining six are sorted into reading
 * order — the top branch left to right, then the stack top to bottom. If there
 * are not exactly six, the build stops rather than shipping a menu with a word
 * nobody can press.
 *
 * WHAT EACH WORD DOES is the one thing that cannot be measured, so ITEMS below
 * is the table of that, and it is asserted against what was found.
 *
 * NO PRESSED-STATE IMAGES. The monkey bar's boxes fill black under the pointer
 * and their label turns white, which needs a second image per box because the
 * label cannot be painted over. These are words on transparent paper with no
 * box to fill, so the pointer is answered the way the page answered those same
 * three words before they moved in here — the word drops to half strength, and
 * a quarter while it is held. That is done at draw time by clearing the word's
 * own box and drawing it back at that alpha, so nothing is baked and the two
 * states cannot drift apart.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/monkey-grow.gif';
const LANDING = 'lib/landing-geometry.json';
const FRAMES_DIR = 'public/growmenu/frames';
const GEOMETRY = 'lib/growmenu-geometry.json';

/** Backing-store scale, as the monkey bar's: 2 is what a dense screen wants. */
const SS = 2;

/** Room past the outermost ink, so the frame never stops dead on a stroke. */
const SLACK = 6;

/**
 * What the six words are, in the order the final frame lays them out: the top
 * branch left to right, then the stack under the logo top to bottom. Position
 * is measured; this is what cannot be — where each word goes.
 *
 * `part` rather than `href` means it is not a link: the mark carries that
 * `data-part`, which is the hook `CigScroller` already listens on for My
 * Saved, so the row's spin needs no new wiring. OFFERS and RECOMMENDED have
 * nowhere to go yet — they had nowhere to go as page parts either — so they
 * are marked inert and are drawn, hoverable and unpressable, exactly as
 * before.
 */
const ITEMS = [
  { id: 'about', label: 'About us', href: '/about' },
  { id: 'privacy', label: 'Privacy policy', href: '/privacy' },
  { id: 'terms', label: 'Terms of service', href: '/terms' },
  { id: 'saved', label: 'My Saved', part: 'saved' },
  { id: 'offers', label: 'Offers', inert: true },
  { id: 'recommended', label: 'Recommended', inert: true },
];

/**
 * A phrase's letters join at this radius and two phrases do not — in PAGE
 * pixels, so it means the same thing whatever the backing scale. It has to
 * reach across the line break inside "privacy policy" (7px) and not across the
 * gap to "terms of service" (18) or from OFFERS to RECOMMENDED (11).
 */
const DILATE_PAGE = 4.5;
/** Below this the blob is a speck, not a word. */
const MIN_INK = 400;

const isPaper = (r, g, b) => r > 244 && g > 244 && b > 244;

// ---- the source, and the page it has to land on --------------------------
const buf = readFileSync(SRC);
const meta = await sharp(buf, { animated: true, limitInputPixels: false }).metadata();
const W = meta.width;
const H = meta.pageHeight;
const N = meta.pages;
const delays = (meta.delay ?? []).filter((d) => d < 500); // the last frame is held
const frameMs = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 40;

const logoPart = JSON.parse(readFileSync(LANDING, 'utf8')).parts.logo;

console.log(`${SRC}: ${W}x${H}, ${N} frames, ~${frameMs}ms each (${((N * frameMs) / 1000).toFixed(1)}s)`);

/** One page of the gif as flat RGB over white, at its own size. */
async function gifPage(i) {
  const { data, info } = await sharp(buf, { page: i, limitInputPixels: false })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** The ink box of a flat RGB buffer. */
function inkBox({ data, w, h }) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      if (isPaper(data[o], data[o + 1], data[o + 2])) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n };
}

// ---- the scale, measured off the first frame ------------------------------
const first = await gifPage(0);
const logoInk = inkBox(first);
const kx = logoPart.w / logoInk.w;
const ky = logoPart.h / logoInk.h;
if (Math.abs(kx - ky) / kx > 0.01) {
  throw new Error(
    `frame 0's logo is ${logoInk.w}x${logoInk.h} against the page's ${logoPart.w}x${logoPart.h}: ` +
      `${kx.toFixed(4)} across and ${ky.toFixed(4)} down do not agree — is this the same drawing?`,
  );
}
const K = (kx + ky) / 2;
console.log(
  `  frame 0's logo ink ${logoInk.w}x${logoInk.h} at ${logoInk.x},${logoInk.y} ` +
    `-> the page's ${logoPart.w}x${logoPart.h} at ${logoPart.x},${logoPart.y}: scale ${K.toFixed(5)} (1/${(1 / K).toFixed(3)})`,
);

// ---- how big the canvas has to be ----------------------------------------
// Every frame, not just the last: the branches reach further out on the way
// than anything that is left standing at the end.
let far = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
for (let i = 0; i < N; i++) {
  const b = inkBox(await gifPage(i));
  far = {
    x0: Math.min(far.x0, b.x),
    y0: Math.min(far.y0, b.y),
    x1: Math.max(far.x1, b.x + b.w - 1),
    y1: Math.max(far.y1, b.y + b.h - 1),
  };
}

/** gif px -> page px, by putting the gif's logo ink on the page's logo box. */
const pageX = (gx) => (gx - logoInk.x) * K + logoPart.x;
const pageY = (gy) => (gy - logoInk.y) * K + logoPart.y;

const VIEW_W = Math.ceil(pageX(far.x1 + 1) + SLACK);
const VIEW_H = Math.ceil(pageY(far.y1 + 1) + SLACK);
console.log(
  `  ink over all ${N} frames: gif ${far.x0}..${far.x1} x ${far.y0}..${far.y1} ` +
    `-> page ${pageX(far.x0).toFixed(1)}..${pageX(far.x1 + 1).toFixed(1)} x ` +
    `${pageY(far.y0).toFixed(1)}..${pageY(far.y1 + 1).toFixed(1)}; canvas ${VIEW_W}x${VIEW_H}`,
);

// ---- the resize, and the whole device pixel it is cropped at --------------
const RW = VIEW_W * SS;
const RH = VIEW_H * SS;
const FULL_W = Math.round(W * K * SS);
const FULL_H = Math.round(H * K * SS);
// where the gif's logo ink lands once resized, and where it has to land
const LEFT = Math.round(logoInk.x * K * SS - logoPart.x * SS);
const TOP = Math.round(logoInk.y * K * SS - logoPart.y * SS);
const offX = (logoInk.x * K * SS - logoPart.x * SS - LEFT) / SS;
const offY = (logoInk.y * K * SS - logoPart.y * SS - TOP) / SS;
console.log(
  `  resized ${FULL_W}x${FULL_H}, cropped at ${LEFT},${TOP} device px ` +
    `— the logo lands ${offX.toFixed(3)},${offY.toFixed(3)} CSS px off the page's own`,
);
if (Math.max(Math.abs(offX), Math.abs(offY)) > 0.25) {
  throw new Error('the crop cannot put the logo within a quarter pixel of the page’s — look at the scale');
}
if (LEFT < 0 || TOP < 0 || LEFT + RW > FULL_W || TOP + RH > FULL_H) {
  throw new Error(`the canvas ${RW}x${RH} at ${LEFT},${TOP} does not fit the resized ${FULL_W}x${FULL_H}`);
}

rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

/** Ink over white, back to ink over nothing. See the header. */
function unmultiply(rgb) {
  const out = Buffer.alloc((rgb.length / 3) * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const low = r < g ? (r < b ? r : b) : g < b ? g : b;
    const a = 255 - low;
    if (a === 0) continue; // white: nothing was drawn here
    const back = 255 - a; // what the white ground contributed
    out[o] = Math.min(255, Math.round(((r - back) * 255) / a));
    out[o + 1] = Math.min(255, Math.round(((g - back) * 255) / a));
    out[o + 2] = Math.min(255, Math.round(((b - back) * 255) / a));
    out[o + 3] = a;
  }
  return out;
}

/** One frame, brought to the page's scale and cropped to the canvas. */
async function bakedFrame(i) {
  const { data } = await sharp(buf, { page: i, limitInputPixels: false })
    .flatten({ background: '#ffffff' })
    .resize({ width: FULL_W, height: FULL_H, fit: 'fill' })
    .extract({ left: LEFT, top: TOP, width: RW, height: RH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

let total = 0;
let lastFrame = null;
for (let i = 0; i < N; i++) {
  const data = await bakedFrame(i);
  if (i === N - 1) lastFrame = data;
  const webp = await sharp(unmultiply(data), { raw: { width: RW, height: RH, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(i).padStart(3, '0')}.webp`, webp);
  total += webp.length;
}
console.log(`wrote ${N} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB, ${Math.round(total / N / 1024)}KB each)`);

// ---- the six words, found in the last frame -------------------------------
/** Group ink into blobs, dilating by R so letters join and phrases do not. */
function blobs(data, w, h, R) {
  const m = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const o = p * 3;
    m[p] = isPaper(data[o], data[o + 1], data[o + 2]) ? 0 : 1;
  }
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          d[yy * w + xx] = 1;
        }
      }
    }
  }
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!d[s] || seen[s]) continue;
    stack.push(s);
    seen[s] = 1;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, ink = 0;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      if (m[p]) {
        ink++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (x > 0 && d[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && d[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && d[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && d[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (ink >= MIN_INK) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ink });
  }
  return out;
}

const found = blobs(lastFrame, RW, RH, Math.round(DILATE_PAGE * SS));
// the logo's blob is the one the page's own logo box sits in — it is the
// switch, not a word, and it is where the hover target goes
const inLogo = (b) =>
  b.x <= logoPart.x * SS && b.x + b.w >= (logoPart.x + logoPart.w) * SS &&
  b.y <= logoPart.y * SS && b.y + b.h >= (logoPart.y + logoPart.h) * SS;
const logoBlob = found.find(inLogo);
if (!logoBlob) throw new Error('no blob in the last frame contains the page’s logo box');
const words = found.filter((b) => b !== logoBlob);
if (words.length !== ITEMS.length) {
  throw new Error(
    `the last frame holds ${words.length} words beside the logo, expected ${ITEMS.length}:\n` +
      words.map((b) => `  ${b.x / SS},${b.y / SS} ${b.w / SS}x${b.h / SS}`).join('\n'),
  );
}

// reading order: the branch across the top, left to right, then the stack
const splitY = (logoBlob.y + logoBlob.h) * 1; // anything below the logo's box is in the stack
const top = words.filter((b) => b.y < splitY).sort((a, b) => a.x - b.x);
const stack = words.filter((b) => b.y >= splitY).sort((a, b) => a.y - b.y);
if (top.length !== 3 || stack.length !== 3) {
  throw new Error(`expected 3 words on the branch and 3 under the logo, found ${top.length} and ${stack.length}`);
}

const px = (v) => +(v / SS).toFixed(2);
const BOXES = [...top, ...stack].map((b, i) => ({
  ...ITEMS[i],
  x: px(b.x),
  y: px(b.y),
  w: px(b.w),
  h: px(b.h),
}));

/** The logo's own ink in the first frame — the hover target, as the bar's. */
const LOGO_HIT = {
  x: px(Math.round(pageX(logoInk.x) * SS)),
  y: px(Math.round(pageY(logoInk.y) * SS)),
  w: px(Math.round(logoInk.w * K * SS)),
  h: px(Math.round(logoInk.h * K * SS)),
};

console.log('  the menu, measured off the last frame:');
console.log(`    logo  ${LOGO_HIT.x},${LOGO_HIT.y} ${LOGO_HIT.w}x${LOGO_HIT.h}`);
for (const b of BOXES) {
  console.log(`    ${b.id.padEnd(12)} ${String(b.x).padStart(6)},${String(b.y).padStart(6)} ${b.w}x${b.h}  ${b.href ?? (b.part ? `data-part=${b.part}` : 'inert')}`);
}

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:growmenu — do not edit by hand.',
      dir: '/growmenu/frames',
      frame: { w: VIEW_W, h: VIEW_H, scale: SS },
      frames: N,
      frameMs,
      scale: +K.toFixed(5),
      alignedWithin: { x: +offX.toFixed(3), y: +offY.toFixed(3) },
      hover: 'dim',
      logoHit: LOGO_HIT,
      boxes: BOXES,
      stops: { base: { frames: N, viewW: VIEW_W, boxes: BOXES.map((b) => b.id) } },
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
