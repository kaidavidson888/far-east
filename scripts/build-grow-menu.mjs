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
import { openMenuGif } from './lib/menu-gif.mjs';
import { badgeMark, markAspect, distanceTo } from './lib/badge-mark.mjs';
import { sealChars, sealCoverage, sealRing } from './lib/seal-mark.mjs';
import {
  mulberry32, spline, curl, channel, atArc, frontArc, widthAt, sprout, linkTips, translate, Ink, smoothstep, easeInOut, easeIn, vn2,
} from './lib/ink-growth.mjs';

const SRC = 'scripts/assets/monkey-grow.gif';
const LANDING = 'lib/landing-geometry.json';

/**
 * TWO MENUS COME OUT OF THIS ONE BAKE, and `npm run build:growmenu` runs it
 * twice — once with no argument and once with `shelf`.
 *
 *   grow   the landing page's: about us, privacy policy, terms of service.
 *   shelf  the shelf page's (the owner's 2026-09-21 ask): the same three and
 *          a fourth, HOME, because the shelf's 遠東 logo — which was its only
 *          way back to /landing — is replaced by this button.
 *
 * IT IS ONE SCRIPT AND NOT TWO BECAUSE THEY MUST NOT DRIFT. Everything but
 * the word list is shared: the mark, the sky, the drain, the network's rules
 * and every proof. A copied script would be ~500 lines of that duplicated,
 * and the dots menu already shows what copying costs (see the note in
 * scripts/lib/menu-gif.mjs). Running it twice rather than looping once keeps
 * the diff to the word list and the output paths; the gif read costs 1.5s
 * the second time, which is the whole price.
 *
 * THE LANDING PAGE'S OUTPUT MUST COME BACK BYTE-IDENTICAL when this file is
 * touched. The word layout is computed BEFORE the network's rng is seeded, so
 * a fourth word cannot move the first three — proved: the shelf bake lays
 * about/privacy/terms on exactly the coordinates the grow bake does.
 */
const MENUS = {
  grow: {
    framesDir: 'public/growmenu/frames',
    geometry: 'lib/growmenu-geometry.json',
    dir: '/growmenu/frames',
    badge: 'public/growmenu/badge.webp',
    badgeSrc: '/growmenu/badge.webp',
    /**
     * THE LANDING PAGE'S BUTTON IS THE OWNER'S 遠東 (their 2026-09-23 ask:
     * "move the character logo to the left corner and make both characters
     * and their outlines the same scale as the mountain button … delete the
     * mountain button on the landing page from the top left"). Two cells,
     * one character each, filled solid at rest — see THE SEAL below.
     */
    mark: 'seal',
    items: [
      { id: 'about', label: 'About us', href: '/about', from: 'gif', lines: 1 },
      { id: 'privacy', label: 'Privacy policy', href: '/privacy', from: 'gif', lines: 2 },
      { id: 'terms', label: 'Terms of service', href: '/terms', from: 'gif', lines: 2 },
    ],
  },
  shelf: {
    framesDir: 'public/shelfmenu/frames',
    geometry: 'lib/shelfmenu-geometry.json',
    dir: '/shelfmenu/frames',
    /*
     * IT HAS ITS OWN STILL AGAIN. The two menus shared one file while both
     * buttons were the mountain — frame 0 is the mark alone, and the mark
     * was a function of BADGE.size, BADGE_RULE, MARK_SIDE_AIR and the one
     * vector, so the two bakes produced the same 238 bytes and the shelf
     * pointed at the landing page's copy. The landing page's button is the
     * seal now and this one is still the mountain, so there is nothing left
     * to share.
     */
    badge: 'public/shelfmenu/badge.webp',
    badgeSrc: '/shelfmenu/badge.webp',
    /** THE SHELF KEEPS THE MOUNTAIN: the owner's ask named the landing page. */
    mark: 'mountain',
    items: [
      { id: 'about', label: 'About us', href: '/about', from: 'gif', lines: 1 },
      { id: 'privacy', label: 'Privacy policy', href: '/privacy', from: 'gif', lines: 2 },
      { id: 'terms', label: 'Terms of service', href: '/terms', from: 'gif', lines: 2 },
      /*
       * HOME IS NOT IN THE OWNER'S GIF, and cannot be: its six words carry no
       * `h` anywhere. This is the same wall the BAR menu hit, and the same
       * answer — scripts/assets/menu-home-label.png, the word set in the
       * owner's own webfont and rendered in Chrome, checked in because
       * librsvg ignores an @font-face even with the font inlined. It is
       * matched to the other three the way they are matched to each other,
       * by X-HEIGHT, so it is the same size of the same face.
       */
      { id: 'home', label: 'Home', href: '/landing', from: 'label', src: 'scripts/assets/menu-home-label.png' },
    ],
  },
};
const WHICH = process.argv[2] ?? 'grow';
if (!MENUS[WHICH]) {
  throw new Error(`build-grow-menu: no menu called "${WHICH}" — try ${Object.keys(MENUS).join(' or ')}`);
}
const MENU = MENUS[WHICH];
const FRAMES_DIR = MENU.framesDir;
const GEOMETRY = MENU.geometry;

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
/**
 * THE BUTTON IS A TENTH BIGGER THAN THE PLUS (the owner's 2026-09-19 "make the
 * button 10% bigger"). It was the plus's own size — their earlier ask, "the
 * same scale as the + button" — and it still takes the row's scale, so the two
 * stay in step with one another at whatever size the row is drawn; this is a
 * tenth on top of that. The RULE does not scale with it: it is 2px here and
 * 2px round the tipi, which is what "the same thickness as the outline box"
 * means, and a 2.2px rule would land on a fraction and go soft.
 */
const BADGE = { x: 0, y: 0, size: Math.round(PLUS * 1.1) };
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

/**
 * THE SEAL: TWO CELLS, ONE CHARACTER EACH — the owner's 2026-09-23 ask.
 *
 * "make both characters and their outlines the same scale as the mountain
 * button", so a cell IS the mountain's box: `BADGE.size` square with the same
 * `BADGE_RULE` round it. The button is the PAIR, and everything that used to
 * measure from the button's right edge now measures from `BUTTON_W`.
 *
 * THE 5PX BETWEEN THEM IS THE OWNER'S NUMBER IN THE DRAWING'S OWN PX, and it
 * had to move coordinate systems to get here. On the corner seal it was 5
 * PAGE px — the stylesheet divided it by the zoom, so it held at 5 on screen
 * whatever the row was doing — and that was possible because the two boxes
 * were plain CSS. They are not: the mark DRAINS, so it is drawn by the canvas
 * (the same reason the mountain is), and a page-px gap inside a zoomed canvas
 * cannot be held constant. So it is 5 design px, exactly as the rule round it
 * is 2 design px, and it scales with the button like everything else drawn
 * here.
 */
const SEAL_GAP = 5;
/**
 * THE OUTLINE THE DRAIN LEAVES, as a fraction of a character's own square.
 *
 * Swept at 0.0207 (the corner seal's 1.2 of 58), 0.03, 0.04 and 0.055 and
 * looked at both magnified and at the size the page really draws it: 0.0207
 * keeps a third of the ink and goes grey in places at 20px, 0.04 keeps three
 * quarters and starts to read as the filled character again, and 0.055 trips
 * the build's own 90% guard. 0.03 — about 0.8 design px — is a solid line
 * with the hollows plain, and keeps 54% and 48%.
 */
const SEAL_RING = Number(process.env.SEAL_RING ?? 0.03);
const CELLS = MENU.mark === 'seal' ? 2 : 1;
const BUTTON_W = CELLS * BADGE.size + (CELLS - 1) * SEAL_GAP;
/** Each cell's box, in the button's own coordinates. */
const CELL_X = Array.from({ length: CELLS }, (_, i) => BADGE.x + i * (BADGE.size + SEAL_GAP));

/**
 * The words of THIS menu, in reading order along the row.
 *
 * THREE OF THEM COME OUT OF THE GIF, AND IT DRAWS SIX. MY SAVED, OFFERS and
 * RECOMMENDED were under this button until the owner's 2026-09-20 ask moved
 * them onto the dots button beside the row's plus; they are `DOTS_ITEMS` in
 * scripts/build-dots-menu.mjs now. The gif still draws all six and the front
 * end still finds all six — the build would stop if it did not — but only
 * the ones listed here are laid out.
 */
const ITEMS = MENU.items;
/** How many of them the gif is the source for; they come first, in its order. */
const GIF_ITEMS = ITEMS.filter((it) => it.from === 'gif').length;

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

// ---- the source, read once and shared with the dots menu -------------------
/*
 * Every measurement off the owner's gif — the scale its logo sets, the box it
 * drew, the six words on its last frame, and how to rasterise one of them —
 * is scripts/lib/menu-gif.mjs, because TWO menus are built from that one
 * drawing now: this one, and the dots button's (npm run build:dotsmenu),
 * which took the three words that used to hang under this button.
 */
const gif = await openMenuGif('build-grow-menu', { ss: SS });
const { W, H, N, frameMs, K, START, BOX, last, pageX, pageY, gifX, gifY, topWords, glyphMask, components, lineBands, renderPiece } = gif;

const measured = topWords.slice(0, GIF_ITEMS).map((pb, wi) => {
  const G = glyphMask(pb);
  // how many lines the gif drew this word on — "about us" one, the others two
  const expect = ITEMS[wi].lines;
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

/**
 * A WORD THE GIF NEVER DREW, read off a coverage map instead.
 *
 * `menu-home-label.png` is white ink on black — the word set in the owner's
 * face and rendered in Chrome, which is the only way to get it (librsvg,
 * which sharp rasterises SVG with, ignores an @font-face even with the font
 * inlined as a data URI). It is measured by exactly the rule the gif's words
 * are: `lineBands` finds the x-height band and the word is scaled so that
 * band is `X_STAR`, the reset button's own. So it arrives the same size as
 * its neighbours because it is measured against the same thing, not because
 * a factor was chosen.
 */
async function readLabel(src) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: C } = info;
  const cov = new Float32Array(w * h);
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    cov[i] = data[i * C] / 255;
    m[i] = data[i * C] > 127 ? 1 : 0;
  }
  let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!m[y * w + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) fail(`${src} is blank`);
  const [a, b] = lineBands({ m, w, h }, 1)[0];
  /** page px per label px, so the band comes out at the row's x-height */
  const ppl = X_STAR / (b - a);
  console.log(
    `    ${'label'.padEnd(8)} x-height ${b - a} px of ${src.split('/').pop()}`
    + ` -> ${X_STAR.toFixed(2)} page px (x${ppl.toFixed(4)})`,
  );
  return { cov, w, h, ppl, band: [a, b], ink: { x0, y0, x1: x1 + 1, y1: y1 + 1 } };
}
const LABELS = new Map();
for (const it of ITEMS) {
  if (it.from === 'label') LABELS.set(it.id, await readLabel(it.src));
}

// ---- the pieces of the top row, and where each one goes --------------------
const TOP_Y0 = Math.max(0, BOX.y0 - 30);
const TOP_Y1 = BOX.y1;
const aboutMid = (aboutLine.xTop + aboutLine.base) / 2;
const pieces = [];
let cursor = BADGE.x + BUTTON_W;
const addPiece = (p) => {
  pieces.push(p);
  cursor = p.newX0 + (p.x1 - p.x0) * p.sx;
};
// the run from the drawn box to "about us" is measured but no longer drawn:
// nothing of the gif's own growth is copied now. It still sets the cursor.
cursor += (topWords[0].x0 - BOX.x1) * kAbout;
const wordPieces = [];
for (let wi = 0; wi < ITEMS.length; wi += 1) {
  if (ITEMS[wi].from === 'label') {
    /*
     * A label is already at its final size, so its piece is drawn at 1:1 and
     * its own coordinates are label px x `ppl`. It is placed by the same two
     * rules as a gif word — the middle of its x-height band onto the button's
     * middle line, and its ink's left edge wherever the re-lay pass below
     * puts it — so nothing downstream can tell the two apart.
     *
     * ITS BOX IS THE WHOLE INK, NOT THE X-HEIGHT BAND. The h's ascender
     * stands above the band, and a box cut to the band leaves it outside the
     * words' boxes, where the build counts it as stray ink and stops.
     */
    const L8 = LABELS.get(ITEMS[wi].id);
    const P = L8.ppl;
    const L = { x0: L8.ink.x0 * P, x1: L8.ink.x1 * P, y0: L8.ink.y0 * P, y1: L8.ink.y1 * P };
    const p = {
      name: ITEMS[wi].id,
      label: ITEMS[wi].id,
      x0: L.x0,
      x1: L.x1,
      sx: 1,
      sy: 1,
      refY: ((L8.band[0] + L8.band[1]) / 2) * P,
      newRefY: ROW_MIDDLE,
      newX0: cursor,
    };
    addPiece(p);
    wordPieces[wi] = [{ p, L }];
    continue;
  }
  const m = measured[wi];
  const kw = k[wi];
  if (wi > 0 && ITEMS[wi - 1].from === 'gif') {
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

const r2 = (v) => +(Math.round(v * 2) / 2).toFixed(1);
const mapX = (p, x) => p.newX0 + (x - p.x0) * p.sx;
const mapY = (p, y) => p.newRefY + (y - p.refY) * p.sy;

/**
 * EVERY GAP ON THE ROW IS THE LAST ONE, AND THEY ARE MEASURED BETWEEN THE
 * LETTERS (the owner's 2026-09-19 "make the margins between text buttons and
 * the mountain button the same as the last one between the TOS and privacy
 * policy and adjust the animation accordingly").
 *
 * The three gaps a reader saw were 26.5, 41 and 56: the run from the button
 * was never doubled (it is not a gap BETWEEN text buttons), and the other two
 * are the gif's own gaps doubled, which differ because it drew its words
 * different distances apart. The last is now all three.
 *
 * IT HAS TO BE MEASURED BETWEEN THE INK, not between the pieces. A two-line
 * word's piece is as wide as the block the gif drew, and its second line is
 * re-laid after the first, so the piece runs on well past the last letter:
 * equalising the pieces' gaps left the visible ones at 37.5, 37 and 56 — the
 * same three gaps, barely moved. So each word is placed by where its FIRST
 * letter has to land, and the next gap is taken from where its LAST one ends.
 */
const inkLeftOf = (wi) => Math.min(...wordPieces[wi].map(({ p, L }) => mapX(p, L.x0)));
const inkRightOf = (wi) => Math.max(...wordPieces[wi].map(({ p, L }) => mapX(p, L.x1)));
/*
 * THE 1 AND THE 2 ARE LITERAL ON PURPOSE — do not make them ITEMS.length.
 * The owner named this gap: "the last one between the TOS and privacy
 * policy". It is the gap the GIF drew between those two words, doubled, and
 * it is the same number whether this menu carries three words or four. A
 * fourth word placed after them must take that gap, not redefine it.
 */
const ROW_GAP = inkLeftOf(2) - inkRightOf(1);
{
  const was = ITEMS.map((_, wi) => (wi ? inkLeftOf(wi) - inkRightOf(wi - 1) : inkLeftOf(0) - (BADGE.x + BUTTON_W)));
  let want = BADGE.x + BUTTON_W + ROW_GAP;
  for (let wi = 0; wi < ITEMS.length; wi += 1) {
    const shift = want - inkLeftOf(wi);
    for (const { p } of wordPieces[wi]) p.newX0 += shift;
    want = inkRightOf(wi) + ROW_GAP;
  }
  console.log(`  the row's gaps: ${was.map((v) => v.toFixed(1)).join(' / ')} -> all ${ROW_GAP.toFixed(1)}px`);
}

// ---- the words, drawn once, from the last frame ----------------------------
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
  if (p.label) {
    // The png is a COVERAGE map and everything downstream works in ink over
    // white, so it is inverted on the way in; then resized by the same
    // lanczos call renderPiece makes, at the scale the x-height match gave.
    const L8 = LABELS.get(p.label);
    const dw = Math.round(L8.w * L8.ppl * SS);
    const dh = Math.round(L8.h * L8.ppl * SS);
    const src = Buffer.alloc(L8.w * L8.h * 3);
    for (let i = 0; i < L8.w * L8.h; i += 1) {
      const v = Math.round(255 * (1 - L8.cov[i]));
      src[i * 3] = v; src[i * 3 + 1] = v; src[i * 3 + 2] = v;
    }
    const rgb = await sharp(src, { raw: { width: L8.w, height: L8.h, channels: 3 } })
      .resize({ width: dw, height: dh, fit: 'fill', kernel: 'lanczos3' })
      .raw().toBuffer();
    drawn.push({
      rgb, w: dw, h: dh, left: Math.round(mapX(p, 0) * SS), top: Math.round(mapY(p, 0) * SS),
    });
    continue;
  }
  const own = p.line === undefined ? null : (gx, gy) => lineOwner(measured[p.word], gx, gy) === p.line;
  const l = await renderPiece(p, TOP_Y0, TOP_Y1, own);
  if (l) drawn.push(l);
}

// ---- where everything stands, and how big the canvas has to be -------------

const topBoxes = wordPieces.map((parts) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const { p, L } of parts) {
    x0 = Math.min(x0, mapX(p, L.x0)); x1 = Math.max(x1, mapX(p, L.x1));
    y0 = Math.min(y0, mapY(p, L.y0)); y1 = Math.max(y1, mapY(p, L.y1));
  }
  return { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) };
});
/**
 * The words where they stand, in the button's own coordinates. THREE now, not
 * six: the owner's 2026-09-20 ask moved MY SAVED, OFFERS and RECOMMENDED out
 * of this animation and onto the dots button beside the row's plus.
 */
const LAID = topBoxes;

// ---- the network -----------------------------------------------------------
/**
 * WHERE THE INK LEAVES THE BUTTON. Two exits, because the menu has two runs:
 * the top row goes out of the right-hand side on the row's middle line, the
 * stack out of the foot.
 */
const EXIT_TOP = { x: BADGE.x + BUTTON_W, y: ROW_MIDDLE };
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
/**
 * HOW FAR ABOVE THE BUTTON THE GROWTH MAY REACH, and it is NOT the page's
 * margin. The canvas is placed `SHIFT` above the button in the MENU's px, so
 * on the page that is SHIFT x the row's zoom — and the zoom passes 1 on a wide
 * screen (measured: 3 of 247 packs at 1920, 200 of 247 at 2560, up to 1.83).
 * At the margin's own 10 the top of the growth was being cut off by the page's
 * edge there — 55 device px of ink at 1.83. Five keeps it on the page up to a
 * zoom of 2, which is past anything the row produces.
 */
const TOP_ROOM = 5;
/*
 * The band reached down to 54 while the stack hung under this button and had
 * to be cleared; with the stack gone (2026-09-20) the room under the top row
 * is the growth's to use, down to the foot of the canvas.
 */
const topBand = (x, y) => y > -TOP_ROOM + 1 && y < 54 && x > BADGE.x + 2;
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
for (let i = 0; i < LAID.length; i += 1) {
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
const lastTop = LAID[LAID.length - 1];
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
const SHIFT = Math.min(TOP_ROOM, Math.max(0, Math.ceil(-gy0) + 1));
if (-gy0 > TOP_ROOM) console.log(`  note: the growth reaches ${(-gy0).toFixed(1)}px above the button and TOP_ROOM is ${TOP_ROOM}; the top is clipped`);
// from here on everything is in the CANVAS's coordinates: the channels were
// laid out from the button's corner, and the canvas starts above it
translate(streams, 0, SHIFT);
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
  mkdirSync('.tmp', { recursive: true });
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
/*
 * `from`, `lines` and `src` say where a word was CUT FROM; they are inputs to
 * this bake and no business of the page's, so they are dropped here rather
 * than shipped in the geometry.
 */
const BOXES = LAID.map((b, i) => {
  const { id, label, href } = ITEMS[i];
  return { id, label, href, ...b, y: r2(b.y + SHIFT) };
});
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
  if (stray > 40) fail(`${stray} device px of the last frame fall outside the words' boxes`);
  console.log(`  the words: ${WORD.map((w, i) => `${BOXES[i].id} ${Math.round(w.ink)}`).join(', ')} (${stray} px stray)`);
}

// ---- the mark, and how it drains -------------------------------------------
/**
 * THE MARK IS ONE RECTANGLE OF THE CANVAS whichever button this is, and
 * `FRAME` says which of its pixels are inside the outline at all.
 *
 *   mountain  one cell; the rect is the mark's own box, standing on the
 *             inner foot with a pixel of air at each side, and every pixel
 *             of it is in frame.
 *   seal      two cells; the rect spans BOTH interiors, and the strip
 *             between them — the two rules and the owner's 5px — is out of
 *             frame, so nothing is ever drawn there.
 *
 * Out of frame the painter draws nothing, which is what keeps the gap clear
 * while the two boxes fill.
 */
let MARK_W; let MARK_H; let MW; let MH; let MX; let MY; let mark; let FRAME;
/** Each cell's columns within the rect, in device px — the seal has two. */
let CELL_RANGE;
if (MENU.mark === 'seal') {
  /*
   * THE FILL REACHES THE RULE. The mountain's mark keeps a pixel of air at
   * its sides because it is a full-bleed picture and would otherwise merge
   * with three sides of its box — but here what fills is "the white in the
   * outline" (the owner's words), so the frame IS the interior and the air
   * goes round the CHARACTER inside it instead.
   */
  MARK_W = BUTTON_W - BADGE_RULE * 2;
  MARK_H = BADGE.size - BADGE_RULE * 2;
  MW = Math.round(MARK_W * SS);
  MH = Math.round(MARK_H * SS);
  MX = Math.round((BADGE.x + BADGE_RULE) * SS);
  MY = Math.round((BADGE.y + BADGE_RULE + SHIFT) * SS);
  const IN = Math.round((BADGE.size - BADGE_RULE * 2) * SS); // a cell's interior
  const SIDE = Math.round((BADGE.size - BADGE_RULE * 2 - MARK_SIDE_AIR * 2) * SS);
  const chars = await sealChars({ log: (m) => console.log(m) });
  const cov = sealCoverage(chars, SIDE);
  if (cov.length !== CELLS) fail(`the vector gave ${cov.length} characters for ${CELLS} cells`);
  /**
   * AND THE SAME CHARACTERS AS AN OUTLINE, which is what the drain leaves
   * behind (the owner's 2026-09-23 "when the black drains from the characters
   * it leave behind an outline of the characters"). The weight is a fraction
   * of the square's own side, so it is the same line relative to the
   * character whatever size the button is drawn at.
   */
  const ringCov = sealRing(chars, SIDE, SEAL_RING);
  const ink = new Float32Array(MW * MH);
  const ringInk = new Float32Array(MW * MH);
  FRAME = new Uint8Array(MW * MH);
  for (let c = 0; c < CELLS; c++) {
    const ox = Math.round(c * (BADGE.size + SEAL_GAP) * SS); // the cell's interior, in the rect
    for (let y = 0; y < IN; y++) for (let x = 0; x < IN; x++) {
      const X = ox + x, Y = y;
      if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue;
      FRAME[Y * MW + X] = 1;
    }
    const air = Math.round(MARK_SIDE_AIR * SS);
    for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) {
      const v = cov[c][y * SIDE + x];
      const r = ringCov[c][y * SIDE + x];
      if (v <= 0 && r <= 0) continue;
      const X = ox + air + x, Y = air + y;
      if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue;
      ink[Y * MW + X] = v;
      ringInk[Y * MW + X] = r;
    }
  }
  {
    // THE RING MUST NOT BE THE CHARACTER AGAIN, the corner seal's own guard:
    // past about 90% the line is thicker than the strokes and "outline" is a
    // word for the same picture. Measured at SEAL_RING: about half.
    const kept = cov.map((f, i) => {
      const a = ringCov[i].reduce((s, v) => s + v, 0);
      const b = f.reduce((s, v) => s + v, 0);
      return (100 * a) / b;
    });
    console.log(`  the outline the drain leaves: ${kept.map((k) => `${k.toFixed(1)}%`).join(' / ')} of each character's ink`);
    const worst = Math.max(...kept);
    if (worst > 90) fail(`the outline keeps ${worst.toFixed(1)}% of a character's ink — that is the character, not an outline`);
    // …AND A FLOOR, because too THIN fails silently where too thick does not:
    // a `SEAL_RING` of nothing leaves `keep` at zero and the drain simply
    // empties the box again, which is what this replaced.
    const thinnest = Math.min(...kept);
    if (!Number.isFinite(thinnest) || thinnest < 15) {
      fail(`the outline keeps ${thinnest.toFixed(1)}% of a character's ink — there is no line there (SEAL_RING is ${SEAL_RING})`);
    }
  }
  CELL_RANGE = Array.from({ length: CELLS }, (_, c) => {
    const ox = Math.round(c * (BADGE.size + SEAL_GAP) * SS);
    return [ox, ox + IN];
  });
  // the characters ARE the silhouette, and what the drain keeps is their
  // outline — `tipi` is the mountain's name for "the detail that stays"
  mark = { ink, body: ink, tipi: new Float32Array(MW * MH), ring: ringInk };
  console.log(
    `  the mark: ${CELLS} cells of ${BADGE.size}px with ${SEAL_GAP} between,`
    + ` each holding a ${SIDE / SS}px character in its ${IN / SS}px interior`
    + ` (the rect ${MARK_W}x${MARK_H} page px at ${MX / SS},${MY / SS})`,
  );
} else {
  const ASPECT = await markAspect();
  MARK_W = BADGE.size - BADGE_RULE * 2 - MARK_SIDE_AIR * 2;
  MARK_H = MARK_W / ASPECT;
  MW = Math.round(MARK_W * SS); MH = Math.round(MARK_H * SS);
  MX = Math.round((BADGE.x + BADGE.size / 2) * SS - MW / 2);
  MY = Math.round((BADGE.y + BADGE.size - BADGE_RULE + SHIFT) * SS) - MH;
  mark = await badgeMark(MW, MH, BADGE_RULE * SS);
  FRAME = new Uint8Array(MW * MH).fill(1);
  CELL_RANGE = [[0, MW]];
  console.log(`  the mark: ${MARK_W}x${MARK_H.toFixed(2)} page px at ${MX / SS},${(MY / SS).toFixed(2)} (${MW}x${MH} device)`);
}

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
if (MENU.mark === 'seal') {
  /**
   * WHAT THE SEAL KEEPS IS THE CHARACTERS' OWN OUTLINE (the owner's
   * 2026-09-23 "when the black drains from the characters it leave behind an
   * outline of the characters"), so the mark you are looking at is the same
   * mark at every moment of the run: filled at rest, knocked out white while
   * the boxes are full, and an outline once they have emptied.
   *
   * `keep` is a PROTECTION FACTOR, not ink — the painter draws
   * `ink[i] * max(on, keep[i])` — so it is the share of this pixel's ink
   * that the ring accounts for. At the middle of a stroke's edge both are 1
   * and the pixel stays black; at the middle of a stroke the ring is 0 and
   * it drains.
   *
   * (It was zero for a day, and the note said an outline could not read at
   * 33px: that a stroke of 遠 was about 2.5 device px across, so a line on
   * both sides of it would be the whole stroke. Measured instead of
   * estimated, the ring keeps 54% and 48% of the ink and the hollows are
   * plain — see the figure the bake prints. The estimate was wrong because
   * the ring has to be taken at the SUPERSAMPLED size and filtered down,
   * which is what `sealRing` does; eroded on the finished 54px square it
   * really would have come out as the character again.)
   */
  for (let i = 0; i < MW * MH; i++) {
    keep[i] = mark.ink[i] > 0.004 ? Math.min(1, mark.ring[i] / mark.ink[i]) : 0;
  }
} else {
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
  /**
   * AND NOTHING ELSE. There were VEINS in here — two runs up from the two
   * spouts with a curl on each, grown by the same generator as the branches
   * outside, so that what the mark kept was of a piece with what left it. The
   * owner: "remove the stray black stroke inside the drained mountain". At
   * this size they were not filigree; a 24px mountain has room for its own
   * outline and nothing more, and the longer of the two read as a scratch
   * from the base to the summit. The generator is still here for anything
   * bigger — it is `sprout` and `curl` in scripts/lib/ink-growth.mjs.
   *
   * The tipi stays: it is the mark's one detail, and the white rule round it
   * needs something to be a rule against.
   */
  for (let i = 0; i < MW * MH; i++) if (mark.tipi[i] > keep[i]) keep[i] = mark.tipi[i];
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
  /**
   * EVERY CELL IS SEEDED ON ITS OWN, and that is not tidiness.
   *
   * This is a Dijkstra THROUGH THE INK, and the seal's two characters are
   * not connected to one another: seeded only where the network leaves, the
   * far character is never reached, stays at phi = 1 for every pixel, and so
   * drains in one frame at the very end instead of emptying with its
   * neighbour. For the mountain there is one cell covering the whole rect,
   * so this is exactly the two seeds it always had.
   *
   * The exits are the button's right-hand side on the row's middle line —
   * where the channels actually leave — and the foot under each cell, so a
   * character empties toward the bottom right, which is the way the ink is
   * going.
   */
  const seeds = [];
  for (let c = 0; c < CELL_RANGE.length; c++) {
    const [cx0, cx1] = CELL_RANGE[c];
    const exits = [
      { x: BADGE.x + BUTTON_W, y: ROW_MIDDLE + SHIFT },
      { x: CELL_X[c] + BADGE.size / 2, y: BADGE.y + BADGE.size + SHIFT },
    ];
    for (const p of exits) {
      const px = p.x * SS - MX, py = p.y * SS - MY;
      let best = -1, bestD = INF;
      for (let i = 0; i < MW * MH; i++) {
        if (!solid(i)) continue;
        const x = i % MW, y = (i / MW) | 0;
        if (x < cx0 || x >= cx1) continue;
        const dd = (x - px) ** 2 + (y - py) ** 2;
        if (dd < bestD) { bestD = dd; best = i; }
      }
      if (best >= 0) seeds.push(best);
    }
  }
  if (seeds.length !== CELL_RANGE.length * 2) fail(`the mark has no ink at ${CELL_RANGE.length * 2 - seeds.length} of its exits`);
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

/**
 * THE SKY FILLS FIRST, AND EMPTIES FIRST — the owner's 2026-09-19 "make it so
 * the sky fills before it spreads out of the outline".
 *
 * The mark is a picture with a sky in it: the paper the mountain does not
 * cover, inside the mark's own frame. Before anything leaves the button that
 * sky FILLS with ink, as a level rising round the mountain, and only when it
 * is full does the first channel leave the box. The ink then flows out, and
 * what it takes first is what arrived last — the level falls back down the sky
 * and carries on into the mountain, which drains to its traces.
 *
 * ONE FIELD SAYS ALL OF THAT: `LEVEL[i]` is the mark on a single dial that
 * runs 0 at the deepest ink to 2 at the top of the sky. A pixel carries ink
 * while the dial stands at or above it, so the whole animation is the dial
 * moving — 1 to 2 as the sky fills, 2 to 0 as it empties and the mountain
 * drains, and never back up until the frames themselves are run backwards.
 *   0..1   the mountain, 1 - PHI: nearest the two spouts empties first
 *   1..2   the sky, by height: the top of it fills last and empties first
 */
/** The dial's top: a hair over the topmost sky pixel, so the sky fills solid. */
const SKY_TOP = 2.08;
/**
 * AND THE SKY STOPS SHORT OF THE MOUNTAIN, by the width of the line the drain
 * leaves behind. Both are black, so a full sky over a full mountain is one
 * black rectangle and the drawing is gone for as long as it lasts; holding the
 * ink a line's width off the silhouette keeps the mountain there, in the same
 * keyline the drain ends on. (Left to the antialiasing the edge came out a
 * half-covered grey seam, which looked like this by accident — this is the
 * same picture, measured.)
 */
const SKY_GAP = CONTOUR + 0.6;
const SKY_CLEAR = (() => {
  const solid = new Uint8Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) solid[i] = mark.body[i] > 0.5 ? 1 : 0;
  return distanceTo(solid, MW, MH); // 0 on the mountain, growing out into the sky
})();
const LEVEL = (() => {
  const lv = new Float32Array(MW * MH);
  // OUT OF FRAME IS NOT SKY. For the seal the strip between the two cells is
  // outside both outlines and must stay empty; reading it as paper would fill
  // the gap in with the rest and the button would come up one long box.
  const sky = (i) => FRAME[i] === 1 && mark.body[i] < 0.5;
  let ySky = 0;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (sky(y * MW + x)) ySky = Math.max(ySky, y);
  if (!ySky) fail('the mark has no sky to fill');
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      if (!FRAME[i]) { lv[i] = 0; continue; }
      // Kept clear of the dial's own ends by the soft edge: at rest (1) every
      // pixel of the mountain must be SOLID and every pixel of the sky empty,
      // and at 0 the mountain must be gone rather than half there.
      lv[i] = sky(i) ? 1.05 + 0.95 * (1 - y / ySky) : 0.08 + 0.82 * (1 - PHI[i]);
    }
  }
  const inFrame = FRAME.reduce((s, v) => s + v, 0);
  console.log(`  the sky: ${Math.round((100 * lv.filter((v) => v > 1).length) / inFrame)}% of the mark's frame, filling to y=0 from y=${ySky}`);
  return lv;
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
/**
 * WHAT HAPPENS WHEN. The sky fills over the first stretch and NOTHING leaves
 * the button while it does (the owner's "make it so the sky fills before it
 * spreads out of the outline"); the growth has the middle; over the last
 * fifth the ink thins away and the words are left standing.
 */
const FILL = 0.12;
/**
 * AND IT HOLDS FULL FOR A BEAT BEFORE ANYTHING LEAVES. Measured on the first
 * cut, the sky reached 100% on the very frame the first ink crossed the
 * outline: true to the ask, but with nothing to see it by. Three frames of a
 * full box says it.
 */
const SPREAD = FILL + 0.02;
const GROW = 0.8;
/** The dial's soft edge — half a level line, in dial units. */
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
const WRITER = BOXES.map(() => topMain);
const revealed = new Array(BOXES.length).fill(-1e9);
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
for (let i = 0; i < BOXES.length; i++) {
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
  // nothing grows until the sky is full, and has stood full for a beat
  const grown = u <= SPREAD ? 0 : easeInOut(Math.min(1, (u - SPREAD) / (GROW - SPREAD)));
  const back = u <= GROW ? 0 : easeIn((u - GROW) / (1 - GROW));
  /**
   * THE TWO DIALS. One field, read by two hands going opposite ways — the
   * owner's 2026-09-20 "make it so the mountain drains as the outline fills".
   *
   * `sky` is the hand it always had: 1 -> SKY_TOP as the sky fills, then
   * SKY_TOP -> 0 as the ink leaves, at the pace it always emptied at.
   * `mtn` is the new one, and it runs DOWN over exactly the stretch the sky
   * comes up: the mountain gives its ink to the box rather than waiting for
   * the growth to take it. It reaches 0 as the box reaches full and STAYS at
   * 0 for the whole run after — the mountain is drained for as long as the
   * menu is open, and fills again only when the frames themselves are run
   * backwards ("the mountain remains drained at the end until the animation
   * is fully reversed … until the menu is closed").
   */
  const fill = easeInOut(Math.min(1, u / FILL));
  const sky = u <= FILL ? 1 + (SKY_TOP - 1) * fill : SKY_TOP * (1 - grown);
  const mtn = 1 - fill;
  /*
   * AND THE GAP CLOSES AS THE MOUNTAIN EMPTIES. The sky is held a line's
   * width off the silhouette so that a full sky over a FULL mountain is not
   * one black rectangle — but a drained mountain is white, and the gap then
   * put a second, redundant edge round it: white keyline, black contour,
   * white interior. It is scaled by the mountain's own dial, so it is the
   * full line while there is black to separate and nothing at all once the
   * mountain is a white shape in a black box.
   */
  const gap = SKY_GAP * mtn;
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

  // the mark: the sky filling, then everything draining away
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      if (!FRAME[i]) continue; // the strip between the seal's two cells
      const isSky = LEVEL[i] > 1;
      // the sky is paper and has no coverage of its own, so it inks to
      // whatever the silhouette leaves — the two sum to a solid frame with no
      // seam along the mountain's edge
      const a = isSky ? (1 - mark.body[i]) * smoothstep(gap, gap + 1, SKY_CLEAR[i]) : mark.ink[i];
      if (a <= 0) continue;
      // ink is there while the dial stands at or above this pixel; the traces
      // (the outline, the veins, the tipi) are what the mountain keeps whatever
      // the dial says
      const on = smoothstep(LEVEL[i] - DRAIN_SOFT, LEVEL[i] + DRAIN_SOFT, isSky ? sky : mtn);
      const v = a * Math.max(on, isSky ? 0 : keep[i]);
      if (v <= 0) continue;
      const X = MX + x, Y = MY + y;
      if (X < 0 || Y < 0 || X >= RW || Y >= RH) continue;
      const o = Y * RW + X;
      if (v > ink.a[o]) ink.a[o] = v > 1 ? 1 : v;
    }
  }

  // the words, written up to wherever the front that writes them has reached
  for (let i = 0; i < BOXES.length; i++) {
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
    const cut = await sharp(still, { raw: { width: MW, height: MH, channels: 4 } })
      .webp({ lossless: true, effort: 6 }).toBuffer();
    if (MENU.badge) {
      writeFileSync(MENU.badge, cut);
    } else {
      /*
       * THE OTHER MENU SHARES THIS FILE, AND THAT IS CHECKED RATHER THAN
       * ASSUMED. The still is cut from frame 0, whose pixels are the mark and
       * nothing else (asserted just above), and the mark is a function of
       * BADGE.size, BADGE_RULE, MARK_SIDE_AIR and the vector — no word enters
       * it. So this bake must produce the very same bytes as the one that
       * writes the file; if it ever does not, the two menus' buttons have
       * drifted apart and one of them is drawing a still that is not its own.
       */
      const have = readFileSync(MENU.badgeSrc.replace(/^\//, 'public/'));
      if (!have.equals(cut)) {
        fail(`this menu's mark is not the one in ${MENU.badgeSrc}`
          + ` (${cut.length} bytes against ${have.length}) — it cannot share that still`);
      }
    }
  }
  if (f === FRAMES - 1) {
    // the open state must be the words and the mark, and nothing else
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
console.log(`    button ${BADGE.x},${SHIFT} ${BUTTON_W}x${BADGE.size}${CELLS > 1 ? ` (${CELLS} cells of ${BADGE.size} with ${SEAL_GAP} between)` : ""}`);
for (const b of BOXES) console.log(`    ${b.id.padEnd(12)} ${String(b.x).padStart(7)},${String(b.y).padStart(6)} ${b.w}x${b.h}`);

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:growmenu — do not edit by hand.',
      dir: MENU.dir,
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
      logoHit: { x: BADGE.x, y: SHIFT, w: BUTTON_W, h: BADGE.size },
      badge: {
        rule: BADGE_RULE,
        /** What the button is CALLED, which only the bake knows. */
        label: MENU.mark === 'seal' ? '遠東 — menu' : 'Menu',
        /**
         * ONE OUTLINE PER CELL, AND STILL ONE BUTTON. `logoHit` is the press
         * target, the focus ring and the hover — the pair — and these are the
         * boxes drawn inside it. The mountain has one and the seal two; the
         * page draws what it is given rather than knowing which menu it is.
         * (This is how the corner seal was built too: "make them 1 button
         * with 5px margin between".)
         */
        cells: CELL_X.map((x) => ({ x, y: SHIFT, w: BADGE.size, h: BADGE.size })),
        // the mark as the page draws it at rest, in the canvas's coordinates
        // THE SIZE IS THE RASTER'S OWN, not the size it was worked out from:
        // the mark is rounded to whole device px when it is drawn, and a page
        // that then draws it at the unrounded height (23.94 against the baked
        // 24) resamples every row of it for a twentieth of a pixel. Whole
        // pixels, as everywhere else here.
        mark: { src: MENU.badgeSrc, x: MX / SS, y: MY / SS, w: MW / SS, h: MH / SS },
      },
      boxes: BOXES,
      stops: { base: { frames: FRAMES, viewW: VIEW_W, boxes: BOXES.map((b) => b.id) } },
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
