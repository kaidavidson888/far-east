/**
 * Bakes the login splash animation into recoloured WebP stills.
 *
 *   npm run build:splash
 *
 * Source: scripts/assets/login-source.gif (pure-red / black line-art on white).
 * Output: public/splash/frames/f000.webp … f100.webp  (101 frames, 40ms apart)
 *
 * The GIF frames are patches that composite on top of each other (disposal
 * type 1), so we accumulate them and snapshot each step. Colours are remapped:
 *   red  #FF0000  → #FF3131
 *   black          → #000000
 *   white          → left as #FFFFFF
 * Rerun this whenever the source GIF or the palette changes, and commit the
 * results — nothing decodes the GIF at runtime.
 */
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const SRC = 'scripts/assets/login-source.gif';
const OUT = 'public/splash/frames';
const WIDTH = 400; // output frame width; the animation is full-bleed and in motion
const QUALITY = 78;

const RED = [0xff, 0x31, 0x31];
const INK = [0x00, 0x00, 0x00];

function recolor(d) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);
    if (max > 250 && chroma < 8) continue; // white paper — leave it
    if (chroma < 24) {
      const cov = 1 - max / 255; // achromatic → ink by darkness
      d[i] = 255 + (INK[0] - 255) * cov;
      d[i + 1] = 255 + (INK[1] - 255) * cov;
      d[i + 2] = 255 + (INK[2] - 255) * cov;
    } else if (r === max) {
      const cov = 1 - (g + b) / 510; // red line-work → red by coverage
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

// Full-res accumulator, started on white.
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

  const snap = Buffer.from(acc);
  recolor(snap);
  const png = new PNG({ width: W, height: H });
  snap.copy(png.data);
  const name = `${OUT}/f${String(n).padStart(3, '0')}.webp`;
  await sharp(PNG.sync.write(png)).resize({ width: WIDTH }).webp({ quality: QUALITY }).toFile(name);
  written++;
}

console.log(`wrote ${written} frames to ${OUT}/ (${W}x${H} → ${WIDTH}px wide)`);
