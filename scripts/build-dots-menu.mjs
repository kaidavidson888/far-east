/**
 * Bakes the DOTS menu — the three words that used to hang under the mountain.
 *
 *   npm run build:dotsmenu
 *
 * The owner's 2026-09-20 ask: a button mirrored from the magnifying glass,
 * carrying their three spirals; "on press the dots will turn 90 degrees so
 * they are horizontal then grow into the saved, offers and recommended buttons
 * currently attached to the mountain button's animation. I want you to remove
 * these buttons from the mountain button's animation, shorten my saved to just
 * saved and make sure the letters have the same margins as the letters in
 * offers and recommended. use the same branching animation but have them grow
 * from the outline around the dots freezing when the words are fully revealed
 * the branches are at their apex. the words should be aligned on the left like
 * they currently are but rescaled to be the width of two rows in the tag menu
 * that gets opened by the + button. keep the same margins otherwise."
 *
 * So this is the grow menu's machinery pointed at the other three words:
 *   - the WORDS are still the owner's drawing, cut from monkey-grow.gif's last
 *     frame by the shared front end (scripts/lib/menu-gif.mjs);
 *   - the INK is generated (scripts/lib/ink-growth.mjs), the same braiding,
 *     sprouting, curling channels, writing each word as its front passes;
 *   - and it FREEZES at the apex. The mountain's run thins its ink away over
 *     the last fifth and leaves the words standing; this one stops with every
 *     branch at full reach, which is what "freezing when the words are fully
 *     revealed the branches are at their apex" asks for. It comes back only by
 *     being run backwards — the button again, or another menu opening.
 *
 * WHERE THE WORDS GO. They hang to the LEFT of the button (the owner's
 * second ask of the day: "have the word buttons grow from the left side of
 * the button not the right"), left-aligned with one another as they were
 * under the mountain, their block centred on the button's middle line. To
 * the side rather than above or below, because the button stands on the
 * row's own controls line: the red frame is close above it and the plus's
 * line close below, and three lines of type fit in neither.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';
import { openMenuGif } from './lib/menu-gif.mjs';
import { CIG_CONTROLS_JSON } from './lib/controls.mjs';
import {
  mulberry32, spline, channel, atArc, frontArc, widthAt, sprout, linkTips, translate, Ink, smoothstep, easeInOut, vn2,
} from './lib/ink-growth.mjs';

const FRAMES_DIR = 'public/dotsmenu/frames';
const GEOMETRY = 'lib/dotsmenu-geometry.json';

/** Backing-store scale: 2 is what a dense screen wants. */
const SS = 2;
/** Room past the outermost ink, so the frame never stops dead on a stroke. */
const SLACK = 6;
const SEED = 20260920;

/** The button is the plus's box, like the glass's: 30 square, a 2px rule. */
const { width: BTN_W, height: BTN, gap: GAP } = CIG_CONTROLS_JSON;
const BOXW = BTN;

/**
 * THE WORDS ARE AS WIDE AS TWO TAG BUTTONS AND THE GAP BETWEEN THEM — the
 * owner's "rescaled to be the width of two rows in the tag menu that gets
 * opened by the + button", which is what a heading in that grid spans.
 */
const BLOCK_W = BTN_W * 2 + GAP;
/**
 * THE BLOCK STANDS ONE GAP TO THE LEFT OF THE BUTTON — the owner's
 * 2026-09-20 "have the word buttons grow from the left side of the button not
 * the right". One gap, as everything on this row stands off its neighbour;
 * the button's own left edge is x=0, so the block runs from -(gap + its
 * width) to -gap, and the widest word — RECOMMENDED, which is what sets the
 * width — is the one that ends on that gap.
 */
const BLOCK_X = -(GAP + BLOCK_W);

/** What the three words are, in the order the gif drew them down the page. */
const DOTS_ITEMS = [
  { id: 'saved', label: 'Saved', part: 'saved' },
  { id: 'offers', label: 'Offers', inert: true },
  { id: 'recommended', label: 'Recommended', inert: true },
];

/** How the channels sprout — the grow menu's rule, at this menu's size. */
const GROWTH = {
  step: 0.5,
  start0: 0.05,
  gap0: 18, gap1: 8,
  angle: 0.45,
  lens: [16, 10, 6],
  minLen: 4,
  maxDepth: 3,
  bypass: 0.26, bypassLen: 20, bow: 4,
  twig: 0.44, twigLen: 10, curl: 3,
  fork: 0.45,
  speed: 240,
};

/**
 * The run, at the gif's own pace: three words rather than the mountain's —
 * and then the reach winding back in.
 *
 * THE BRANCH THAT CONNECTS TO THE OUTLINE RETRACTS ONCE THE WORDS ARE GROWN
 * (the owner's 2026-09-20 ask: "have the branch that connects to the outline
 * retract after the words are fully grown but leave the other branches
 * connected to the words and the one on the left until the 3 dots button is
 * pressed again"). So the run has two phases: the growth, which ends at the
 * apex exactly as before, and then the REACH and everything hanging off it
 * withdrawing back into the button, leaving the spine down the left, the
 * three feeders and the words standing. That last frame is the resting
 * state, and only running the whole thing backwards takes it away.
 */
const GROW_FRAMES = 100;
const PULL_FRAMES = 24;
const FRAMES = GROW_FRAMES + PULL_FRAMES;
/** How much of a letter's own run it takes to come up, in page px of arc. */
const WRITE_SOAK = 7;

const fail = (msg) => {
  throw new Error(`build-dots-menu: ${msg}`);
};

const gif = await openMenuGif('build-dots-menu', { ss: SS });
const { frameMs, K, stackWords, glyphMask, lineBands, renderPiece } = gif;

// ---- SAVED, out of MY SAVED -------------------------------------------------
/*
 * The gif drew "MY SAVED" as one run and the owner wants only the second word.
 * The cut is the widest empty column INSIDE the word — the same measurement
 * the grow menu uses to find the space in "about us" — so it is the space the
 * owner drew rather than a guess, and what is kept starts at the S.
 */
const savedCut = (() => {
  const G = glyphMask(stackWords[0]);
  const [a, b] = lineBands(G, 1)[0];
  const cols = [];
  for (let x = 0; x < G.w; x++) {
    let n = 0;
    for (let y = a; y < b; y++) n += G.m[y * G.w + x];
    cols.push(n);
  }
  const first = cols.findIndex((n) => n > 0);
  const lastc = cols.length - 1 - [...cols].reverse().findIndex((n) => n > 0);
  let best = { at: -1, run: 0 }, run = 0;
  for (let x = first; x <= lastc; x++) {
    if (cols[x] === 0) { run++; if (run > best.run) best = { at: x - run + 1, run }; }
    else run = 0;
  }
  if (best.run < 4) fail(`no word space found inside "MY SAVED" (widest gap ${best.run} gif px)`);
  // the first ink after the space, in gif px, then in page px
  let s = best.at + best.run;
  while (s < G.w && !cols[s]) s++;
  const cutGif = G.gx0 + s;
  console.log(`  "MY SAVED": the space is ${best.run} gif px at ${G.gx0 + best.at}; kept from ${cutGif} ("SAVED")`);
  return gif.pageX(cutGif) - 0.5;
})();

/** Each word as it was drawn: its ink box in page px, SAVED shortened. */
const drawnWords = stackWords.map((b, i) => (i === 0 ? { ...b, x0: savedCut } : b));

/**
 * THE THREE ARE SET AT ONE SIZE — the owner's "make sure the letters have the
 * same margins as the letters in offers and recommended".
 *
 * The gif drew MY SAVED a third taller than the other two (17px against 12 and
 * 13), which read as a heading over them while it still said "MY SAVED"; cut
 * down to one word and stood beside them it is just a different size of type.
 * Each word is scaled to the X-HEIGHT the other two share — the same measure
 * the top row is matched on, because it is the one a drawing and a typeface
 * both have — and then all three together to the block's width. So the letters
 * are one size on one left edge, and the widest word sets the block.
 */
const xHeights = drawnWords.map((b) => {
  const G = glyphMask(b);
  const [a, c] = lineBands(G, 1)[0];
  return (c - a) * K;
});
const TARGET_XH = (xHeights[1] + xHeights[2]) / 2;
const evenly = xHeights.map((h) => TARGET_XH / h);
console.log('  x-heights ' + xHeights.map((h) => h.toFixed(2)).join(' / ') + ' -> one at ' + TARGET_XH.toFixed(2) + ' (x' + evenly.map((k) => k.toFixed(3)).join(' / x') + ')');

// ---- the layout -------------------------------------------------------------
/*
 * One scale for all three, off the widest, so the block is BLOCK_W across and
 * the words keep the sizes the gif drew them at relative to one another. The
 * vertical gaps are the drawn ones, scaled by the same number — the owner's
 * "keep the same margins otherwise" — and every word's LEFT EDGE is the
 * block's, which is what "aligned on the left like they currently are" means
 * and what shortening MY SAVED would otherwise have broken.
 */
const widest = Math.max(...drawnWords.map((b, i) => (b.x1 - b.x0) * evenly[i]));
const SCALE = BLOCK_W / widest;
/** Each word's own scale: to the shared x-height, then to the block. */
const kOf = (i) => evenly[i] * SCALE;
/*
 * The gaps between them are the gif's own at the block's scale — "keep the
 * same margins otherwise" — taken between one word's foot and the next word's
 * top, so that re-sizing SAVED does not drag the other two up with it.
 */
const tops = [0];
for (let i = 1; i < 3; i++) {
  tops.push(
    tops[i - 1] +
      (drawnWords[i - 1].y1 - drawnWords[i - 1].y0) * kOf(i - 1) +
      (drawnWords[i].y0 - drawnWords[i - 1].y1) * SCALE,
  );
}
const blockH = tops[2] + (drawnWords[2].y1 - drawnWords[2].y0) * kOf(2);
/** The block is centred on the button's middle line. */
const BLOCK_Y = BOXW / 2 - blockH / 2;

const pieces = drawnWords.map((b, i) => ({
  name: DOTS_ITEMS[i].id,
  x0: b.x0, x1: b.x1,
  y0: b.y0, y1: b.y1,
  sx: kOf(i), sy: kOf(i),
  // placed by its own left edge and its own top, so all three are flush left
  newX0: BLOCK_X,
  refY: b.y0,
  newRefY: BLOCK_Y + tops[i],
}));
const LAID = pieces.map((p, i) => ({
  x: +(p.newX0).toFixed(1),
  y: +(p.newRefY).toFixed(1),
  w: +((p.x1 - p.x0) * kOf(i)).toFixed(1),
  h: +((p.y1 - p.y0) * kOf(i)).toFixed(1),
}));
console.log('  the block is x' + SCALE.toFixed(3) + " off its widest word to the tag menu's " + BLOCK_W + 'px:');
LAID.forEach((b, i) => console.log(`    ${DOTS_ITEMS[i].id.padEnd(12)} ${b.x},${b.y} ${b.w}x${b.h}`));

// ---- the network ------------------------------------------------------------
const rng = mulberry32(SEED);
const wob = (a) => a * (rng() * 2 - 1);
/*
 * TWO FAMILIES, BECAUSE ONE OF THEM LEAVES. Everything that hangs off the
 * reach goes back into the button with it at the end of the run; everything
 * on the spine and the feeders stays. They are kept apart from the moment
 * they are grown — including their joins, which are made WITHIN each family
 * and never across — because a link between the two would be left hanging in
 * the air the moment the reach withdrew.
 */
const goes = [];
const stays = [];

/**
 * THE INK LEAVES THE BUTTON'S LEFT-HAND SIDE, and it goes ROUND THE TOP of
 * the words before it writes them. Two channels make the trunk where there
 * was one:
 *
 *   REACH  out of the button's left edge at its middle, climbing over the top
 *          of the block and turning down at its far corner.
 *   SPINE  down that far edge past the three words, with a feeder going right
 *          along each one and writing it — the shape the stack had under the
 *          mountain, unchanged.
 *
 * ROUND, BECAUSE THE WORDS ARE LEFT-ALIGNED. The edge all three of them start
 * at is the one FURTHEST from the button; the near edge is where they END,
 * and it is ragged — SAVED and OFFERS stop 90px short of RECOMMENDED. A spine
 * hugging the button would have to throw that 90px as a bare diagonal across
 * nothing before either of their feeders reached a letter. Round the top,
 * every feeder meets its word in five pixels, each word is still written LEFT
 * TO RIGHT, and the three still arrive in reading order. (Mirroring the whole
 * picture instead would have written every word backwards, which reads as the
 * animation running in reverse.)
 */
const OVER = Math.min(...LAID.map((b) => b.y)) - 7;
const SPINE_X = BLOCK_X - 5;
const reachWay = [
  { x: 0, y: BOXW / 2 },
  { x: -9, y: BOXW / 2 - 5 + wob(1.5) },
  { x: -30, y: OVER + 14 + wob(2) },
  { x: -80, y: OVER + wob(1.5) },
  { x: BLOCK_X + BLOCK_W * 0.45, y: OVER + 1 + wob(1.5) },
  { x: SPINE_X + 10, y: OVER + 3 + wob(1) },
  { x: SPINE_X, y: OVER + 11 },
];
const reach = channel({ pts: spline(reachWay, GROWTH.step), w0: 1.9, w1: 1.5, t0: 0, speed: 1, id: 'reach' });
/*
 * The reach is a SHOOT: three times the spine's length in two thirds of its
 * time, so the wind-up before the first letter is a third of the run rather
 * than half of it. It is never bare — it sprouts the whole way, at the
 * network's own pace, which is what fills the space above the words.
 */
reach.dur = 0.26;
reach.speed = reach.len / reach.dur;
goes.push(reach);

const stemWay = [{ x: SPINE_X, y: OVER + 11 }];
const feedAt = [];
for (let i = 0; i < 3; i++) {
  const b = LAID[i];
  const y = b.y + b.h / 2;
  stemWay.push({ x: SPINE_X + wob(1.5), y });
  feedAt.push({ i, y });
}
stemWay.push({ x: BLOCK_X - 6, y: LAID[2].y + LAID[2].h + 6 });
const stem = channel({ pts: spline(stemWay, GROWTH.step), w0: 1.5, w1: 0.7, t0: reach.dur, speed: 1, id: 'stem' });
stem.dur = 0.4;
stem.speed = stem.len / stem.dur;
stays.push(stem);

const writers = [];
for (const { i, y } of feedAt) {
  const b = LAID[i];
  let sArc = 0;
  for (let s = 0; s < stem.len; s += 0.5) {
    if (atArc(stem, s).y >= y - 0.5) { sArc = s; break; }
  }
  const from = atArc(stem, sArc);
  const way = [{ x: from.x, y: from.y }];
  for (let j = 1; j <= 4; j++) {
    const t = j / 4;
    way.push({ x: b.x + b.w * (t * 0.95), y: b.y - 3 + Math.sin(j * 1.7 + i) * 1.8 + wob(0.7) });
  }
  way.push({ x: b.x + b.w + 6, y: b.y - 2 + wob(1) });
  const c = channel({
    pts: spline(way, GROWTH.step),
    w0: 1.15, w1: 0.5,
    t0: stem.t0 + (sArc / stem.len) * stem.dur,
    speed: 1,
    id: `feed${i}`,
  });
  c.dur = 0.34;
  c.speed = c.len / c.dur;
  stays.push(c);
  writers[i] = c;
}

/**
 * The bands: the growth stays beside its own words and off the button. It is
 * measured from the REACH as well as the words now — the reach runs above
 * them and needs room on both sides of itself, or every child of it that
 * pointed upward would be cut to a tick and dropped, and the whole top of
 * the picture would grow downward only.
 */
const top = Math.min(OVER, ...LAID.map((b) => b.y)) - 10;
const bottom = Math.max(...LAID.map((b) => b.y + b.h)) + 12;
const band = (x, y) => y > top && y < bottom && x < -1;
sprout(reach, { ...GROWTH, gap0: 16, gap1: 9, lens: [12, 8, 5], bias: 0.5, inside: band }, rng, goes);
sprout(stem, { ...GROWTH, gap0: 14, gap1: 8, lens: [12, 8, 5], bias: 0.5, inside: band }, rng, stays);
for (let i = 0; i < 3; i++) {
  sprout(writers[i], { ...GROWTH, twig: 0.5, bias: 0.35, inside: band }, rng, stays);
}
/*
 * THE JOINS TAKE THE BAND AS WELL. A link bows by a third of the gap it
 * crosses, so two tips sitting on the band's edge were joined by an arc
 * outside it — which is how the stem came to run 6px below everything else
 * and get sliced off square by the canvas edge.
 */
const JOIN = { near: 11, chance: 0.6, maxLinks: 10, align: 0.8, inside: band, step: GROWTH.step, speed: GROWTH.speed };
stays.push(...linkTips(stays, JOIN, rng));
goes.push(...linkTips(goes, JOIN, rng));
const streams = [...stays, ...goes];
const lastEnd = Math.max(...streams.map((c) => c.t0 + c.dur));
if (lastEnd > 1) for (const c of streams) { c.t0 /= lastEnd; c.dur /= lastEnd; }
/*
 * WHERE EACH LEAVING CHANNEL IS ROOTED, as a fraction of the reach's own run.
 * The withdrawal empties the reach from its tip back to the button, and a
 * child has to be gone by the time the front reaches the place it grew from —
 * so each one is given that place and empties into it. A child's BIRTH TIME
 * is exactly that place for anything growing straight off the reach (sprout
 * births it at parent.t0 + its arc fraction x parent.dur) and a little later
 * for a child of a child, which is right: a twig goes before the branch that
 * carries it.
 */
/**
 * NOTHING MAY VANISH IN A SINGLE FRAME, which is what a detach of 1 means.
 * The ratio is not bounded by the reach's own clock: a child of a child is
 * born at its parent's pace (GROWTH.speed) and the reach is a shoot, so three
 * of the thirty — two curled twigs and a link, 74px of run — are born after
 * the reach has finished and came out at 1.005 to 1.057. Clamped to 1 their
 * window was zero and they were switched off on the first pull frame: 149
 * device px going dark in 42ms, five times the next frame's, at the corner
 * where the reach hands over to the spine. They now have `PULL_MIN` of the
 * pull to empty in, which is the least a stroke can retract in and still be
 * seen to move.
 */
const PULL_MIN = 0.15;
for (const c of goes) {
  c.goes = true;
  c.detach = c === reach ? 0 : Math.max(0, Math.min(1 - PULL_MIN, (c.t0 - reach.t0) / reach.dur));
}
console.log(`  the network: ${streams.length} channels, ${Math.round(streams.reduce((s, c) => s + c.len, 0))}px of run`);
console.log(`    ${stays.length} stay when the words are written; ${goes.length} go back into the button with the reach`);

// ---- the canvas --------------------------------------------------------------
/*
 * THE BOX IS MEASURED OFF THE DRAWN NETWORK, not worked out from the
 * polylines and their taper. Estimated, it came out five pixels short at the
 * foot and the last frame had the stem and three branches sliced off square
 * along the bottom edge — a flat cut is the one thing that says "picture"
 * rather than "ink". The whole network is drawn once, at full length, into a
 * generously padded buffer, and the ink box read back out of it; everything
 * that decides how far a stroke reaches — the taper, the caps, the joins — is
 * then included by construction rather than by arithmetic that has to be kept
 * in step with the rasteriser.
 */
const [gx0, gy0, gx1, gy1] = await (async () => {
  const PAD = 24;
  let ax0 = 1e9, ay0 = 1e9, ax1 = -1e9, ay1 = -1e9;
  for (const c of streams) for (const p of c.pts) {
    ax0 = Math.min(ax0, p.x); ax1 = Math.max(ax1, p.x);
    ay0 = Math.min(ay0, p.y); ay1 = Math.max(ay1, p.y);
  }
  const ox = ax0 - PAD, oy = ay0 - PAD;
  const pw = Math.ceil(ax1 - ox + PAD) * SS, ph = Math.ceil(ay1 - oy + PAD) * SS;
  translate(streams, -ox, -oy);
  const probe = new Ink(pw, ph, SS);
  for (const c of streams) probe.stroke(c, c.len);
  translate(streams, ox, oy);
  let X0 = 1e9, Y0 = 1e9, X1 = -1, Y1 = -1;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    if (probe.a[y * pw + x] <= 0.02) continue;
    if (x < X0) X0 = x; if (x > X1) X1 = x;
    if (y < Y0) Y0 = y; if (y > Y1) Y1 = y;
  }
  if (X1 < 0) fail('the network drew nothing');
  if (process.env.DOTS_PROBE) {
    mkdirSync('.tmp', { recursive: true });
    await sharp(probe.rgba(), { raw: { width: pw, height: ph, channels: 4 } }).flatten({ background: '#ffffff' }).png().toFile('.tmp/dots-probe.png');
    console.log('  DOTS_PROBE: wrote .tmp/dots-probe.png');
  }
  if (X0 === 0 || Y0 === 0 || X1 === pw - 1 || Y1 === ph - 1)
    fail(
      `the probe buffer (${pw}x${ph}) was too small: the points run ${ax0.toFixed(1)},${ay0.toFixed(1)} to ` +
        `${ax1.toFixed(1)},${ay1.toFixed(1)} and the ink ${(X0 / SS + ox).toFixed(1)},${(Y0 / SS + oy).toFixed(1)} to ` +
        `${(X1 / SS + ox).toFixed(1)},${(Y1 / SS + oy).toFixed(1)}`,
    );
  return [X0 / SS + ox, Y0 / SS + oy, (X1 + 1) / SS + ox, (Y1 + 1) / SS + oy];
})();
/**
 * How far above and to the LEFT of the button the canvas starts: the words
 * hang off it on both counts, so the button is no longer in its corner.
 * `logoHit` is what says where it is, and the page places the canvas from it.
 */
const SHIFT = Math.ceil(Math.max(0, -Math.min(gy0, ...LAID.map((b) => b.y)))) + SLACK;
const OX = Math.ceil(Math.max(0, -Math.min(gx0, ...LAID.map((b) => b.x)))) + SLACK;
const VIEW_W = Math.ceil(Math.max(gx1, ...LAID.map((b) => b.x + b.w), BOXW) + OX + SLACK);
const VIEW_H = Math.ceil(Math.max(gy1, ...LAID.map((b) => b.y + b.h), BOXW) + SHIFT + SLACK);
const RW = VIEW_W * SS, RH = VIEW_H * SS;
translate(streams, OX, SHIFT);
console.log(`  canvas ${VIEW_W}x${VIEW_H} page px; the button sits at ${OX},${SHIFT} inside it`);

if (process.env.DOTS_DEBUG) {
  mkdirSync('.tmp', { recursive: true });
  const dbg = new Ink(RW, RH, SS);
  for (const c of streams) dbg.stroke(c, c.len);
  await sharp(dbg.rgba(), { raw: { width: RW, height: RH, channels: 4 } }).flatten({ background: '#ffffff' }).png().toFile('.tmp/dots-network.png');
  console.log('  DOTS_DEBUG: wrote .tmp/dots-network.png');
  process.exit(0);
}

// ---- the words, drawn once, from the last frame -------------------------------
const drawn = [];
for (const p of pieces) {
  const l = await renderPiece(p, p.y0, p.y1, null);
  if (l) drawn.push(l);
}
const wordsField = new Float32Array(RW * RH);
for (const d of drawn) {
  for (let y = 0; y < d.h; y++) {
    const Y = d.top + y + SHIFT * SS;
    if (Y < 0 || Y >= RH) continue;
    for (let x = 0; x < d.w; x++) {
      const X = d.left + x + OX * SS;
      if (X < 0 || X >= RW) continue;
      const o = (y * d.w + x) * 3;
      const a = (255 - Math.min(d.rgb[o], d.rgb[o + 1], d.rgb[o + 2])) / 255;
      if (a > wordsField[Y * RW + X]) wordsField[Y * RW + X] = a;
    }
  }
}
const BOXES = LAID.map((b, i) => ({ ...DOTS_ITEMS[i], ...b, x: +(b.x + OX).toFixed(1), y: +(b.y + SHIFT).toFixed(1) }));
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
  let stray = 0;
  const inAny = (X, Y) => WORD.some((w) => X >= w.x0 && X < w.x0 + w.w && Y >= w.y0 && Y < w.y0 + w.h);
  for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) if (wordsField[Y * RW + X] > 0.25 && !inAny(X, Y)) stray++;
  if (stray > 40) fail(`${stray} device px of the last frame fall outside the three words' boxes`);
  console.log(`  the words: ${WORD.map((w, i) => `${BOXES[i].id} ${Math.round(w.ink)}`).join(', ')} (${stray} px stray)`);
}

/** A glyph thins the stroke over it, so the ink writes rather than strikes out. */
const GLYPH = (() => {
  const R = Math.round(1.2 * SS);
  const tmp = new Float32Array(RW * RH), out = new Float32Array(RW * RH);
  for (let y = 0; y < RH; y++) {
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

/** When each pixel of a word is written: along its writer, plus off it, plus noise. */
for (let i = 0; i < BOXES.length; i++) {
  const c = writers[i], w = WORD[i];
  const T = new Float32Array(w.w * w.h);
  let T0 = Infinity;
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    const px = (w.x0 + x + 0.5) / SS, py = (w.y0 + y + 0.5) / SS;
    let bestD = Infinity, bestS = 0;
    for (let k = 0; k < c.pts.length; k += 4) {
      const d = (c.pts[k].x - px) ** 2 + (c.pts[k].y - py) ** 2;
      if (d < bestD) { bestD = d; bestS = c.cum[k]; }
    }
    const t = bestS + 0.9 * Math.sqrt(bestD) + 1.8 * vn2(px / 9, py / 9, SEED + i) + 0.9 * vn2(px / 3.5, py / 3.5, SEED + 90 + i);
    T[y * w.w + x] = t;
    if (w.f[y * w.w + x] > 0.05 && t < T0) T0 = t;
  }
  w.T = T;
  w.T0 = T0;
}

// ---- baking --------------------------------------------------------------------
rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

const ink = new Ink(RW, RH, SS);
const revealed = new Array(BOXES.length).fill(-1e9);
let total = 0;
/** How full the picture is at the apex, for the resting frame to be read against. */
let apex = 0;
/** The ink left in each frame of the pull, so the withdrawal can be checked for pops. */
const pull = [];
/**
 * WHICH PIXELS ARE THE LEAVING FAMILY'S AND NOBODY ELSE'S. The reach is drawn
 * whole, and so is everything that stays; a pixel both of them cover — the
 * corner where the reach hands over to the spine, a word it crosses, a curl
 * that passes another — proves nothing about whether the reach has gone. What
 * is left is the set that can only be the reach, and the resting frame must
 * not light one of them.
 */
const reachOnly = (() => {
  const mine = new Ink(RW, RH, SS);
  for (const c of goes) mine.stroke(c, c.len);
  const theirs = new Ink(RW, RH, SS);
  for (const c of stays) theirs.stroke(c, c.len);
  const list = [];
  for (let i = 0; i < RW * RH; i++) {
    // the same floor the frame is read at, or a letter’s own faint edge
    // counts as the reach still being there
    if (mine.a[i] > 0.25 && theirs.a[i] <= 0.04 && wordsField[i] <= 0.04) list.push(i);
  }
  return list;
})();
for (let f = 0; f < FRAMES; f++) {
  const u = Math.min(1, f / (GROW_FRAMES - 1));
  /*
   * ONE CLOCK, AND IT ONLY GOES FORWARD. The mountain's run thins its ink away
   * over the last fifth; this one stops at the apex and holds — the owner's
   * "freezing when the words are fully revealed the branches are at their
   * apex". Coming back is the frames run backwards, which the page does when
   * the button is pressed again or another menu opens.
   */
  const grown = easeInOut(u);
  /*
   * HOW MUCH OF THE REACH IS STILL OUT: 1 the whole way through the growth,
   * then back to 0 over the pull. Each leaving channel is drawn to the same
   * fraction of its own length, measured from where it is rooted, so the
   * whole family empties into the button together and each piece runs out
   * exactly as the front passes the place it grew from.
   */
  const out = f < GROW_FRAMES ? 1 : 1 - easeInOut((f - GROW_FRAMES + 1) / PULL_FRAMES);
  ink.clear();

  for (const c of streams) {
    let s = frontArc(c, grown);
    if (c.goes && out < 1) {
      const room = 1 - c.detach;
      s = Math.min(s, c.len * (room <= 1e-6 ? 0 : Math.max(0, Math.min(1, (out - c.detach) / room))));
    }
    if (s <= 0) continue;
    ink.stroke(c, s, { gmask: glyphAt });
    if (s < c.len) {
      const tip = atArc(c, s);
      ink.bead(tip.x, tip.y, widthAt(c, s) * 0.62 * (1 - glyphAt(tip.x, tip.y)));
    }
  }

  for (let i = 0; i < BOXES.length; i++) {
    const c = writers[i];
    const over = grown - (c.t0 + c.dur);
    const s = over > 0 ? c.len + over * (c.len / c.dur) : frontArc(c, grown);
    if (s > revealed[i]) revealed[i] = s;
    const front = revealed[i], w = WORD[i];
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

  if (f >= GROW_FRAMES - 1) pull.push(ink.a.reduce((n, v) => n + (v > 0.04 ? 1 : 0), 0));

  const webp = await sharp(ink.rgba(), { raw: { width: RW, height: RH, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(f).padStart(3, '0')}.webp`, webp);
  total += webp.length;
  if (f === 0) {
    let on = 0;
    for (let i = 0; i < RW * RH; i++) if (ink.a[i] > 0.04) on++;
    if (on) fail(`the first frame draws ${on} device px; at rest this canvas is empty (the button is the page's)`);
  }
  /** Every word, whole. Asked of the apex and again of the resting frame. */
  const allWritten = (when) => {
    for (let i = 0; i < BOXES.length; i++) {
      const w = WORD[i];
      let got = 0;
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) got += Math.min(ink.a[(w.y0 + y) * RW + w.x0 + x], w.f[y * w.w + x]);
      if (got < w.ink * 0.97) fail(`"${BOXES[i].id}" is only ${((100 * got) / w.ink).toFixed(1)}% written ${when}`);
    }
  };
  if (f === GROW_FRAMES - 1) {
    allWritten('at the apex');
    /*
     * NOTHING TOUCHES THE EDGE. The canvas is measured off the network, so a
     * stroke reaching the border means the measuring and the drawing have
     * come apart — and what it looks like is a branch cut off square. The
     * APEX is the frame to ask: it is the fullest the picture ever gets.
     */
    let edge = 0;
    for (let X = 0; X < RW; X++) if (ink.a[X] > 0.04 || ink.a[(RH - 1) * RW + X] > 0.04) edge++;
    for (let Y = 0; Y < RH; Y++) if (ink.a[Y * RW] > 0.04 || ink.a[Y * RW + RW - 1] > 0.04) edge++;
    if (edge) fail(`${edge} device px of the apex sit on the canvas border; a stroke is being cut off square`);
    apex = ink.a.reduce((n, v) => n + (v > 0.04 ? 1 : 0), 0);
    console.log(`  the apex (frame ${f}): all three words written, the branches at full reach, nothing on the edge`);
  }
  if (f === FRAMES - 1) {
    /*
     * THE RESTING FRAME: the words still whole, and not one pixel of the
     * reach or of anything that grew off it left anywhere on the canvas —
     * the owner's "leave the other branches connected to the words and the
     * one on the left". It is measured by drawing that family on its own and
     * asking the frame about every pixel of it.
     */
    allWritten('in the resting frame');
    const over = reachOnly.reduce((n, i) => n + (ink.a[i] > 0.04 ? 1 : 0), 0);
    if (over) fail(`${over} of the reach's own ${reachOnly.length} device px are still drawn in the resting frame`);
    const rest = ink.a.reduce((n, v) => n + (v > 0.04 ? 1 : 0), 0);
    /*
     * AND IT WENT SMOOTHLY. A channel whose window has collapsed does not
     * retract, it is switched off, and the only sign in a still is one frame
     * shedding far more than its neighbours. So the pull's frame-to-frame
     * drops are kept and the biggest is held against the mean: 3x is loose
     * enough for the ends of the run, where the ink genuinely goes in a
     * rush, and tight enough to catch a whole curl disappearing at once.
     */
    const drops = [];
    for (let i = 1; i < pull.length; i++) drops.push(pull[i - 1] - pull[i]);
    const mean = drops.reduce((a, b) => a + b, 0) / drops.length;
    const worst = Math.max(...drops);
    if (worst > mean * 3) {
      fail(`the pull sheds ${worst} device px in one frame against a mean of ${mean.toFixed(1)}: something is being switched off rather than retracted`);
    }
    console.log(`  the resting frame: the reach is gone (${apex} device px of ink at the apex, ${rest} here), the words whole`);
    console.log(`    the pull sheds ${mean.toFixed(1)} device px a frame, the worst ${worst} (x${(worst / mean).toFixed(2)})`);
  }
}
console.log(`wrote ${FRAMES} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB, ${Math.round(total / FRAMES / 1024)}KB each)`);

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:dotsmenu — do not edit by hand.',
      dir: '/dotsmenu/frames',
      frame: { w: VIEW_W, h: VIEW_H, scale: SS },
      frames: FRAMES,
      frameMs,
      scale: +K.toFixed(5),
      hover: 'dim',
      /** where the button sits inside the canvas; the row places the button */
      logoHit: { x: OX, y: SHIFT, w: BOXW, h: BOXW },
      /**
       * How far the INK reaches left of the button's own left edge — the
       * canvas's edge less its slack. The row needs it to know whether the
       * words have come down on top of the glass; see `dotsClear`.
       */
      inkReach: Math.round(-gx0),
      boxes: BOXES,
      stops: { base: { frames: FRAMES, viewW: VIEW_W, boxes: BOXES.map((b) => b.id) } },
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
