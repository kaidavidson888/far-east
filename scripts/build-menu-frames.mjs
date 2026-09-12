/**
 * Bakes the logo menu animation.
 *
 *   npm run build:menu
 *
 * monkey_bar.gif draws a red box around the 遠東 logo and then unfolds three
 * labelled boxes to its right: about us, privacy policy, terms of service.
 * A GIF cannot be seeked, paused or run backwards, and all three are needed
 * here, so its frames are baked out and a canvas scrubs them — the same
 * approach the splash uses.
 *
 * TWO THINGS THE BAKE HAS TO GET RIGHT.
 *
 * Alignment. The animation's first frame is the logo, and it has to sit
 * exactly where the page's own logo does or the menu will jump when it
 * opens. Both put the ink at x=46, y=28: the gif because that is where it
 * was drawn, and the page because its logo part's box starts at 45 with a
 * one-pixel inset from rounding the box outward. So the canvas sits at the
 * stage's top-left corner and nothing needs shifting — SHIFT is kept as the
 * place to correct it from if either side ever moves. Measured, not assumed:
 * a half-pixel error here reads as a double image the moment the menu opens.
 *
 * The pressed state. Hovering a box fills it black and turns its label
 * white. That cannot be done by drawing a rectangle over the frame — the
 * label would go with it — so each box gets a second image, built by
 * inverting everything inside it except the red outline, which stays red.
 *
 * ---------------------------------------------------------------------
 * THE FOURTH BOX, WHICH THE GIF DOES NOT HAVE.
 *
 * The cigarette pages need a way home, and on those pages the logo is the
 * menu's switch rather than a link, so home has to be one of the boxes. The
 * owner asked for another square on the same rules as the three that exist.
 *
 * It is not drawn by hand — it is the third box's own movement, moved along
 * one place. Measured off the bake rather than assumed:
 *
 *   - the boxes are 55 wide with a 9px gap, so the fourth sits at x=299
 *   - the gif unfolds one box every 40 frames exactly: box 1's connector
 *     starts at f51, box 2's at f91, box 3's at f131
 *   - each label is a linear fade over its last ten frames — the ink's
 *     extent never changes, only its darkness (f163..f169 step the darkest
 *     pixel 152, 128, 102, 76, 50, 26, 0)
 *
 * So frame 170+k is frame 169 with the strip that carries box 3's cycle
 * (x 226..290, which holds its connector, its square and its label, and
 * nothing else) copied from frame 130+k and moved 64px right. At k=0 that
 * strip is still blank, so the join is seamless; at k=39 the fourth box is
 * complete. The copied label is dropped on the way over — only red survives
 * — and the word "home" is faded in over it at whatever alpha box 3's label
 * is wearing in the frame being copied.
 *
 * The label itself is a checked-in coverage map, rendered in Chrome from the
 * owner's own webfont, because librsvg — which is what sharp rasterises SVG
 * with — ignores an @font-face even when the font is embedded as a data URI,
 * and there is no 'h' anywhere in the three existing labels to cut one from.
 * See menu-home-label.png's note in scripts/assets.
 *
 * The landing page does not want a home box, so it is not a separate bake:
 * that page simply stops at frame 170, which is the animation the gif drew.
 * `stops` in the geometry names the two lengths.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/monkey-bar.gif';
const HOME_LABEL = 'scripts/assets/menu-home-label.png';
const FRAMES_DIR = 'public/menu/frames';
const OUT_DIR = 'public/menu';
const GEOMETRY = 'lib/menu-geometry.json';

/** Backing-store scale. 2 is what a dense screen wants, and it makes the
 *  half-pixel alignment shift a whole pixel. */
const SS = 2;

/** Left shift in baked pixels, if the two ever stop lining up. */
const SHIFT = 0;

/**
 * Measured off the last frame. The three labelled boxes, and the red box
 * around the logo which is the toggle rather than a link. `home` is the one
 * the bake adds; it is on the row's own pitch, 9px after terms.
 */
const BOXES = [
  { id: 'about', label: 'About us', href: '/about', x: 109, y: 45, w: 53, h: 55 },
  { id: 'privacy', label: 'Privacy policy', href: '/privacy', x: 171, y: 45, w: 55, h: 55 },
  { id: 'terms', label: 'Terms of service', href: '/terms', x: 235, y: 45, w: 55, h: 55 },
  { id: 'home', label: 'Home', href: '/landing', x: 299, y: 45, w: 55, h: 55 },
];

/** The logo's own ink in the first frame — the hover target. */
const LOGO_HIT = { x: 46, y: 28, w: 38, h: 85 };

/**
 * The fourth box, in frames. One box every 40; box 3's cycle runs from the
 * frame before its connector starts (so the join is a no-op) to the end.
 */
const PERIOD = 40;
/** The strip that carries one box's whole cycle: its gap and its square. */
const CYCLE_STRIP = { x0: 226, x1: 290 };
/** How far along the fourth box sits. */
const PITCH = BOXES[3].x - BOXES[2].x;

const isRed = (r, g, b) => r - Math.max(g, b) > 40;

const buf = readFileSync(SRC);
const meta = await sharp(buf, { animated: true }).metadata();
const W = meta.width;
const H = meta.pageHeight;
const N = meta.pages;
const delays = meta.delay ?? [];
const frameMs = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 50;

console.log(`${SRC}: ${W}x${H}, ${N} frames, ~${frameMs}ms each (${(N * frameMs) / 1000}s)`);

rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

/** One frame, upscaled to the backing scale and shifted if it needs to be. */
async function bakedFrame(i) {
  const base = sharp(buf, { page: i })
    .flatten({ background: '#ffffff' })
    .resize({ width: W * SS, height: H * SS, kernel: 'nearest' });
  if (!SHIFT) return base;
  return base
    .extract({ left: SHIFT, top: 0, width: W * SS - SHIFT, height: H * SS })
    .extend({ right: SHIFT, background: '#ffffff' });
}

const RW = W * SS;
const RH = H * SS;

/** A baked frame as flat RGB, which is how the fourth box is assembled. */
async function rawFrame(i) {
  const { data } = await (await bakedFrame(i))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

const writeRaw = async (data, i) => {
  const out = await sharp(data, { raw: { width: RW, height: RH, channels: 3 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(i).padStart(3, '0')}.webp`, out);
  return out.length;
};

// ---- the gif's own frames -------------------------------------------------
let total = 0;
const source = [];
for (let i = 0; i < N; i++) {
  const data = await rawFrame(i);
  source[i] = data;
  total += await writeRaw(data, i);
}
console.log(`wrote ${N} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB)`);

// ---- the fourth box, built out of the third's movement --------------------
const label = await sharp(HOME_LABEL).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const LSIZE = label.info.width;
if (LSIZE !== BOXES[3].w * SS || label.info.height !== BOXES[3].h * SS) {
  throw new Error(`${HOME_LABEL} is ${label.info.width}x${label.info.height}, want ${BOXES[3].w * SS} square`);
}

/** How dark box 3's label is in this frame, 0 before it starts to arrive. */
function labelAlpha(data, box) {
  let darkest = 255;
  for (let y = box.y * SS; y < (box.y + box.h) * SS; y++) {
    for (let x = box.x * SS; x < (box.x + box.w) * SS; x++) {
      const o = (y * RW + x) * 3;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      if (isRed(r, g, b)) continue;
      if (r < darkest) darkest = r;
    }
  }
  return darkest >= 250 ? 0 : (255 - darkest) / 255;
}

const base = source[N - 1];
const added = [];
let addedBytes = 0;
for (let k = 0; k < PERIOD; k++) {
  const src = source[N - 1 - PERIOD + 1 + k]; // f130..f169 for a 170-frame gif
  const out = Buffer.from(base);

  // box 3's cycle, moved one place along, with its label left behind
  for (let y = 0; y < RH; y++) {
    for (let x = CYCLE_STRIP.x0 * SS; x < CYCLE_STRIP.x1 * SS; x++) {
      const from = (y * RW + x) * 3;
      const to = (y * RW + x + PITCH * SS) * 3;
      const r = src[from], g = src[from + 1], b = src[from + 2];
      const red = isRed(r, g, b);
      out[to] = red ? r : 255;
      out[to + 1] = red ? g : 255;
      out[to + 2] = red ? b : 255;
    }
  }

  // "home", wearing the alpha box 3's own label is wearing
  const alpha = labelAlpha(src, BOXES[2]);
  if (alpha > 0) {
    const bx = BOXES[3].x * SS;
    const by = BOXES[3].y * SS;
    for (let y = 0; y < LSIZE; y++) {
      for (let x = 0; x < LSIZE; x++) {
        const cov = label.data[(y * LSIZE + x) * 3] / 255;
        if (!cov) continue;
        const o = ((by + y) * RW + bx + x) * 3;
        const keep = 1 - cov * alpha;
        out[o] = Math.round(out[o] * keep);
        out[o + 1] = Math.round(out[o + 1] * keep);
        out[o + 2] = Math.round(out[o + 2] * keep);
      }
    }
  }

  added[k] = out;
  addedBytes += await writeRaw(out, N + k);
}
const TOTAL_FRAMES = N + PERIOD;
console.log(
  `wrote ${PERIOD} more for the home box, f${N}..f${TOTAL_FRAMES - 1} ` +
    `(${Math.round(addedBytes / 1024)}KB)`,
);

// ---- the pressed state of each box ---------------------------------------
// Each box is read out of the last frame it is complete in: the gif's own for
// the three it drew, the built one for home.
const lastOf = (box) => (box.id === 'home' ? added[PERIOD - 1] : source[N - 1]);

for (const box of BOXES) {
  const src = lastOf(box);
  const x0 = box.x * SS;
  const y0 = box.y * SS;
  const bw = box.w * SS;
  const bh = box.h * SS;
  const out = Buffer.alloc(bw * bh * 3);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const o = ((y0 + y) * RW + (x0 + x)) * 3;
      const [r, g, b] = [src[o], src[o + 1], src[o + 2]];
      const t = (y * bw + x) * 3;
      if (isRed(r, g, b)) {
        // the outline is the box's own colour and stays put
        out[t] = r;
        out[t + 1] = g;
        out[t + 2] = b;
      } else {
        // white ground becomes black, black label becomes white, and every
        // antialiased step between them swaps with it
        out[t] = 255 - r;
        out[t + 1] = 255 - g;
        out[t + 2] = 255 - b;
      }
    }
  }
  const png = await sharp(out, { raw: { width: bw, height: bh, channels: 3 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(`${OUT_DIR}/${box.id}-pressed.webp`, png);
  console.log(`  ${box.id}-pressed.webp ${bw}x${bh} ${Math.round(png.length / 1024)}KB`);
}

/**
 * How far to play, and how wide the canvas has to be to hold it. The canvas
 * is opaque white, so it is cut to the animation's own content and no wider —
 * on the landing page that is what keeps it off the seal at x=315.
 */
// Enough that the white ground does not stop dead on the last box's outline,
// and no more: with the home box the bar reaches 354, and a 360px phone — the
// commonest Android width there is — has exactly that much room. At 10 the
// canvas was 364 and scrolled those pages sideways by four pixels.
const SLACK = 6;
const STOPS = {
  base: {
    frames: N,
    viewW: Math.ceil(BOXES[2].x + BOXES[2].w + SLACK),
    boxes: BOXES.slice(0, 3).map((b) => b.id),
  },
  home: {
    frames: TOTAL_FRAMES,
    viewW: Math.ceil(BOXES[3].x + BOXES[3].w + SLACK),
    boxes: BOXES.map((b) => b.id),
  },
};

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:menu — do not edit by hand.',
      frame: { w: W, h: H, scale: SS },
      frames: TOTAL_FRAMES,
      frameMs,
      // the shift is already baked in; the canvas sits at a whole pixel
      shiftedBy: SHIFT / SS,
      logoHit: LOGO_HIT,
      boxes: BOXES,
      stops: STOPS,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
console.log(`  stops: base ${STOPS.base.frames} frames / ${STOPS.base.viewW}px, home ${STOPS.home.frames} / ${STOPS.home.viewW}px`);
