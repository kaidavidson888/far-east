/**
 * Bakes the splash animation (scripts/assets/login-source.gif) into a full set
 * of scrubbable WebP stills — a faithful copy of the original, changed only in
 * colour and sharpness:
 *   red #EC2628 / #FF0000  → #FF0000  (true red)
 *   black                   → #000000
 *   white                   → left as #FFFFFF
 * rendered at full resolution with a light unsharp pass.
 *
 *   npm run build:splash
 *
 * Output: public/splash/frames/f000.webp … f100.webp (101 frames, 40ms apart —
 * exactly the source timing, 4.0s). The GIF's frames are patches that composite
 * on top of each other (disposal type 1), so we accumulate them and snapshot
 * each step. Commit the results — nothing decodes the GIF at runtime.
 */
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const SRC = 'scripts/assets/login-source.gif';
const OUT = 'public/splash/frames';
const WIDTH = 640; // canvas renders 1:1 and CSS scales it up; sharper than the source GIF
const QUALITY = 80;
const STRIDE = 1; // every frame — this is a 1:1 copy of the animation

const RED = [0xff, 0x00, 0x00];
const INK = [0x00, 0x00, 0x00];

// Steepen the anti-aliased coverage so faint pixels snap toward paper and mid
// pixels toward full colour — sharpens the line-work without changing the art.
const crisp = (c) => {
  const t = c < 0 ? 0 : c > 1 ? 1 : c;
  return t < 0.16 ? 0 : t > 0.92 ? 1 : (t - 0.16) / 0.76;
};

function recolor(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);
    if (max > 250 && chroma < 8) continue; // white paper — leave it
    if (chroma < 24) {
      const cov = crisp(1 - max / 255); // achromatic → ink by darkness
      d[i] = 255 + (INK[0] - 255) * cov;
      d[i + 1] = 255 + (INK[1] - 255) * cov;
      d[i + 2] = 255 + (INK[2] - 255) * cov;
    } else if (r === max) {
      const cov = crisp(1 - (g + b) / 510); // red line-work → red by coverage
      d[i] = 255 + (RED[0] - 255) * cov;
      d[i + 1] = 255 + (RED[1] - 255) * cov;
      d[i + 2] = 255 + (RED[2] - 255) * cov;
    }
  }
}

const gif = parseGIF(readFileSync(SRC));
const frames = decompressFrames(gif, true);
const W = gif.lsd.width, H = gif.lsd.height;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const acc = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { acc[i*4]=255; acc[i*4+1]=255; acc[i*4+2]=255; acc[i*4+3]=255; }

let written = 0;
for (let n = 0; n < frames.length; n++) {
  const f = frames[n];
  const { width: fw, height: fh, top, left } = f.dims;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const pi = (y * fw + x) * 4;
      if (f.patch[pi + 3] === 0) continue;
      const cx = left + x, cy = top + y;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const ci = (cy * W + cx) * 4;
      acc[ci] = f.patch[pi];
      acc[ci + 1] = f.patch[pi + 1];
      acc[ci + 2] = f.patch[pi + 2];
      acc[ci + 3] = 255;
    }
  }

  const isLast = n === frames.length - 1;
  if (n % STRIDE !== 0 && !isLast) continue;

  const snap = Buffer.from(acc);
  recolor(snap);
  const png = new PNG({ width: W, height: H });
  snap.copy(png.data);
  const name = `${OUT}/f${String(written).padStart(3, '0')}.webp`;
  await sharp(PNG.sync.write(png))
    .resize({ width: WIDTH })
    .sharpen({ sigma: 0.5 })
    .webp({ quality: QUALITY })
    .toFile(name);
  written++;
}

console.log(`wrote ${written} frames to ${OUT}/ (${W}x${H} → ${WIDTH}px wide, stride ${STRIDE})`);
