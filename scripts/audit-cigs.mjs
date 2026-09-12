/**
 * Checks every pack crop against its source photograph, and names the ones
 * that cut into the pack.
 *
 *   npm run audit:cigs        (after npm run build:cigs, which writes the crops)
 *
 * The owner saw packs in the row that had been clipped, and the build's own
 * report could not say which: it lists what it PEELED, but the clips were
 * not peels — they were crop candidates that stopped short on a white face,
 * which reads as empty to every measure the build has. This reads the crops
 * the build recorded (scripts/assets/cigs/crops.json) and asks two questions
 * of the source pixels it left out:
 *
 *   1. INK. Between the crop and the pack's own ink extent (opaque pixels
 *      that are not paper-white), how much of each removed strip is ink? A
 *      strip that is mostly ink is pack that was cut. This finds cuts into a
 *      printed face — and also, deliberately, the loose cigarettes and
 *      overhanging splashes the "just the boxes" pass removes on purpose, so
 *      the list is read, not obeyed.
 *
 *   2. ALPHA. For a cut-out, walk out from the crop's top and bottom while
 *      the rows stay solidly opaque, and ask whether that solid strip is
 *      paper-white. A cut-out's alpha is the pack — unless the cut-out is
 *      loose and carries the photograph's paper (the Lotus / Nanjing block
 *      does, and the build peels it correctly). Paper is ≥235 in every
 *      channel across nearly the whole strip; a pack's face is not. This is
 *      what tells a white top that was cut (Zhenlong) from paper that was
 *      trimmed (Nanjing), which no ink test can, because both are white.
 *
 * Every number here is a source pixel, so the fix for a real clip is a
 * HAND_CROP entry in build-cigs.mjs: the pack's own extent on the cut side,
 * the build's box on the others.
 */
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const CROPS = 'scripts/assets/cigs/crops.json';
const { source: SRC, crops } = JSON.parse(readFileSync(CROPS, 'utf8'));

/** Paper, photographed: every channel this light. Same figure the build peels at. */
const PAPER = 235;
/** An opaque pixel, as the build counts one. */
const SOLID = 200;
/** A removed strip narrower than this share of the pack is a rule's width, not a cut. */
const MIN_DEPTH = 0.01;
/** Above this share of ink in a removed strip, it was pack. */
const INK_SHARE = 0.25;
/** Below this share of paper-white in a solid strip, it was pack, not paper. */
const PAPER_SHARE = 0.9;

const fileFor = (id) => ['png', 'jpg', 'jpeg'].map((e) => `${SRC}/${id}.${e}`).find((f) => existsSync(f));

const inkCuts = [];
const faceCuts = [];
let checked = 0;

for (const c of crops) {
  const file = fileFor(c.source ?? c.id) ?? fileFor(c.id);
  if (!file) continue;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const b = c.box;
  checked++;

  const px = (x, y) => (y * W + x) * 4;
  const opaque = (x, y) => data[px(x, y) + 3] > SOLID;
  const white = (x, y) => {
    const i = px(x, y);
    return Math.min(data[i], data[i + 1], data[i + 2]) >= PAPER;
  };
  const ink = (x, y) => opaque(x, y) && !white(x, y);

  // 1. ink: the pack's own ink extent, and what the crop left out of it
  let ax0 = W, ay0 = H, ax1 = -1, ay1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ink(x, y)) {
        if (x < ax0) ax0 = x;
        if (x > ax1) ax1 = x;
        if (y < ay0) ay0 = y;
        if (y > ay1) ay1 = y;
      }
    }
  }
  if (ax1 >= 0) {
    const share = (x0, y0, x1, y1) => {
      let n = 0, k = 0;
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          k++;
          if (ink(x, y)) n++;
        }
      }
      return k ? n / k : 0;
    };
    const strips = {
      left: b.x0 > ax0 ? { depth: b.x0 - ax0, ink: share(ax0, b.y0, b.x0 - 1, b.y1), of: W } : null,
      right: b.x1 < ax1 ? { depth: ax1 - b.x1, ink: share(b.x1 + 1, b.y0, ax1, b.y1), of: W } : null,
      top: b.y0 > ay0 ? { depth: b.y0 - ay0, ink: share(b.x0, ay0, b.x1, b.y0 - 1), of: H } : null,
      bottom: b.y1 < ay1 ? { depth: ay1 - b.y1, ink: share(b.x0, b.y1 + 1, b.x1, ay1), of: H } : null,
    };
    const cut = Object.entries(strips).filter(
      ([, s]) => s && s.depth >= Math.max(3, s.of * MIN_DEPTH) && s.ink > INK_SHARE,
    );
    if (cut.length) {
      inkCuts.push({
        id: c.id,
        hand: c.hand,
        sides: cut.map(([side, s]) => `${side} ${s.depth}px, ${Math.round(s.ink * 100)}% ink`).join(' | '),
      });
    }
  }

  // 2. alpha: solid strips above and below the crop, and whether they are paper
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 10) transparent++;
  const isCutOut = transparent > (data.length / 28) * 0.05;
  if (isCutOut) {
    const rowSolid = (y) => {
      let n = 0;
      for (let x = b.x0; x <= b.x1; x++) if (opaque(x, y)) n++;
      return n / (b.x1 - b.x0 + 1);
    };
    const paperShare = (y0, y1) => {
      let w = 0, k = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = b.x0; x <= b.x1; x++) {
          if (opaque(x, y)) {
            k++;
            if (white(x, y)) w++;
          }
        }
      }
      return k ? w / k : 1;
    };
    let top = b.y0;
    while (top - 1 >= 0 && rowSolid(top - 1) > 0.9) top--;
    let bottom = b.y1;
    while (bottom + 1 < H && rowSolid(bottom + 1) > 0.9) bottom++;
    const sides = [];
    if (b.y0 - top >= H * 0.02 && paperShare(top, b.y0 - 1) < PAPER_SHARE) {
      sides.push(`top ${b.y0 - top}px, ${Math.round(paperShare(top, b.y0 - 1) * 100)}% paper`);
    }
    if (bottom - b.y1 >= H * 0.02 && paperShare(b.y1 + 1, bottom) < PAPER_SHARE) {
      sides.push(`bottom ${bottom - b.y1}px, ${Math.round(paperShare(b.y1 + 1, bottom) * 100)}% paper`);
    }
    if (sides.length) faceCuts.push({ id: c.id, hand: c.hand, sides: sides.join(' | ') });
  }
}

const show = (list) => {
  for (const f of list) console.log(`    ${f.id.padEnd(40)}${f.hand ? '[hand] ' : ''}${f.sides}`);
};

console.log(`${checked} crops checked against their sources\n`);
console.log(`  ${faceCuts.length} cut into a pack's face at the top or bottom (solid, and not paper):`);
show(faceCuts);
console.log(`\n  ${inkCuts.length} removed a strip that was mostly ink. Read these — a loose cigarette or an`);
console.log('  overhanging graphic beside the box is meant to go; a printed face is not:');
show(inkCuts);
console.log('\n  The fix for a real clip is a HAND_CROP entry in scripts/build-cigs.mjs.');
