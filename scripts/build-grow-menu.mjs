/**
 * Bakes the landing page's menu — the one that GROWS out of the I button.
 *
 *   npm run build:growmenu
 *
 * monkey-grow.gif was drawn round the 遠東 logo: a box is drawn round the
 * logo, then vines grow out of it carrying six words — about us / privacy
 * policy / terms of service across the top, MY SAVED / OFFERS / RECOMMENDED
 * stacked underneath — each word uncovered under a cloud of swirls, and over
 * the last thirty frames the vines and swirls recede and leave the words
 * standing. A GIF cannot be seeked, paused or run backwards, so the frames
 * are baked out here and a canvas scrubs them (components/LogoMenu.tsx).
 *
 * THE OWNER'S 2026-09-19 ASK CHANGED WHAT IT GROWS OUT OF AND HOW THE TOP
 * ROW IS LAID OUT:
 *
 *   "replace the character logo and all instances of it in the animation to
 *   a outline box with a capital I from the webfont bolded inside. make the
 *   box and letter black. make it 20% larger than the + button and orient it
 *   so it has 10px margins between the top and left of the page and itself.
 *   this is the new button that opens into the current menu. make the privacy
 *   policy and tos text all be in one line and the same size as the about us.
 *   All three pieces of text should have the same height and be scaled
 *   around this height that height should be equal to the height of the
 *   outline of the I button. increase the margins between the text buttons 2
 *   times and adjust the animation accordingly."
 *
 * So the gif is no longer baked as one picture. It is RE-COMPOSITED, frame by
 * frame, out of its own pieces, from the full-size source (4.15x the page), so
 * nothing the enlargement touches goes soft:
 *
 *   - THE I BUTTON is the page's, not the canvas's (LogoMenu draws it from
 *     `badge` below): a 36px box — the plus's 30 plus 20% — at 10,10, with a
 *     bold I in the owner's face. It is always there, so the gif's first
 *     sixty frames, which only DRAW the box round the logo, are dropped: the
 *     run starts on the frame before the first vine appears, and the drawn
 *     box and the logo are never copied at all.
 *
 *   - THE TOP ROW is cut into pieces along x and each piece is scaled and
 *     moved on its own:
 *       * each WORD is scaled uniformly so that its x-height is the one that
 *         makes "about us" 36px from the top of its tall letters to its
 *         baseline — the I button's height — with every baseline on the I
 *         button's foot. Measured, not assumed: the gif drew "terms of
 *         service" about 10% smaller than the other two, and this brings it
 *         to the same size ("the same size as the about us").
 *       * "privacy / policy" and "terms / of service" were drawn on TWO
 *         lines. Each is split into its lines — glyph by glyph, because the
 *         descenders of one line and the ascenders of the next share rows —
 *         and the second line is set after the first, one word-space on, the
 *         space being the one the gif drew inside "about us".
 *       * each GAP between two words is stretched to TWICE its width at that
 *         size ("increase the margins between the text buttons 2 times"). It
 *         is stretched rather than cut open because the swirls run
 *         continuously from word to word — no column of any gap is empty in
 *         every frame (measured) — so cutting would tear them, and stretching
 *         keeps them whole, the vine through the gap simply longer.
 *       * the piece between the button and "about us" is scaled with the
 *         words, not doubled: it is not a gap BETWEEN text buttons.
 *
 *   - THE STACK (MY SAVED, OFFERS, RECOMMENDED and their vine) keeps its
 *     size and moves up under the I button, its words' left edge on the
 *     button's, its vine starting at the button's foot.
 *
 * Everything the new top row covers is measured off the gif every build and
 * the build stops if the pieces are not what it expects.
 *
 * TWO CONSEQUENCES THE OWNER SHOULD KNOW, both printed by the build:
 *   - the swirls rise well above the words (about 13px in the drawing, so
 *     about 35 at the new size), and the words' tops are 10px from the page's
 *     top, so while the menu grows the upper swirls run off the top of the
 *     page. They are gone again by the time it is open.
 *   - the top row is about 1100px wide now, so it fits a desktop and runs off
 *     the side of a phone.
 *
 * THE GROUND. The gif paints white paper; every frame is un-multiplied out of
 * white on the way out (ink over white is p = C*a + 255*(1-a), so
 * a = 1 - min(r,g,b)/255 recovers the colour and the coverage exactly) — not
 * a colour key, which would leave a halo on every antialiased edge.
 *
 * WHAT EACH WORD DOES cannot be measured, so ITEMS below is that table.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/monkey-grow.gif';
const LANDING = 'lib/landing-geometry.json';
const FRAMES_DIR = 'public/growmenu/frames';
const GEOMETRY = 'lib/growmenu-geometry.json';

/** Backing-store scale: 2 is what a dense screen wants. */
const SS = 2;
/** Room past the outermost ink, so the frame never stops dead on a stroke. */
const SLACK = 6;

/** The I button: the plus button's 30px, and 20% more. 10px off the top and the left. */
const PLUS = 30;
const BADGE = { x: 10, y: 10, size: Math.round(PLUS * 1.2) };
/** Its rule: the plus's 2px, which 20% more leaves at 2 on a whole pixel. */
const BADGE_RULE = Math.round(2 * 1.2);
/** The I is as tall inside it as the plus's mark is inside the plus (16 of 30), plus 20%. */
const BADGE_CAP = Math.round(16 * 1.2);
/**
 * The I's type size and how far to nudge it so its INK, not its em box, is
 * centred in the box. Off the owner's face as Chrome renders it
 * (scripts/assets/far-east-ink.json): the I stands 781 units above the
 * baseline and 16 below, and a line-height:1 box puts the baseline 0.825 of
 * the size down (measured in Chrome for the shelf). So the ink's middle sits
 * 0.4425 of the size from the top, 0.0575 above the box's middle.
 */
const INK = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));
const BADGE_FONT = +(BADGE_CAP / (INK.asc.I / INK.em)).toFixed(2);
const BADGE_DY = +(BADGE_FONT * (0.5 - (0.825 - (INK.asc.I - INK.desc.I) / 2 / INK.em))).toFixed(2);

/** The new top row: tall letters from the button's top, baselines on its foot. */
const ROW_TOP = BADGE.y;
const ROW_BASE = BADGE.y + BADGE.size;
/** "increase the margins between the text buttons 2 times" */
const GAP_FACTOR = 2;

/** What the six words are, in reading order: the top row, then the stack. */
const ITEMS = [
  { id: 'about', label: 'About us', href: '/about' },
  { id: 'privacy', label: 'Privacy policy', href: '/privacy' },
  { id: 'terms', label: 'Terms of service', href: '/terms' },
  { id: 'saved', label: 'My Saved', part: 'saved' },
  { id: 'offers', label: 'Offers', inert: true },
  { id: 'recommended', label: 'Recommended', inert: true },
];

/** Letters join into a phrase at this radius and phrases do not — page px. */
const DILATE_PAGE = 4.5;
const MIN_INK = 400;

const isPaper = (r, g, b) => r > 244 && g > 244 && b > 244;
const fail = (msg) => {
  throw new Error(`build-grow-menu: ${msg}`);
};

// ---- the source ------------------------------------------------------------
const buf = readFileSync(SRC);
const meta = await sharp(buf, { animated: true, limitInputPixels: false }).metadata();
const W = meta.width;
const H = meta.pageHeight;
const N = meta.pages;
const delays = (meta.delay ?? []).filter((d) => d < 500); // the last frame is held
const frameMs = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 40;
const logoPart = JSON.parse(readFileSync(LANDING, 'utf8')).parts.logo;
console.log(`${SRC}: ${W}x${H}, ${N} frames, ~${frameMs}ms each`);

/** One page of the gif as flat RGB over white, at full size. */
async function gifPage(i) {
  const { data } = await sharp(buf, { page: i, limitInputPixels: false })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}
const low = (data, x, y) => {
  const o = (y * W + x) * 3;
  const r = data[o], g = data[o + 1], b = data[o + 2];
  return r < g ? (r < b ? r : b) : g < b ? g : b;
};
/** Ink box of a gif page, optionally only where `keep(x, y)` in gif px. */
function inkBox(data, keep = () => true) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (isPaper(data[o], data[o + 1], data[o + 2]) || !keep(x, y)) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return n ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
}

// ---- the old page's coordinates: the gif's logo on the logo part ----------
// Everything below is measured in the page px of the layout the gif was drawn
// for, because that is where the logo part anchors it — the same mapping the
// menu has always been baked on.
const frame0 = await gifPage(0);
const logoInk = inkBox(frame0);
const kx = logoPart.w / logoInk.w;
const ky = logoPart.h / logoInk.h;
if (Math.abs(kx - ky) / kx > 0.01) fail(`the logo's two axes disagree: ${kx.toFixed(4)} and ${ky.toFixed(4)}`);
const K = (kx + ky) / 2;
const pageX = (gx) => (gx - logoInk.x) * K + logoPart.x;
const pageY = (gy) => (gy - logoInk.y) * K + logoPart.y;
const gifX = (px) => (px - logoPart.x) / K + logoInk.x;
const gifY = (py) => (py - logoPart.y) / K + logoInk.y;
console.log(`  scale ${K.toFixed(5)} (the gif is ${(1 / K).toFixed(2)}x the page)`);

// ---- the drawn box, and where the run starts --------------------------------
// The box is drawn over the first frames and then stands still; the first vine
// leaves it some frames later. The run starts on the last frame before that.
let box = null;
let START = -1;
{
  let prev = null;
  // the logo is drawn from frame 0, so "the ink stopped changing" only means
  // the box once the ink is bigger than the logo on every side
  const biggerThanLogo = (b) =>
    b.x < logoInk.x - 4 && b.y < logoInk.y - 4 && b.x + b.w > logoInk.x + logoInk.w + 4 && b.y + b.h > logoInk.y + logoInk.h + 4;
  for (let i = 1; i < N; i++) {
    const data = await gifPage(i);
    const b = inkBox(data);
    if (!b) continue;
    if (!box) {
      if (prev && biggerThanLogo(b) && b.x === prev.x && b.y === prev.y && b.w === prev.w && b.h === prev.h) box = b;
      prev = b;
      continue;
    }
    // the box's ink box is exact, so anything past it by a single gif px is vine
    const pad = 1;
    const out = inkBox(data, (x, y) => x < box.x - pad || x >= box.x + box.w + pad || y < box.y - pad || y >= box.y + box.h + pad);
    if (out) {
      START = i - 1;
      break;
    }
  }
}
if (!box || START < 0) fail('could not find the drawn box and the first vine');
const BOX = { x0: pageX(box.x), y0: pageY(box.y), x1: pageX(box.x + box.w), y1: pageY(box.y + box.h) };
console.log(
  `  the drawn box: page ${BOX.x0.toFixed(1)}..${BOX.x1.toFixed(1)} x ${BOX.y0.toFixed(1)}..${BOX.y1.toFixed(1)}; ` +
    `the first vine leaves it after frame ${START}, so the run is frames ${START}..${N - 1} (${N - START} frames)`,
);

// ---- the six words, off the last frame, at the page's scale ---------------
const last = await gifPage(N - 1);
/** Blobs in page px: letters join, phrases stay apart — at 1 page px per cell. */
function pageBlobs(data) {
  const pw = Math.ceil(pageX(W)) + 1;
  const ph = Math.ceil(pageY(H)) + 1;
  const m = new Uint8Array(pw * ph);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (isPaper(data[o], data[o + 1], data[o + 2])) continue;
      const X = Math.floor(pageX(x));
      const Y = Math.floor(pageY(y));
      if (X >= 0 && Y >= 0 && X < pw && Y < ph) m[Y * pw + X] += m[Y * pw + X] < 255 ? 1 : 0;
    }
  }
  const R = Math.round(DILATE_PAGE);
  const d = new Uint8Array(pw * ph);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    if (!m[y * pw + x]) continue;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < ph && xx >= 0 && xx < pw) d[yy * pw + xx] = 1;
    }
  }
  const seen = new Uint8Array(pw * ph);
  const out = [];
  for (let s = 0; s < pw * ph; s++) {
    if (!d[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, ink = 0;
    while (stack.length) {
      const p = stack.pop();
      const x = p % pw, y = (p / pw) | 0;
      if (m[p]) {
        ink += m[p];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      for (const q of [p - 1, p + 1, p - pw, p + pw]) {
        if (q < 0 || q >= pw * ph || seen[q] || !d[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === pw - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (ink >= MIN_INK) out.push({ x0, y0, x1: x1 + 1, y1: y1 + 1 });
  }
  return out;
}
const blobs = pageBlobs(last);
const inBox = (b) => b.x0 >= BOX.x0 - 1 && b.x1 <= BOX.x1 + 1 && b.y0 >= BOX.y0 - 1 && b.y1 <= BOX.y1 + 1;
const words = blobs.filter((b) => !inBox(b));
const topWords = words.filter((b) => b.y1 <= BOX.y1).sort((a, b) => a.x0 - b.x0);
const stackWords = words.filter((b) => b.y0 >= BOX.y1).sort((a, b) => a.y0 - b.y0);
if (topWords.length !== 3 || stackWords.length !== 3) {
  fail(`expected 3 words on the top row and 3 in the stack, found ${topWords.length} and ${stackWords.length}`);
}

// ---- each top word's lines, measured at the gif's own resolution ----------
/** Glyph ink of the last frame inside a page rect, as a gif-px mask. */
function glyphMask(pb) {
  const gx0 = Math.floor(gifX(pb.x0 - 1)), gy0 = Math.floor(gifY(pb.y0 - 1));
  const gx1 = Math.ceil(gifX(pb.x1 + 1)), gy1 = Math.ceil(gifY(pb.y1 + 1));
  const w = gx1 - gx0, h = gy1 - gy0;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = low(last, gx0 + x, gy0 + y) < 128 ? 1 : 0;
  return { m, w, h, gx0, gy0 };
}
/** Connected components of a mask (4-connected). */
function components({ m, w, h }) {
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    const id = comps.length;
    const c = { id, x0: 1e9, y0: 1e9, x1: -1, y1: -1, px: [] };
    const stack = [s];
    lab[s] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      c.px.push(p);
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      if (x > 0 && m[p - 1] && lab[p - 1] < 0) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && m[p + 1] && lab[p + 1] < 0) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && m[p - w] && lab[p - w] < 0) { lab[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && m[p + w] && lab[p + w] < 0) { lab[p + w] = id; stack.push(p + w); }
    }
    comps.push(c);
  }
  return comps;
}
/**
 * The x-height band of each line: [top, baseline) in mask rows.
 *
 * A line's x-height band is where its ink is densest — the ascenders, the
 * descenders and the dots are thin by comparison. The lines are separated
 * first, at the emptiest row in the middle half of the block, and each line's
 * band is then its first to its last row carrying at least half of THAT
 * line's busiest row: one threshold across both lines fails on "terms / of
 * service", whose second line is much denser than its first.
 */
function lineBands({ m, w, h }, count) {
  const rows = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows[y] += m[y * w + x];
  let cuts = [0, h];
  if (count === 2) {
    let at = -1, least = Infinity;
    for (let y = Math.floor(h * 0.25); y < Math.ceil(h * 0.75); y++) {
      // a little smoothing, so one thin row inside a letter is not taken for the gap
      const v = rows[y - 1] + 2 * rows[y] + rows[y + 1];
      if (v < least) { least = v; at = y; }
    }
    cuts = [0, at, h];
  }
  const bands = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const max = Math.max(...rows.slice(a, b));
    let first = -1, lastRow = -1;
    for (let y = a; y < b; y++) if (rows[y] >= max * 0.5) { if (first < 0) first = y; lastRow = y; }
    if (first < 0 || lastRow - first < 3) fail(`a line of letters could not be found in rows ${a}..${b}`);
    bands.push([first, lastRow + 1]);
  }
  return bands;
}

const measured = topWords.map((pb, wi) => {
  const G = glyphMask(pb);
  // "about us" was drawn on one line; the other two on two
  const expect = wi === 0 ? 1 : 2;
  const bands = lineBands(G, expect);
  const comps = components(G);
  const lines = bands.map(([a, b]) => ({ xTop: a, base: b, comps: [], x0: 1e9, x1: -1, y0: 1e9, y1: -1 }));
  for (const c of comps) {
    // a component belongs to the line whose letters it overlaps; a dot, which
    // overlaps none, to the line under it
    let best = -1, bestOverlap = 0;
    lines.forEach((L, li) => {
      const o = Math.min(c.y1 + 1, L.base) - Math.max(c.y0, L.xTop);
      if (o > bestOverlap) { bestOverlap = o; best = li; }
    });
    if (best < 0) best = lines.findIndex((L) => L.xTop >= c.y1);
    if (best < 0) best = lines.length - 1;
    const L = lines[best];
    L.comps.push(c);
    L.x0 = Math.min(L.x0, c.x0); L.x1 = Math.max(L.x1, c.x1 + 1);
    L.y0 = Math.min(L.y0, c.y0); L.y1 = Math.max(L.y1, c.y1 + 1);
  }
  // one mask per line, grown by 2 gif px so a letter's soft edge in an
  // earlier frame belongs to the same line as the letter
  const owner = new Int8Array(G.w * G.h).fill(-1);
  lines.forEach((L, li) => {
    for (const c of L.comps) for (const p of c.px) {
      const x = p % G.w, y = (p / G.w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < G.w && yy < G.h) owner[yy * G.w + xx] = li;
      }
    }
  });
  const toPageX = (gx) => pageX(G.gx0 + gx);
  const toPageY = (gy) => pageY(G.gy0 + gy);
  return {
    G,
    owner,
    // where swirls that belong to no letter are split between the lines
    splitGy: lines.length === 2 ? G.gy0 + (lines[0].base + lines[1].xTop) / 2 : Infinity,
    lines: lines.map((L) => ({
      xTop: toPageY(L.xTop),
      base: toPageY(L.base),
      x0: toPageX(L.x0),
      x1: toPageX(L.x1),
      y0: toPageY(L.y0),
      y1: toPageY(L.y1),
    })),
    box: pb,
  };
});

// "about us": its tall letters' top, its baseline, its x-height, and the space
// the gif drew between its two words
const about = measured[0];
const aboutLine = about.lines[0];
const aboutTall = aboutLine.base - aboutLine.y0;
const xh = (m) => m.lines.reduce((s, L) => s + (L.base - L.xTop), 0) / m.lines.length;
const kAbout = BADGE.size / aboutTall;
const X_STAR = xh(about) * kAbout;
const spaceGif = (() => {
  const { m, w, h } = about.G;
  const [a, b] = lineBands(about.G, 1)[0];
  const cols = [];
  for (let x = 0; x < w; x++) { let n = 0; for (let y = a; y < b; y++) n += m[y * w + x]; cols.push(n); }
  let first = cols.findIndex((n) => n > 0), lastc = cols.length - 1 - [...cols].reverse().findIndex((n) => n > 0);
  let best = 0, run = 0;
  for (let x = first; x <= lastc; x++) { if (cols[x] === 0) { run++; best = Math.max(best, run); } else run = 0; }
  return best;
})();
const SPACE_REL = (spaceGif * K) / xh(about); // the word space, in x-heights
const k = measured.map((m) => X_STAR / xh(m));
console.log(
  `  "about us": ${aboutTall.toFixed(2)}px from its tall letters to its baseline, x-height ${xh(about).toFixed(2)} ` +
    `-> x${kAbout.toFixed(3)} makes it ${BADGE.size} tall; word space ${(SPACE_REL * X_STAR).toFixed(1)}px at that size`,
);
measured.forEach((m, i) => console.log(`    ${ITEMS[i].id.padEnd(8)} x-height ${xh(m).toFixed(2)} -> scaled x${k[i].toFixed(3)}`));

// ---- the pieces of the top row, and where each one goes --------------------
/*
 * A piece is a rectangle of the old page (and a rule for which of its pixels
 * it owns), a scale, and where its left edge and its reference line land.
 * Pieces are laid left to right; `cursor` is where the next one starts.
 */
const TOP_Y0 = Math.max(0, BOX.y0 - 30); // everything the branch ever draws is below this
const TOP_Y1 = BOX.y1; // and above the box's foot, where the stack begins
const aboutBase = aboutLine.base;
const pieces = [];
let cursor = BADGE.x + BADGE.size; // the button's right edge
const addPiece = (p) => {
  pieces.push(p);
  cursor = p.newX0 + (p.x1 - p.x0) * p.sx;
};
// the stretch from the drawn box to "about us" — scaled with the words, not doubled
addPiece({ name: 'to about', x0: BOX.x1, x1: topWords[0].x0, sx: kAbout, sy: kAbout, refY: aboutBase, newRefY: ROW_BASE, newX0: cursor });
const wordPieces = [];
for (let wi = 0; wi < 3; wi++) {
  const m = measured[wi];
  const kw = k[wi];
  if (wi > 0) {
    // the gap before this word, stretched to twice its width — and WARPED, so
    // its left side follows the word before it and its right side the word
    // after (see renderGap): a two-line word's first line sat higher in the
    // drawing than "about us" did, so one straight mapping across the gap tore
    // every swirl that crossed into the word.
    const g0 = topWords[wi - 1].x1, g1 = topWords[wi].x0;
    const kg = (k[wi - 1] + kw) / 2;
    const prev = pieces[pieces.length - 1];
    const firstLineBase = m.lines[0].base;
    addPiece({
      name: `gap ${wi}`,
      x0: g0,
      x1: g1,
      sx: kg * GAP_FACTOR,
      sy: kg,
      refY: aboutBase,
      newRefY: ROW_BASE,
      newX0: cursor,
      gap: { left: { refY: prev.refY, k: prev.sy }, right: { refY: firstLineBase, k: kw } },
    });
  }
  const x0 = topWords[wi].x0, x1 = topWords[wi].x1;
  if (m.lines.length === 1) {
    const p = { name: ITEMS[wi].id, x0, x1, sx: kw, sy: kw, refY: m.lines[0].base, newRefY: ROW_BASE, newX0: cursor };
    addPiece(p);
    wordPieces[wi] = [{ p, L: m.lines[0] }];
  } else {
    const [L1, L2] = m.lines;
    const p1 = { name: `${ITEMS[wi].id} 1`, x0, x1, sx: kw, sy: kw, refY: L1.base, newRefY: ROW_BASE, newX0: cursor, line: 0, word: wi };
    // the second line starts one word-space after the first line's last letter
    const glyphRight1 = p1.newX0 + (L1.x1 - x0) * kw;
    const newX0_2 = glyphRight1 + SPACE_REL * X_STAR - (L2.x0 - x0) * kw;
    const p2 = { name: `${ITEMS[wi].id} 2`, x0, x1, sx: kw, sy: kw, refY: L2.base, newRefY: ROW_BASE, newX0: newX0_2, line: 1, word: wi };
    pieces.push(p1);
    addPiece(p2);
    wordPieces[wi] = [{ p: p1, L: L1 }, { p: p2, L: L2 }];
  }
}
// whatever the branch draws after the last word
{
  let farX = topWords[2].x1;
  for (let i = START; i < N; i += 4) {
    const b = inkBox(await gifPage(i), (x, y) => pageX(x) > topWords[2].x1 && pageY(y) < TOP_Y1);
    if (b) farX = Math.max(farX, pageX(b.x + b.w));
  }
  if (farX > topWords[2].x1 + 0.5) {
    // mapped as the line it follows, so nothing tears where the two meet
    const lastLine = measured[2].lines[measured[2].lines.length - 1];
    addPiece({ name: 'tail', x0: topWords[2].x1, x1: farX + 1, sx: k[2], sy: k[2], refY: lastLine.base, newRefY: ROW_BASE, newX0: cursor });
  }
}

// ---- the stack: the same size, moved up under the button -------------------
const STACK_DX = BADGE.x - stackWords[0].x0; // MY SAVED's left on the button's left
const STACK_DY = ROW_BASE - BOX.y1; // its vine starting at the button's foot
let stackFar = { x1: 0, y1: 0 };
for (let i = START; i < N; i += 2) {
  const b = inkBox(await gifPage(i), (x, y) => pageY(y) >= BOX.y1);
  if (b) stackFar = { x1: Math.max(stackFar.x1, pageX(b.x + b.w)), y1: Math.max(stackFar.y1, pageY(b.y + b.h)) };
}
const stackPiece = { name: 'stack', x0: 0, x1: stackFar.x1 + 1, y0: BOX.y1, y1: stackFar.y1 + 1, sx: 1, sy: 1, dx: STACK_DX, dy: STACK_DY };

// ---- the canvas -------------------------------------------------------------
const topRight = Math.max(...pieces.map((p) => p.newX0 + (p.x1 - p.x0) * p.sx));
const topBottom = Math.max(...pieces.map((p) => p.newRefY + (TOP_Y1 - p.refY) * p.sy));
const VIEW_W = Math.ceil(Math.max(topRight, stackPiece.x1 + STACK_DX) + SLACK);
const VIEW_H = Math.ceil(Math.max(topBottom, stackPiece.y1 + STACK_DY) + SLACK);
const RW = VIEW_W * SS;
const RH = VIEW_H * SS;
const aboveTop = Math.min(...pieces.map((p) => p.newRefY + (TOP_Y0 - p.refY) * p.sy));
console.log(`  canvas ${VIEW_W}x${VIEW_H} page px; the top row's pieces reach up to y=${aboveTop.toFixed(0)} (anything above 0 is off the page)`);
for (const p of pieces) {
  console.log(`    ${p.name.padEnd(10)} old x ${p.x0.toFixed(1)}..${p.x1.toFixed(1)} -> new x ${p.newX0.toFixed(1)}..${(p.newX0 + (p.x1 - p.x0) * p.sx).toFixed(1)}, x${p.sx.toFixed(3)} across, x${p.sy.toFixed(3)} down`);
}

// ---- baking -----------------------------------------------------------------
rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

/** Ink over white, back to ink over nothing. */
function unmultiply(rgb) {
  const out = Buffer.alloc((rgb.length / 3) * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const lo = r < g ? (r < b ? r : b) : g < b ? g : b;
    const a = 255 - lo;
    if (a === 0) continue;
    const back = 255 - a;
    out[o] = Math.min(255, Math.round(((r - back) * 255) / a));
    out[o + 1] = Math.min(255, Math.round(((g - back) * 255) / a));
    out[o + 2] = Math.min(255, Math.round(((b - back) * 255) / a));
    out[o + 3] = a;
  }
  return out;
}

/**
 * One piece of one frame, as RGB at the new size, and where it goes on the
 * canvas — clipped to the canvas, so the swirls above the page's top simply
 * do not arrive.
 */
async function renderPiece(data, p, y0, y1, own) {
  // Rounded rather than floored at the near edge: the pieces that start at the
  // drawn box's edge start on the gif's own first column past it, and a floor
  // of a value that came back through page px a hair short takes one column
  // of the box along with it.
  const gx0 = Math.max(0, Math.round(gifX(p.x0))), gx1 = Math.min(W, Math.ceil(gifX(p.x1)));
  const gy0 = Math.max(0, Math.round(gifY(y0))), gy1 = Math.min(H, Math.ceil(gifY(y1)));
  const w = gx1 - gx0, h = gy1 - gy0;
  if (w <= 0 || h <= 0) return null;
  const rgb = Buffer.alloc(w * h * 3, 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (own && !own(gx0 + x, gy0 + y)) continue;
      const s = ((gy0 + y) * W + gx0 + x) * 3;
      // The gif's paper is not quite clean: it carries faint bands a few
      // levels off white, which un-multiply to alphas of 8 or 10 — invisible,
      // but drawn, and across a canvas this wide, drawn everywhere. Paper is
      // taken as paper. (At most 4% coverage is lost at an antialiased edge.)
      if (isPaper(data[s], data[s + 1], data[s + 2])) continue;
      const d = (y * w + x) * 3;
      rgb[d] = data[s];
      rgb[d + 1] = data[s + 1];
      rgb[d + 2] = data[s + 2];
    }
  }
  // where the piece's corner lands, in device px
  const oldX0 = pageX(gx0), oldY0 = pageY(gy0);
  const dx = p.dx === undefined ? (p.newX0 + (oldX0 - p.x0) * p.sx) * SS : (oldX0 + p.dx) * SS;
  const dy = p.dy === undefined ? (p.newRefY + (oldY0 - p.refY) * p.sy) * SS : (oldY0 + p.dy) * SS;
  const dw = Math.max(1, Math.round(w * K * p.sx * SS));
  const dh = Math.max(1, Math.round(h * K * p.sy * SS));
  let left = Math.round(dx), top = Math.round(dy);
  let out = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .resize({ width: dw, height: dh, fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  // clip to the canvas
  const cx0 = Math.max(0, -left), cy0 = Math.max(0, -top);
  const cx1 = Math.min(dw, RW - left), cy1 = Math.min(dh, RH - top);
  if (cx1 <= cx0 || cy1 <= cy0) return null;
  if (cx0 || cy0 || cx1 !== dw || cy1 !== dh) {
    out = await sharp(out, { raw: { width: dw, height: dh, channels: 3 } })
      .extract({ left: cx0, top: cy0, width: cx1 - cx0, height: cy1 - cy0 })
      .raw()
      .toBuffer();
  }
  return { input: out, raw: { width: cx1 - cx0, height: cy1 - cy0, channels: 3 }, left: left + cx0, top: top + cy0, blend: 'darken' };
}

/**
 * A gap between two words, stretched across and WARPED down: at its left edge
 * a pixel lands where the word before it maps it, at its right edge where the
 * word after it does, and in between a straight blend of the two. So a swirl
 * that crosses from the gap into either word carries on where it should
 * rather than jumping. Sampled straight from the gif, bilinearly — this is
 * enlargement throughout (under one gif px per device px), where bilinear is
 * exact enough.
 */
function renderGap(data, p) {
  const { left: L, right: R } = p.gap;
  const newW = (p.x1 - p.x0) * p.sx;
  const mapY = (y, t) => ROW_BASE + (y - ((1 - t) * L.refY + t * R.refY)) * ((1 - t) * L.k + t * R.k);
  // how far down the warped piece can reach, at either end
  const yTop = Math.min(mapY(TOP_Y0, 0), mapY(TOP_Y0, 1));
  const yBot = Math.max(mapY(TOP_Y1, 0), mapY(TOP_Y1, 1));
  const X0 = Math.max(0, Math.floor(p.newX0 * SS)), X1 = Math.min(RW, Math.ceil((p.newX0 + newW) * SS));
  const Y0 = Math.max(0, Math.floor(yTop * SS)), Y1 = Math.min(RH, Math.ceil(yBot * SS));
  const w = X1 - X0, h = Y1 - Y0;
  if (w <= 0 || h <= 0) return null;
  const out = Buffer.alloc(w * h * 3, 255);
  const sample = (gx, gy) => {
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= W || y0 + 1 >= H) return null;
    const fx = gx - x0, fy = gy - y0;
    const c = [0, 0, 0];
    for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const s = ((y0 + dy) * W + x0 + dx) * 3;
      const paper = isPaper(data[s], data[s + 1], data[s + 2]);
      for (let ch = 0; ch < 3; ch++) c[ch] += (paper ? 255 : data[s + ch]) * wgt;
    }
    return c;
  };
  for (let X = X0; X < X1; X++) {
    const nx = (X + 0.5) / SS;
    const t = Math.min(1, Math.max(0, (nx - p.newX0) / newW));
    const ox = p.x0 + (nx - p.newX0) / p.sx;
    const a = (1 - t) * L.k + t * R.k;
    const ref = (1 - t) * L.refY + t * R.refY;
    for (let Y = Y0; Y < Y1; Y++) {
      const oy = ref + ((Y + 0.5) / SS - ROW_BASE) / a;
      if (oy < TOP_Y0 || oy >= TOP_Y1) continue;
      const c = sample(gifX(ox) - 0.5, gifY(oy) - 0.5);
      if (!c) continue;
      const d = ((Y - Y0) * w + (X - X0)) * 3;
      out[d] = Math.round(c[0]);
      out[d + 1] = Math.round(c[1]);
      out[d + 2] = Math.round(c[2]);
    }
  }
  return { input: out, raw: { width: w, height: h, channels: 3 }, left: X0, top: Y0, blend: 'darken' };
}

/** Which line of a two-line word a gif pixel belongs to. */
function lineOwner(m, gx, gy) {
  const x = gx - m.G.gx0, y = gy - m.G.gy0;
  if (x >= 0 && y >= 0 && x < m.G.w && y < m.G.h) {
    const o = m.owner[y * m.G.w + x];
    if (o >= 0) return o;
  }
  return gy < m.splitGy ? 0 : 1;
}

let total = 0;
const FRAMES = N - START;
for (let f = 0; f < FRAMES; f++) {
  const data = await gifPage(START + f);
  const layers = [];
  for (const p of pieces) {
    if (p.gap) {
      const g = renderGap(data, p);
      if (g) layers.push(g);
      continue;
    }
    const own = p.line === undefined ? null : (gx, gy) => lineOwner(measured[p.word], gx, gy) === p.line;
    const l = await renderPiece(data, p, TOP_Y0, TOP_Y1, own);
    if (l) layers.push(l);
  }
  const s = await renderPiece(data, stackPiece, stackPiece.y0, stackPiece.y1, null);
  if (s) layers.push(s);
  const composed = await sharp({ create: { width: RW, height: RH, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .raw()
    .toBuffer({ resolveWithObject: true });
  // composite hands back an alpha channel whatever went in; the ground is
  // opaque white, so it carries nothing, and the rest of this reads RGB
  let flat = composed.data;
  if (composed.info.channels === 4) {
    flat = Buffer.alloc(RW * RH * 3);
    for (let p = 0; p < RW * RH; p++) {
      flat[p * 3] = composed.data[p * 4];
      flat[p * 3 + 1] = composed.data[p * 4 + 1];
      flat[p * 3 + 2] = composed.data[p * 4 + 2];
    }
  } else if (composed.info.channels !== 3) {
    fail(`composite returned ${composed.info.channels} channels`);
  }
  const webp = await sharp(unmultiply(flat), { raw: { width: RW, height: RH, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(f).padStart(3, '0')}.webp`, webp);
  total += webp.length;
  if (f === 0) {
    // at rest the canvas must say nothing: the button is the page's
    const a = unmultiply(flat);
    let ink = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let i = 3; i < a.length; i += 4) {
      if (a[i] <= 8) continue;
      ink++;
      const p = (i - 3) / 4, x = p % RW, y = (p / RW) | 0;
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
    if (ink) {
      fail(
        `the first frame draws ${ink} device px, at page ${bx0 / SS}..${(bx1 + 1) / SS} x ${by0 / SS}..${(by1 + 1) / SS}; ` +
          'at rest the canvas must be empty',
      );
    }
  }
}
console.log(`wrote ${FRAMES} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB, ${Math.round(total / FRAMES / 1024)}KB each)`);

// ---- the words' boxes, where they now stand ----------------------------------
const r2 = (v) => +(Math.round(v * 2) / 2).toFixed(1);
const mapX = (p, x) => p.newX0 + (x - p.x0) * p.sx;
const mapY = (p, y) => p.newRefY + (y - p.refY) * p.sy;
const topBoxes = wordPieces.map((parts) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const { p, L } of parts) {
    x0 = Math.min(x0, mapX(p, L.x0)); x1 = Math.max(x1, mapX(p, L.x1));
    y0 = Math.min(y0, mapY(p, L.y0)); y1 = Math.max(y1, mapY(p, L.y1));
  }
  return { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) };
});
const stackBoxes = stackWords.map((b) => ({ x: r2(b.x0 + STACK_DX), y: r2(b.y0 + STACK_DY), w: r2(b.x1 - b.x0), h: r2(b.y1 - b.y0) }));
const BOXES = [...topBoxes, ...stackBoxes].map((b, i) => ({ ...ITEMS[i], ...b }));
console.log('  the menu:');
console.log(`    I button ${BADGE.x},${BADGE.y} ${BADGE.size}x${BADGE.size}`);
for (const b of BOXES) console.log(`    ${b.id.padEnd(12)} ${String(b.x).padStart(7)},${String(b.y).padStart(6)} ${b.w}x${b.h}`);

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:growmenu — do not edit by hand.',
      dir: '/growmenu/frames',
      frame: { w: VIEW_W, h: VIEW_H, scale: SS },
      frames: FRAMES,
      frameMs,
      scale: +K.toFixed(5),
      hover: 'dim',
      logoHit: { x: BADGE.x, y: BADGE.y, w: BADGE.size, h: BADGE.size },
      badge: { letter: 'I', rule: BADGE_RULE, cap: BADGE_CAP, font: BADGE_FONT, dy: BADGE_DY },
      boxes: BOXES,
      stops: { base: { frames: FRAMES, viewW: VIEW_W, boxes: BOXES.map((b) => b.id) } },
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
