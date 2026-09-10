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
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/monkey-bar.gif';
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
 * around the logo which is the toggle rather than a link.
 */
const BOXES = [
  { id: 'about', label: 'About us', href: '/about', x: 109, y: 45, w: 53, h: 55 },
  { id: 'privacy', label: 'Privacy policy', href: '/privacy', x: 171, y: 45, w: 55, h: 55 },
  { id: 'terms', label: 'Terms of service', href: '/terms', x: 235, y: 45, w: 55, h: 55 },
];

/** The logo's own ink in the first frame — the hover target. */
const LOGO_HIT = { x: 46, y: 28, w: 38, h: 85 };

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

let total = 0;
for (let i = 0; i < N; i++) {
  const out = await (await bakedFrame(i)).webp({ lossless: true, effort: 6 }).toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(i).padStart(3, '0')}.webp`, out);
  total += out.length;
}
console.log(`wrote ${N} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB)`);

// ---- the pressed state of each box ---------------------------------------
const last = await (await bakedFrame(N - 1)).raw().toBuffer({ resolveWithObject: true });
const LW = last.info.width;
const LC = last.info.channels;

for (const box of BOXES) {
  const x0 = box.x * SS;
  const y0 = box.y * SS;
  const bw = box.w * SS;
  const bh = box.h * SS;
  const out = Buffer.alloc(bw * bh * 3);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const o = ((y0 + y) * LW + (x0 + x)) * LC;
      const [r, g, b] = [last.data[o], last.data[o + 1], last.data[o + 2]];
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

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:menu — do not edit by hand.',
      frame: { w: W, h: H, scale: SS },
      frames: N,
      frameMs,
      // the shift is already baked in; the canvas sits at a whole pixel
      shiftedBy: SHIFT / SS,
      logoHit: LOGO_HIT,
      boxes: BOXES,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
