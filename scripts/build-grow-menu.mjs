/**
 * Bakes the landing page's menu — the one that GROWS out of the mountain
 * button.
 *
 *   npm run build:growmenu
 *
 * WHAT IS THE OWNER'S AND WHAT IS GROWN HERE
 *
 * The six words are the owner's own drawing, cut out of monkey-grow.gif's last
 * frame and laid out to their asks (below). EVERYTHING THAT MOVES IS GROWN:
 * the gif's vines are no longer baked at all.
 *
 *   "instead of an I make it the image ive attached with the same dimensions
 *   make the mountain black and the tipi black with a white outline the same
 *   thickness as the outline box. as the animation that reveals the text
 *   buttons plays use the animation that you made for the seal logo button
 *   where the black leaves traces in the white as if it is draining as the
 *   text is written. make sure the animation grows into the text like branches
 *   or flowing water that is interconnected but sprouts more connected paths
 *   as it flows outward."  (2026-09-19)
 *
 * So:
 *   - THE BUTTON'S MARK is the owner's mountain vector, cut to a mark by
 *     scripts/lib/badge-mark.mjs — the sky dropped, the mountain the ink, the
 *     tipi separated from it by a white rule of the box's own weight. IT IS
 *     DRAWN BY THE CANVAS, not by the page, because it has to drain: frame 0
 *     is the mark alone, which is what shows at rest.
 *   - THE INK THAT WRITES THE WORDS IS A GROWN NETWORK (scripts/lib/
 *     ink-growth.mjs): channels that braid, sprout and curl, drawn up to
 *     wherever their front has reached. The front is a real position at a real
 *     time, so each word is written by the channel that passes it.
 *   - THE MARK DRAINS BY THE SAME CLOCK. Ink is taken out of it in order of
 *     its distance THROUGH THE MOUNTAIN from the two places the network leaves
 *     the button, so it empties from the exits inward, and what is left behind
 *     is its outline, its veins and the tipi — the traces.
 *   - THE LAST FIFTH RUNS THE CLOCK BACK, so the network retracts tip-first and
 *     the mark fills again, leaving the six words standing. That is what the
 *     gif did, and it is one clock rather than a second animation.
 *
 * THE WORDS' LAYOUT is unchanged and still measured off the gif every build:
 *   - each WORD is scaled so its X-HEIGHT is the reset button's (15px in the
 *     owner's face), because a drawing has no type size to copy;
 *   - "privacy / policy" and "terms / of service" were drawn on two lines and
 *     are set on one, the second line a word-space after the first — the space
 *     the gif drew inside "about us";
 *   - the gaps between the words are twice their scaled width ("increase the
 *     margins between the text buttons 2 times");
 *   - the stack keeps its size and moves up under the button.
 * Everything that layout depends on is measured, and the build stops if the
 * gif is not what it expects.
 *
 * WHERE THE CANVAS STARTS. The growth reaches above the top row, so the canvas
 * is taller than the menu and starts above the page's 10px margin by however
 * much the growth asks for (`SHIFT`) — the button still lands on 10,10.
 *
 * WHAT EACH WORD DOES cannot be measured, so ITEMS below is that table.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';
import { badgeMark, markAspect, distanceTo } from './lib/badge-mark.mjs';
import {
  mulberry32, spline, curl, channel, atArc, frontArc, widthAt, sprout, linkTips, Ink, smoothstep, easeInOut, easeIn, vn2,
} from './lib/ink-growth.mjs';

const SRC = 'scripts/assets/monkey-grow.gif';
const LANDING = 'lib/landing-geometry.json';
const FRAMES_DIR = 'public/growmenu/frames';
const GEOMETRY = 'lib/growmenu-geometry.json';

/** Backing-store scale: 2 is what a dense screen wants. */
const SS = 2;
/** Room past the outermost ink, so the frame never stops dead on a stroke. */
const SLACK = 6;
/** One seed for the whole network: a rebuild must be byte-identical. */
const SEED = 20260919;

/**
 * THE BUTTON IS THE PLUS BUTTON'S SIZE — 30px square with a 2px rule, 10px off
 * the page's top and left, drawn at the row's own scale so the two always
 * match on screen (`layoutMenu` in CigScroller).
 */
const PLUS = 30;
const MARGIN = 10;
const BADGE = { x: 0, y: 0, size: PLUS };
const BADGE_RULE = 2;
/**
 * THE MARK SITS ON THE FOOT OF THE BOX AND KEEPS A PIXEL CLEAR AT EACH SIDE.
 * The mountain is a full-bleed picture — it reaches the frame's left, right
 * and bottom edges — so drawn to the full inside of the rule it merges with
 * three sides of it and the button stops reading as a box. A pixel of air at
 * the sides keeps the frame, and standing it on the inner foot keeps the
 * mountain on the ground rather than floating in a slot.
 */
const MARK_SIDE_AIR = 1;

/** What the six words are, in reading order: the top row, then the stack. */
const ITEMS = [
  { id: 'about', label: 'About us', href: '/about' },
  { id: 'privacy', label: 'Privacy policy', href: '/privacy' },
  { id: 'terms', label: 'Terms of service', href: '/terms' },
  { id: 'saved', label: 'My Saved', part: 'saved' },
  { id: 'offers', label: 'Offers', inert: true },
  { id: 'recommended', label: 'Recommended', inert: true },
];

/** The words are set at the reset button's size, on the button's middle line. */
const RESET_TYPE = 15;
const ROW_MIDDLE = BADGE.y + BADGE.size / 2;
/** "increase the margins between the text buttons 2 times" */
const GAP_FACTOR = 2;

/** Letters join into a phrase at this radius and phrases do not — page px. */
const DILATE_PAGE = 4.5;
const MIN_INK = 400;

const INK = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));
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

// ---- the drawn box: what the words are measured against ---------------------
// The gif drew a box round its logo before anything grew. The words are laid
// out from it, and everything inside it is the old mark and is never copied.
let box = null;
let START = -1;
{
  let prev = null;
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
    // the box's ink box is exact, so anything past it by a single gif px is growth
    const pad = 1;
    const out = inkBox(data, (x, y) => x < box.x - pad || x >= box.x + box.w + pad || y < box.y - pad || y >= box.y + box.h + pad);
    if (out) {
      START = i - 1;
      break;
    }
  }
}
if (!box || START < 0) fail('could not find the drawn box and the first thing to grow out of it');
const BOX = { x0: pageX(box.x), y0: pageY(box.y), x1: pageX(box.x + box.w), y1: pageY(box.y + box.h) };
console.log(
  `  the drawn box: page ${BOX.x0.toFixed(1)}..${BOX.x1.toFixed(1)} x ${BOX.y0.toFixed(1)}..${BOX.y1.toFixed(1)}; ` +
    `the gif's own run is frames ${START}..${N - 1}`,
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
/** The x-height band of each line: [top, baseline) in mask rows. */
function lineBands({ m, w, h }, count) {
  const rows = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows[y] += m[y * w + x];
  let cuts = [0, h];
  if (count === 2) {
    let at = -1, least = Infinity;
    for (let y = Math.floor(h * 0.25); y < Math.ceil(h * 0.75); y++) {
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
  const expect = wi === 0 ? 1 : 2; // "about us" was drawn on one line, the others on two
  const bands = lineBands(G, expect);
  const comps = components(G);
  const lines = bands.map(([a, b]) => ({ xTop: a, base: b, comps: [], x0: 1e9, x1: -1, y0: 1e9, y1: -1 }));
  for (const c of comps) {
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
    splitGy: lines.length === 2 ? G.gy0 + (lines[0].base + lines[1].xTop) / 2 : Infinity,
    lines: lines.map((L) => ({
      xTop: toPageY(L.xTop), base: toPageY(L.base), x0: toPageX(L.x0), x1: toPageX(L.x1), y0: toPageY(L.y0), y1: toPageY(L.y1),
    })),
    box: pb,
  };
});

const about = measured[0];
const aboutLine = about.lines[0];
const xh = (m) => m.lines.reduce((s, L) => s + (L.base - L.xTop), 0) / m.lines.length;
/** The x-height the row's own buttons are set at: that is the size to match. */
const X_STAR = (RESET_TYPE * INK.asc.x) / INK.em;
const kAbout = X_STAR / xh(about);
const spaceGif = (() => {
  const { m, w } = about.G;
  const [a, b] = lineBands(about.G, 1)[0];
  const cols = [];
  for (let x = 0; x < w; x++) { let n = 0; for (let y = a; y < b; y++) n += m[y * w + x]; cols.push(n); }
  const first = cols.findIndex((n) => n > 0);
  const lastc = cols.length - 1 - [...cols].reverse().findIndex((n) => n > 0);
  let best = 0, run = 0;
  for (let x = first; x <= lastc; x++) { if (cols[x] === 0) { run++; best = Math.max(best, run); } else run = 0; }
  return best;
})();
const SPACE_REL = (spaceGif * K) / xh(about); // the word space, in x-heights
const k = measured.map((m) => X_STAR / xh(m));
measured.forEach((m, i) => console.log(`    ${ITEMS[i].id.padEnd(8)} x-height ${xh(m).toFixed(2)} -> scaled x${k[i].toFixed(3)}`));

// ---- the pieces of the top row, and where each one goes --------------------
const TOP_Y0 = Math.max(0, BOX.y0 - 30);
const TOP_Y1 = BOX.y1;
const aboutMid = (aboutLine.xTop + aboutLine.base) / 2;
const pieces = [];
let cursor = BADGE.x + BADGE.size;
const addPiece = (p) => {
  pieces.push(p);
  cursor = p.newX0 + (p.x1 - p.x0) * p.sx;
};
// the run from the drawn box to "about us" is measured but no longer drawn:
// nothing of the gif's own growth is copied now. It still sets the cursor.
cursor += (topWords[0].x0 - BOX.x1) * kAbout;
const wordPieces = [];
for (let wi = 0; wi < 3; wi++) {
  const m = measured[wi];
  const kw = k[wi];
  if (wi > 0) {
    // the gap before this word, at twice its scaled width
    const kg = (k[wi - 1] + kw) / 2;
    cursor += (topWords[wi].x0 - topWords[wi - 1].x1) * kg * GAP_FACTOR;
  }
  const x0 = topWords[wi].x0, x1 = topWords[wi].x1;
  if (m.lines.length === 1) {
    const p = { name: ITEMS[wi].id, x0, x1, sx: kw, sy: kw, refY: (m.lines[0].xTop + m.lines[0].base) / 2, newRefY: ROW_MIDDLE, newX0: cursor };
    addPiece(p);
    wordPieces[wi] = [{ p, L: m.lines[0] }];
  } else {
    const [L1, L2] = m.lines;
    const p1 = { name: `${ITEMS[wi].id} 1`, x0, x1, sx: kw, sy: kw, refY: (L1.xTop + L1.base) / 2, newRefY: ROW_MIDDLE, newX0: cursor, line: 0, word: wi };
    const glyphRight1 = p1.newX0 + (L1.x1 - x0) * kw;
    const newX0_2 = glyphRight1 + SPACE_REL * X_STAR - (L2.x0 - x0) * kw;
    const p2 = { name: `${ITEMS[wi].id} 2`, x0, x1, sx: kw, sy: kw, refY: (L2.xTop + L2.base) / 2, newRefY: ROW_MIDDLE, newX0: newX0_2, line: 1, word: wi };
    pieces.push(p1);
    addPiece(p2);
    wordPieces[wi] = [{ p: p1, L: L1 }, { p: p2, L: L2 }];
  }
}

// ---- the stack: the same size, moved up under the button -------------------
const STACK_DX = BADGE.x - stackWords[0].x0;
const STACK_DY = BADGE.y + BADGE.size - BOX.y1;
const stackPiece = {
  name: 'stack',
  x0: 0,
  x1: Math.max(...stackWords.map((b) => b.x1)) + 1,
  y0: BOX.y1,
  y1: Math.max(...stackWords.map((b) => b.y1)) + 1,
  sx: 1, sy: 1, dx: STACK_DX, dy: STACK_DY,
};

// ---- the words, drawn once, from the last frame ----------------------------
/**
 * One piece of the LAST frame, as RGB at the new size, and where it goes.
 * Nothing else of the gif is used: by then its own growth has receded and the
 * frame is the six words and the drawn box, and the box is never inside a
 * piece.
 */
async function renderPiece(p, y0, y1, own) {
  const gx0 = Math.max(0, Math.round(gifX(p.x0))), gx1 = Math.min(W, Math.ceil(gifX(p.x1)));
  const gy0 = Math.max(0, Math.round(gifY(y0))), gy1 = Math.min(H, Math.ceil(gifY(y1)));
  const w = gx1 - gx0, h = gy1 - gy0;
  if (w <= 0 || h <= 0) return null;
  const rgb = Buffer.alloc(w * h * 3, 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (own && !own(gx0 + x, gy0 + y)) continue;
      const s = ((gy0 + y) * W + gx0 + x) * 3;
      if (isPaper(last[s], last[s + 1], last[s + 2])) continue;
      const d = (y * w + x) * 3;
      rgb[d] = last[s]; rgb[d + 1] = last[s + 1]; rgb[d + 2] = last[s + 2];
    }
  }
  const oldX0 = pageX(gx0), oldY0 = pageY(gy0);
  const dx = p.dx === undefined ? p.newX0 + (oldX0 - p.x0) * p.sx : oldX0 + p.dx;
  const dy = p.dy === undefined ? p.newRefY + (oldY0 - p.refY) * p.sy : oldY0 + p.dy;
  const dw = Math.max(1, Math.round(w * K * p.sx * SS));
  const dh = Math.max(1, Math.round(h * K * p.sy * SS));
  const out = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .resize({ width: dw, height: dh, fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  return { rgb: out, w: dw, h: dh, left: Math.round(dx * SS), top: Math.round(dy * SS) };
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

const drawn = [];
for (const p of pieces) {
  const own = p.line === undefined ? null : (gx, gy) => lineOwner(measured[p.word], gx, gy) === p.line;
  const l = await renderPiece(p, TOP_Y0, TOP_Y1, own);
  if (l) drawn.push(l);
}
{
  const s = await renderPiece(stackPiece, stackPiece.y0, stackPiece.y1, null);
  if (s) drawn.push(s);
}

// ---- where everything stands, and how big the canvas has to be -------------
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
/** The six words where they stand, in the button's own coordinates. */
const LAID = [...topBoxes, ...stackBoxes];

// ---- the network -----------------------------------------------------------
/**
 * WHERE THE INK LEAVES THE BUTTON. Two exits, because the menu has two runs:
 * the top row goes out of the right-hand side on the row's middle line, the
 * stack out of the foot.
 */
const EXIT_TOP = { x: BADGE.size, y: ROW_MIDDLE };
const EXIT_DOWN = { x: BADGE.x + BADGE.size / 2, y: BADGE.y + BADGE.size };
/** How the channels sprout. Lengths and gaps are page px. */
const GROWTH = {
  step: 0.5,
  start0: 0.05,
  gap0: 21, gap1: 8, // shorter as it flows outward: more paths, not fewer
  angle: 0.45,
  lens: [18, 11, 7],
  minLen: 4,
  maxDepth: 3,
  bypass: 0.26, bypassLen: 24, bow: 4.5,
  twig: 0.4, twigLen: 11, curl: 3,
  fork: 0.45,
  speed: 240,
};
/**
 * THE BANDS THE GROWTH IS ALLOWED IN, in the button's own coordinates.
 *
 * Left to itself a branching rule fills the plane, and this one had canes 50px
 * over the top of the page. Each run is given the room its own words leave:
 * the top row keeps clear of the page's top edge and of the stack, and drops
 * lower only out past the stack's right-hand end, where there is nothing
 * under it; each feeder keeps to its own word's gap.
 */
const STACK_RIGHT = 140;
const topBand = (x, y) => y > -MARGIN + 1 && y < 54 && x > BADGE.x + 2;
const feedBand = (b) => (x, y) => y > b.y - 15 && y < b.y + b.h + 4 && x > BADGE.x - 1;
const stemBand = (x, y) => y > BADGE.y + BADGE.size - 2 && x > -1 && x < STACK_RIGHT;
const rng = mulberry32(SEED);
/** A channel's waypoints, wobbled a little so nothing is mechanical. */
const wob = (a) => a * (rng() * 2 - 1);

const streams = [];
/**
 * The top run: out of the button, OVER the three words, dipping between them.
 * It clears the letters rather than crossing them — the words are the thing
 * being written, and a stroke through one strikes it out.
 */
const topWay = [{ x: EXIT_TOP.x, y: EXIT_TOP.y }, { x: EXIT_TOP.x + 8, y: EXIT_TOP.y - 5 }];
for (let i = 0; i < 3; i++) {
  const b = LAID[i];
  // OVER ONE WORD AND UNDER THE NEXT, crossing in the gaps where there is
  // nothing to cross. A run that stays on one side of the row can only ever
  // sprout into the strip left on that side; weaving gives it both, and the
  // crossings are in the gaps between the words, so nothing is struck out.
  const over = i % 2 === 0;
  const line = over ? b.y - 5 : b.y + b.h + 6;
  if (i > 0) topWay.push({ x: (LAID[i - 1].x + LAID[i - 1].w + b.x) / 2, y: ROW_MIDDLE + (over ? 7 : -1) + wob(2) });
  topWay.push({ x: b.x + b.w * 0.2, y: line + wob(0.8) });
  topWay.push({ x: b.x + b.w * 0.64, y: line + (over ? -1 : 1.5) + wob(1) });
}
const lastTop = LAID[2];
topWay.push({ x: lastTop.x + lastTop.w + 6, y: ROW_MIDDLE - 4 });
topWay.push({ x: lastTop.x + lastTop.w + 14, y: ROW_MIDDLE + 2 });
const topMain = channel({ pts: spline(topWay, GROWTH.step), w0: 1.5, w1: 0.7, t0: 0, speed: 1, id: 'top' });
topMain.dur = 0.92; // the top run sets the length of the whole growth
topMain.speed = topMain.len / topMain.dur;
streams.push(topMain);

/**
 * A COMPANION AT THE SOURCE. The trunk leaves the button's right-hand side;
 * this leaves the same corner a little lower, runs beside it and rejoins it
 * before the first word — the braid the owner asked for, said once at full
 * size where there is room for it, rather than as a second rail down the
 * whole row (which drew a lens round every word).
 */
const joinAt = topMain.len * 0.16;
const joinPt = atArc(topMain, joinAt);
const underWay = [
  { x: EXIT_TOP.x, y: EXIT_TOP.y + 1 },
  { x: EXIT_TOP.x + 10, y: EXIT_TOP.y + 8 + wob(1) },
  { x: (EXIT_TOP.x + joinPt.x) / 2, y: ROW_MIDDLE + 13 + wob(2) },
  { x: joinPt.x - 6, y: (ROW_MIDDLE + joinPt.y) / 2 + 3 },
  { x: joinPt.x, y: joinPt.y },
];
const topUnder = channel({ pts: spline(underWay, GROWTH.step), w0: 1.1, w1: 0.6, t0: 0.015, speed: 1, id: 'bypass' });
topUnder.dur = topMain.t0 + (joinAt / topMain.len) * topMain.dur - topUnder.t0;
topUnder.speed = topUnder.len / topUnder.dur;
streams.push(topUnder);



/**
 * The stack's stem, down the left. It crosses the words' left edges rather
 * than passing clear of them — the words start on the button's own left edge,
 * so there is no margin to run down, and the gif drew it the same way.
 */
const downWay = [{ x: EXIT_DOWN.x, y: EXIT_DOWN.y }, { x: EXIT_DOWN.x - 4, y: EXIT_DOWN.y + 8 }];
const feederAt = [];
for (let i = 3; i < 6; i++) {
  const b = LAID[i];
  const y = b.y - 3;
  downWay.push({ x: 5 + wob(2.5), y });
  feederAt.push({ i, y, at: downWay.length - 1 });
  downWay.push({ x: 7 + wob(2), y: b.y + b.h * 0.55 });
}
downWay.push({ x: 6, y: LAID[5].y + LAID[5].h + 7 });
const downMain = channel({ pts: spline(downWay, GROWTH.step), w0: 1.7, w1: 0.7, t0: 0.03, speed: 1, id: 'down' });
downMain.dur = 0.58;
downMain.speed = downMain.len / downMain.dur;
streams.push(downMain);

/**
 * A feeder for each stacked word: along its top, left to right, writing it.
 * It WEAVES — a straight one reads as a rule underlining the word above it,
 * which is what the first bake drew.
 */
const feeders = [];
for (const { i, y } of feederAt) {
  const b = LAID[i];
  // where the stem is at that height, so the feeder leaves it rather than the air
  let sArc = 0;
  for (let s = 0; s < downMain.len; s += 0.5) {
    if (atArc(downMain, s).y >= y) { sArc = s; break; }
  }
  const from = atArc(downMain, sArc);
  const way = [{ x: from.x, y: from.y }];
  for (let j = 1; j <= 4; j++) {
    const t = j / 4;
    way.push({ x: b.x + b.w * (t * 0.95), y: y - 2 + Math.sin(j * 1.7 + i) * 1.8 + wob(0.7) });
  }
  way.push({ x: b.x + b.w + 6, y: y - 3 + wob(1) });
  const c = channel({ pts: spline(way, GROWTH.step), w0: 1.05, w1: 0.45, t0: downMain.t0 + (sArc / downMain.len) * downMain.dur, speed: 1, id: `feed${i}` });
  c.dur = 0.3;
  c.speed = c.len / c.dur;
  streams.push(c);
  feeders[i] = c;
}

/**
 * ...and everything that comes off them, each inside its own band.
 *
 * THE WORDS ARE NOT A WALL. They were, and the row grew a fringe on one side
 * only, because everything sent toward them was cut off at the box. A channel
 * may cross a word: what stops it striking the word out is that its WIDTH is
 * suppressed where a glyph is (`GLYPH` below), so it thins to nothing over a
 * letter and threads through the gaps. The bands keep the growth on the canvas
 * and off the button, which is all a band is for.
 */
sprout(topMain, { ...GROWTH, bias: 0.72, inside: topBand }, rng, streams);
sprout(topUnder, { ...GROWTH, gap0: 24, gap1: 10, bias: 0.62, inside: topBand }, rng, streams);
sprout(downMain, { ...GROWTH, gap0: 15, gap1: 9, lens: [14, 9, 6], bias: 0.5, inside: stemBand }, rng, streams);
for (let i = 3; i < 6; i++) {
  sprout(feeders[i], { ...GROWTH, gap0: 16, gap1: 7, lens: [13, 8, 5], twig: 0.55, bias: 0.3, inside: feedBand(LAID[i]) }, rng, streams);
}
streams.push(...linkTips(streams, { near: 11, chance: 0.6, maxLinks: 10, align: 0.8, step: GROWTH.step, speed: GROWTH.speed }, rng));
const lastEnd = Math.max(...streams.map((c) => c.t0 + c.dur));
if (lastEnd > 1) for (const c of streams) { c.t0 /= lastEnd; c.dur /= lastEnd; }
console.log(`  the network: ${streams.length} channels, ${Math.round(streams.reduce((s, c) => s + c.len, 0))}px of run, last tip at t=${Math.min(1, lastEnd).toFixed(2)}`);

// ---- the canvas, sized to what has to be drawn -----------------------------
let gx0 = 1e9, gy0 = 1e9, gx1 = -1, gy1 = -1;
for (const c of streams) for (const p of c.pts) {
  const m = Math.max(c.w0, c.w1) / 2 + 0.5;
  gx0 = Math.min(gx0, p.x - m); gx1 = Math.max(gx1, p.x + m);
  gy0 = Math.min(gy0, p.y - m); gy1 = Math.max(gy1, p.y + m);
}
/**
 * HOW FAR ABOVE THE BUTTON THE CANVAS STARTS. The growth reaches over the top
 * row, so the canvas is given that room and placed higher up the page by the
 * same amount — the button still lands on the page's 10,10. It may not ask for
 * more than the margin itself: above that is off the page.
 */
const SHIFT = Math.min(MARGIN, Math.max(0, Math.ceil(-gy0) + 1));
if (-gy0 > MARGIN) console.log(`  note: the growth reaches ${(-gy0).toFixed(1)}px above the button and the page's margin is ${MARGIN}; the top is clipped`);
// from here on everything is in the CANVAS's coordinates: the channels were
// laid out from the button's corner, and the canvas starts above it
for (const c of streams) for (const p of c.pts) p.y += SHIFT;
const VIEW_W = Math.ceil(Math.max(gx1, ...LAID.map((b) => b.x + b.w)) + SLACK);
const VIEW_H = Math.ceil(Math.max(gy1, ...LAID.map((b) => b.y + b.h)) + SHIFT + SLACK);
const RW = VIEW_W * SS;
const RH = VIEW_H * SS;
console.log(`  canvas ${VIEW_W}x${VIEW_H} page px; the button sits at 0,${SHIFT} inside it and lands on the page's ${MARGIN},${MARGIN}`);

/**
 * GROW_DEBUG=1 draws the finished network on its own, one colour per kind of
 * channel, and stops. The whole of it at once is the only way to judge the
 * shape: a frame shows what has grown so far, which is not the same thing.
 */
if (process.env.GROW_DEBUG) {
  const COL = { trunk: [0, 0, 0], bypass: [220, 0, 0], twig: [0, 130, 0], branch: [0, 60, 220], fork: [190, 0, 190], link: [220, 140, 0] };
  const rgb = Buffer.alloc(RW * RH * 3, 255);
  const counts = {};
  for (const c of streams) {
    const kind = COL[c.id] ? c.id : 'trunk';
    counts[kind] = (counts[kind] ?? 0) + 1;
    const layer = new Ink(RW, RH, SS);
    layer.stroke(c, c.len);
    for (let i = 0; i < RW * RH; i++) {
      const a = layer.a[i];
      if (a <= 0) continue;
      for (let ch = 0; ch < 3; ch++) rgb[i * 3 + ch] = Math.round(rgb[i * 3 + ch] * (1 - a) + COL[kind][ch] * a);
    }
  }
  await sharp(rgb, { raw: { width: RW, height: RH, channels: 3 } }).png().toFile('.tmp/network.png');
  console.log(`  GROW_DEBUG: wrote .tmp/network.png — ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  process.exit(0);
}

// ---- the words as fields, one per word, ready to be written -----------------
/** The whole of the words, as coverage at device resolution. */
const wordsField = new Float32Array(RW * RH);
for (const d of drawn) {
  for (let y = 0; y < d.h; y++) {
    const Y = d.top + y + SHIFT * SS;
    if (Y < 0 || Y >= RH) continue;
    for (let x = 0; x < d.w; x++) {
      const X = d.left + x;
      if (X < 0 || X >= RW) continue;
      const o = (y * d.w + x) * 3;
      const lo = Math.min(d.rgb[o], d.rgb[o + 1], d.rgb[o + 2]);
      const a = (255 - lo) / 255;
      if (a > wordsField[Y * RW + X]) wordsField[Y * RW + X] = a;
    }
  }
}
/** Each word cut out of it, with the box it stands in (canvas coordinates). */
const BOXES = LAID.map((b, i) => ({ ...ITEMS[i], ...b, y: r2(b.y + SHIFT) }));
const WORD = BOXES.map((b) => {
  const x0 = Math.max(0, Math.floor((b.x - 2) * SS)), y0 = Math.max(0, Math.floor((b.y - 2) * SS));
  const x1 = Math.min(RW, Math.ceil((b.x + b.w + 2) * SS)), y1 = Math.min(RH, Math.ceil((b.y + b.h + 2) * SS));
  const w = x1 - x0, h = y1 - y0;
  const f = new Float32Array(w * h);
  let ink = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = wordsField[(y0 + y) * RW + x0 + x];
    f[y * w + x] = v;
    ink += v;
  }
  if (ink < 50) fail(`the word "${b.id}" came out of the last frame empty`);
  return { x0, y0, w, h, f, ink };
});
{
  // nothing of the last frame may be left outside the six boxes
  let stray = 0;
  const inAny = (X, Y) => WORD.some((w) => X >= w.x0 && X < w.x0 + w.w && Y >= w.y0 && Y < w.y0 + w.h);
  for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
    if (wordsField[Y * RW + X] > 0.25 && !inAny(X, Y)) stray++;
  }
  if (stray > 40) fail(`${stray} device px of the last frame fall outside the six words' boxes`);
  console.log(`  the words: ${WORD.map((w, i) => `${BOXES[i].id} ${Math.round(w.ink)}`).join(', ')} (${stray} px stray)`);
}

// ---- the mark, and how it drains -------------------------------------------
const ASPECT = await markAspect();
const MARK_W = BADGE.size - BADGE_RULE * 2 - MARK_SIDE_AIR * 2;
const MARK_H = MARK_W / ASPECT;
const MW = Math.round(MARK_W * SS), MH = Math.round(MARK_H * SS);
const MX = Math.round((BADGE.x + BADGE.size / 2) * SS - MW / 2);
const MY = Math.round((BADGE.y + BADGE.size - BADGE_RULE + SHIFT) * SS) - MH;
const mark = await badgeMark(MW, MH, BADGE_RULE * SS);
console.log(`  the mark: ${MARK_W}x${MARK_H.toFixed(2)} page px at ${MX / SS},${(MY / SS).toFixed(2)} (${MW}x${MH} device)`);

/**
 * WHAT IS LEFT WHEN IT HAS DRAINED — the traces.
 *
 * The silhouette's own edge, a vein or two down the inside of it, and the tipi
 * with its white rule. The veins are grown by the same machinery as the
 * network outside, seeded at the exits, so what is left in the mark is of a
 * piece with what flowed out of it.
 */
const CONTOUR = 1.1 * SS * 0.5; // half a page px of line
const keep = new Float32Array(MW * MH);
{
  const solid = new Uint8Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) solid[i] = mark.body[i] > 0.5 ? 1 : 0;
  const outside = new Uint8Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) outside[i] = solid[i] ? 0 : 1;
  // THE FRAME'S OWN EDGE COUNTS AS THE OUTSIDE. The mountain is a full-bleed
  // picture: it reaches the foot of its box and both sides at the bottom, and
  // a distance transform that only sees this buffer thinks those rows are deep
  // inside the shape — so the drained mark lost its base and stood on nothing.
  for (let x = 0; x < MW; x++) { outside[x] = 1; outside[(MH - 1) * MW + x] = 1; }
  for (let y = 0; y < MH; y++) { outside[y * MW] = 1; outside[y * MW + MW - 1] = 1; }
  for (let i = 0; i < MW * MH; i++) if (solid[i] && !(i < MW || i >= (MH - 1) * MW || i % MW === 0 || i % MW === MW - 1)) outside[i] = 0;
  const dEdge = distanceTo(outside, MW, MH); // distance to the nearest non-ink
  for (let i = 0; i < MW * MH; i++) if (solid[i] && dEdge[i] <= CONTOUR + 1) {
    keep[i] = Math.min(1, CONTOUR + 1.2 - dEdge[i]);
  }
  // the veins: two short runs up from the exits, with their own twigs
  const vrng = mulberry32(SEED + 7);
  const inMark = (p) => ({ x: p.x * SS - MX, y: p.y * SS - MY }); // page -> mark device
  const vTop = inMark({ x: BADGE.size - BADGE_RULE - MARK_SIDE_AIR, y: ROW_MIDDLE + SHIFT });
  const vDown = inMark({ x: BADGE.x + BADGE.size / 2, y: BADGE.y + BADGE.size - BADGE_RULE + SHIFT });
  const peak = { x: MW * 0.5, y: MH * 0.28 };
  const veins = [];
  for (const start of [vTop, vDown]) {
    const way = [
      { x: start.x, y: start.y },
      { x: (start.x + peak.x) / 2 + (vrng() * 2 - 1) * MW * 0.06, y: (start.y + peak.y) / 2 },
      { x: peak.x + (vrng() * 2 - 1) * MW * 0.05, y: peak.y + MH * 0.12 },
    ];
    veins.push(channel({ pts: spline(way, 0.5), w0: 1.5, w1: 0.9, t0: 0, speed: 1 }));
  }
  const vInk = new Ink(MW, MH, 1);
  for (const v of veins) {
    vInk.stroke(v, v.len, { scale: 1 });
    // one twig off each, ending in a curl: the seal's own language, at this size
    const at = atArc(v, v.len * 0.55);
    const side = vrng() < 0.5 ? 1 : -1;
    const dir = at.dir + side * 0.8;
    const tip = { x: at.x + Math.cos(dir) * MW * 0.16, y: at.y + Math.sin(dir) * MW * 0.16 };
    const pts = spline([{ x: at.x, y: at.y }, tip], 0.5);
    pts.push(...curl(tip, dir, MW * 0.07, 0.8, side, 0.5));
    vInk.stroke(channel({ pts, w0: 1.1, w1: 0.7, t0: 0, speed: 1 }), 1e9, { scale: 1 });
  }
  for (let i = 0; i < MW * MH; i++) {
    const v = Math.min(vInk.a[i], mark.body[i]);
    if (v > keep[i]) keep[i] = v;
    // the tipi stays: it is the mark's one detail, and its white rule needs
    // something to be a rule against
    if (mark.tipi[i] > keep[i]) keep[i] = mark.tipi[i];
  }
}
/**
 * HOW FAR THROUGH THE MOUNTAIN EACH PIXEL IS FROM THE TWO EXITS, 0..1 — the
 * order it drains in. Measured through the ink, so the mark empties from the
 * places the network leaves by rather than from the top or one side.
 *
 * THIN INK HOLDS ON LONGEST (the capillary term): a pixel's cost is reduced by
 * how deep inside the shape it is, so the edge of the silhouette is the last
 * thing to go and the mark keeps its outline as it empties, the way a wet
 * surface keeps its rim.
 */
const PHI = (() => {
  const INF = 1e18;
  const d = new Float64Array(MW * MH).fill(INF);
  const solid = (i) => mark.ink[i] > 0.3;
  const depth = (() => {
    const out = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) out[i] = solid(i) ? 0 : 1;
    return distanceTo(out, MW, MH);
  })();
  const seeds = [];
  for (const p of [{ x: BADGE.size, y: ROW_MIDDLE + SHIFT }, { x: BADGE.x + BADGE.size / 2, y: BADGE.y + BADGE.size + SHIFT }]) {
    const px = p.x * SS - MX, py = p.y * SS - MY;
    let best = -1, bestD = INF;
    for (let i = 0; i < MW * MH; i++) {
      if (!solid(i)) continue;
      const x = i % MW, y = (i / MW) | 0;
      const dd = (x - px) ** 2 + (y - py) ** 2;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (best >= 0) seeds.push(best);
  }
  if (seeds.length !== 2) fail('the mark has no ink at one of the two exits');
  // Dijkstra through the ink, 8-connected, cheapest-first
  const q = [...seeds];
  for (const s of seeds) d[s] = 0;
  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const x = i % MW, y = (i / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx;
      if (!solid(j)) continue;
      const step = (dx && dy ? Math.SQRT2 : 1) * (1 - 0.45 * Math.exp(-depth[j] / (2.2 * SS)));
      const nd = d[i] + step;
      if (nd < d[j] - 1e-9) { d[j] = nd; q.push(j); }
    }
  }
  let max = 0;
  for (let i = 0; i < MW * MH; i++) if (d[i] < INF && d[i] > max) max = d[i];
  const phi = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) phi[i] = d[i] >= INF ? 1 : d[i] / max;
  return phi;
})();

// ---- baking -----------------------------------------------------------------
rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

/**
 * THE RUN IS AS LONG AS THE GIF'S OWN WAS, and at its pace: the gif's frames
 * from the one before the first thing grew, to its last. Nothing of the gif's
 * animation is drawn any more, but the owner's sense of how long this menu
 * takes came from it — and `PLAY_RATE` in LogoMenu is tuned against it (the
 * grow menu runs at 0.8, their "20% slower").
 */
const FRAMES = N - START;
/** How much of it is growth; over the rest the ink leaves and the words stay. */
const GROW = 0.8;
/** The drain's soft edge, in units of PHI. */
const DRAIN_SOFT = 0.08;

/**
 * HOW MUCH WIDTH A GLYPH TAKES OFF A STROKE OVER IT: the word plate, blurred,
 * so a channel thins as it approaches a letter and is gone over it. This is
 * what makes the growth WRITE the words rather than score them through, and it
 * is what lets the growth cross the row at all — there is no room either side
 * of these words to go round.
 */
const GLYPH = (() => {
  const R = Math.round(1.2 * SS); // a page px and a bit, in device px
  const tmp = new Float32Array(RW * RH);
  const out = new Float32Array(RW * RH);
  for (let y = 0; y < RH; y++) { // separable box blur
    let acc = 0;
    for (let x = -R; x <= R; x++) acc += wordsField[y * RW + Math.min(RW - 1, Math.max(0, x))];
    for (let x = 0; x < RW; x++) {
      tmp[y * RW + x] = acc / (2 * R + 1);
      acc += wordsField[y * RW + Math.min(RW - 1, x + R + 1)] - wordsField[y * RW + Math.max(0, x - R)];
    }
  }
  for (let x = 0; x < RW; x++) {
    let acc = 0;
    for (let y = -R; y <= R; y++) acc += tmp[Math.min(RH - 1, Math.max(0, y)) * RW + x];
    for (let y = 0; y < RH; y++) {
      out[y * RW + x] = Math.min(1, (acc / (2 * R + 1)) * 2.6);
      acc += tmp[Math.min(RH - 1, y + R + 1) * RW + x] - tmp[Math.max(0, y - R) * RW + x];
    }
  }
  return out;
})();
const glyphAt = (x, y) => {
  const X = Math.round(x * SS), Y = Math.round(y * SS);
  return X < 0 || Y < 0 || X >= RW || Y >= RH ? 0 : GLYPH[Y * RW + X];
};

/**
 * THE INK LEAVES BY THINNING, NOT BY BEING CUT BACK. Over the last stretch
 * every point of the network loses width, latest arrival first, so a stroke
 * goes hairline and then goes — the seal's "black leaves traces in the white",
 * in the same arithmetic the mark drains by. Retracting the fronts instead
 * reads as a film run backwards.
 */
const E_KILL = 2.8; // device px taken off a half-width by the end
const E_RAMP = 0.22; // over this much of the recede

/** The writing front of each word: the channel that passes it, and how far. */
const WRITER = BOXES.map((b, i) => (i < 3 ? topMain : feeders[i]));
const revealed = new Array(6).fill(-1e9);
/** How much of the writer's run a letter takes to come up, in page px of arc. */
const WRITE_SOAK = 7;

/**
 * WHEN EACH PIXEL OF A WORD IS WRITTEN, as a distance along its writer's own
 * run. Not a column wipe: a pixel's turn comes when the front has passed the
 * point on the channel NEAREST it, plus a little for how far off the channel
 * it sits, plus a little noise — so a letter comes up out of the stroke that
 * is passing it, with a ragged wet edge rather than a ruled one. The noise is
 * spatial, never of time, so the edge cannot shimmer as it crosses.
 */
for (let i = 0; i < 6; i++) {
  const c = WRITER[i];
  const w = WORD[i];
  const step = 4; // every 4th polyline vertex: they are half a page px apart
  const T = new Float32Array(w.w * w.h);
  let T0 = Infinity;
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      const px = (w.x0 + x + 0.5) / SS, py = (w.y0 + y + 0.5) / SS;
      let bestD = Infinity, bestS = 0;
      for (let k = 0; k < c.pts.length; k += step) {
        const d = (c.pts[k].x - px) ** 2 + (c.pts[k].y - py) ** 2;
        if (d < bestD) { bestD = d; bestS = c.cum[k]; }
      }
      const t = bestS + 0.9 * Math.sqrt(bestD) + 1.8 * vn2(px / 9, py / 9, SEED + i) + 0.9 * vn2(px / 3.5, py / 3.5, SEED + 90 + i);
      T[y * w.w + x] = t;
      if (w.f[y * w.w + x] > 0.05 && t < T0) T0 = t;
    }
  }
  w.T = T;
  w.T0 = T0;
}

const ink = new Ink(RW, RH, SS);
let total = 0;
for (let f = 0; f < FRAMES; f++) {
  const u = FRAMES === 1 ? 1 : f / (FRAMES - 1);
  const grown = Math.min(1, easeInOut(Math.min(1, u / GROW)));
  const back = u <= GROW ? 0 : easeIn((u - GROW) / (1 - GROW));
  // the mark holds what the network has not taken, and takes it back as the
  // network gives it up
  const clock = grown * (1 - back);
  const erode = (arrival) => (back <= 0 ? 0 : E_KILL * smoothstep(0, E_RAMP, back - (1 - arrival) * (1 - E_RAMP)));
  ink.clear();

  // the network
  for (const c of streams) {
    const s = frontArc(c, grown);
    if (s <= 0) continue;
    ink.stroke(c, s, { erode, gmask: glyphAt });
    if (s < c.len && back <= 0) {
      const tip = atArc(c, s);
      ink.bead(tip.x, tip.y, widthAt(c, s) * 0.62 * (1 - glyphAt(tip.x, tip.y)));
    }
  }

  // the mark, draining
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      const a = mark.ink[i];
      if (a <= 0) continue;
      const gone = smoothstep(clock - DRAIN_SOFT, clock, PHI[i]); // 0 where drained
      const v = a * Math.max(gone, keep[i]);
      if (v <= 0) continue;
      const X = MX + x, Y = MY + y;
      if (X < 0 || Y < 0 || X >= RW || Y >= RH) continue;
      const o = Y * RW + X;
      if (v > ink.a[o]) ink.a[o] = v > 1 ? 1 : v;
    }
  }

  // the words, written up to wherever the front that writes them has reached
  for (let i = 0; i < 6; i++) {
    // PAST THE END OF THE RUN THE FRONT KEEPS GOING, at the same pace: a
    // pixel's turn is its distance ALONG the channel plus its distance OFF it,
    // so the last letters are reached after the front itself has stopped.
    const c = WRITER[i];
    const over = grown - (c.t0 + c.dur);
    const s = over > 0 ? c.len + over * (c.len / c.dur) : frontArc(c, grown);
    if (s > revealed[i]) revealed[i] = s; // only ever forward: nothing un-writes
    const front = revealed[i];
    const w = WORD[i];
    if (front <= w.T0) continue;
    for (let y = 0; y < w.h; y++) {
      const Y = w.y0 + y;
      for (let x = 0; x < w.w; x++) {
        const v = w.f[y * w.w + x];
        if (v <= 0) continue;
        const g = smoothstep(0, WRITE_SOAK, front - w.T[y * w.w + x]);
        if (g <= 0) continue;
        const o = Y * RW + w.x0 + x;
        const c2 = v * g;
        if (c2 > ink.a[o]) ink.a[o] = c2;
      }
    }
  }

  const webp = await sharp(ink.rgba(), { raw: { width: RW, height: RH, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(f).padStart(3, '0')}.webp`, webp);
  total += webp.length;
  if (f === 0) {
    /**
     * AT REST THE BUTTON IS THE MARK AND NOTHING ELSE, and the page shows it
     * from `badge.webp` — the same pixels, cut out of this very frame, so the
     * handover from the page's copy to the canvas's is invisible. This repo
     * has paid twice for a vector and a raster of one mark not coinciding (the
     * 遠東 logo "changed opacity when you hovered it"); cutting the still out
     * of frame 0 is what makes that impossible here.
     */
    let out = 0;
    for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
      if (ink.a[Y * RW + X] > 0.04 && !(X >= MX && X < MX + MW && Y >= MY && Y < MY + MH)) out++;
    }
    if (out) fail(`the first frame draws ${out} device px outside the mark; at rest the canvas is the mark alone`);
    const still = Buffer.alloc(MW * MH * 4);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      still[(y * MW + x) * 4 + 3] = Math.round(Math.min(1, ink.a[(MY + y) * RW + MX + x]) * 255);
    }
    writeFileSync('public/growmenu/badge.webp', await sharp(still, { raw: { width: MW, height: MH, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer());
  }
  if (f === FRAMES - 1) {
    // the open state must be the six words and the mark, and nothing else
    let loose = 0;
    const inWord = (X, Y) => WORD.some((w) => X >= w.x0 && X < w.x0 + w.w && Y >= w.y0 && Y < w.y0 + w.h);
    const inMarkBox = (X, Y) => X >= MX - SS && X < MX + MW + SS && Y >= MY - SS && Y < MY + MH + SS;
    for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
      if (ink.a[Y * RW + X] > 0.12 && !inWord(X, Y) && !inMarkBox(X, Y)) loose++;
    }
    if (loose > 60) fail(`the last frame still carries ${loose} device px of growth outside the words`);
    console.log(`  the last frame: the words and the mark, ${loose} px of growth left over`);
  }
}
console.log(`wrote ${FRAMES} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB, ${Math.round(total / FRAMES / 1024)}KB each)`);

console.log('  the menu:');
console.log(`    button ${BADGE.x},${SHIFT} ${BADGE.size}x${BADGE.size}`);
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
      // WHERE THE BUTTON GOES, not the canvas's corner: the canvas starts
      // above and left of it by `logoHit`, and that offset is in MENU px, so
      // it shrinks with the zoom while the page's margin must not. The
      // stylesheet takes it off (`--logo-menu-ox/oy`).
      place: { left: MARGIN, top: MARGIN },
      logoHit: { x: BADGE.x, y: SHIFT, w: BADGE.size, h: BADGE.size },
      badge: {
        rule: BADGE_RULE,
        // the mark as the page draws it at rest, in the canvas's coordinates
        mark: { src: '/growmenu/badge.webp', x: +(MX / SS).toFixed(2), y: +(MY / SS).toFixed(2), w: MARK_W, h: +MARK_H.toFixed(2) },
      },
      boxes: BOXES,
      stops: { base: { frames: FRAMES, viewW: VIEW_W, boxes: BOXES.map((b) => b.id) } },
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
