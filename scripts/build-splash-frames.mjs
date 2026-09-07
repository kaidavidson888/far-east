/**
 * Bakes the login splash animation into recoloured WebP stills.
 *
 *   npm run build:splash
 *
 * Source: scripts/assets/login-source.gif (pure-red / black line-art on white).
 * Output: public/splash/frames/f000.webp … f050.webp  (every 2nd source frame,
 * 51 stills 80ms apart — still 4.00s, half the bytes, plenty smooth for the bloom)
 *
 * The GIF frames are patches that composite on top of each other (disposal
 * type 1), so we accumulate them and snapshot each step. Colours are remapped:
 *   red  #FF0000  → #FF0000  (true red)
 *   black          → #000000
 *   white          → left as #FFFFFF
 * The centre region is knocked back to white: the seal, the transient outline
 * boxes and the login card are drawn as crisp DOM/SVG on top — only the clouds
 * come from these frames.
 * Rerun this whenever the source GIF or the palette changes, and commit the
 * results — nothing decodes the GIF at runtime.
 */
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const SRC = 'scripts/assets/login-source.gif';
const OUT = 'public/splash/frames';
const WIDTH = 560; // canvas renders these 1:1, CSS scales the element
const QUALITY = 90;
const STRIDE = 2; // keep every Nth source frame

const RED = [0xff, 0x00, 0x00];
const INK = [0x00, 0x00, 0x00];

// Centre knockout (fractions of the frame): where the DOM box elements live.
// Feathered so the clouds fade out into it rather than meeting a hard edge.
const KO = { x0: 0.30, x1: 0.70, y0: 0.40, y1: 0.60, feather: 0.035 };

// Steepen the anti-aliased coverage so faint pixels snap toward paper and
// mid pixels toward full colour — keeps the line-work from reading as a haze.
const crisp = (c) => {
  const t = c < 0 ? 0 : c > 1 ? 1 : c;
  return t < 0.18 ? 0 : t > 0.9 ? 1 : (t - 0.18) / 0.72;
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

// Fade every pixel in the centre rectangle toward white, softening the edge
// over `feather` so there's no visible seam behind the DOM box.
function knockout(d) {
  const x0 = KO.x0 * W, x1 = KO.x1 * W, y0 = KO.y0 * H, y1 = KO.y1 * H;
  const fx = KO.feather * W, fy = KO.feather * H;
  for (let y = 0; y < H; y++) {
    const sy = Math.min((y - (y0 - fy)) / fy, ((y1 + fy) - y) / fy, 1);
    if (sy <= 0) continue;
    for (let x = 0; x < W; x++) {
      const sx = Math.min((x - (x0 - fx)) / fx, ((x1 + fx) - x) / fx, 1);
      const k = Math.min(sx, sy);
      if (k <= 0) continue;
      const i = (y * W + x) * 4;
      d[i] = d[i] + (255 - d[i]) * k;
      d[i + 1] = d[i + 1] + (255 - d[i + 1]) * k;
      d[i + 2] = d[i + 2] + (255 - d[i + 2]) * k;
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

  // The accumulator must see every source frame, but we only emit every STRIDE-th
  // (and always the final frame).
  const isLast = n === frames.length - 1;
  if (n % STRIDE !== 0 && !isLast) continue;

  const snap = Buffer.from(acc);
  recolor(snap);
  knockout(snap);
  const png = new PNG({ width: W, height: H });
  snap.copy(png.data);
  const name = `${OUT}/f${String(written).padStart(3, '0')}.webp`;
  await sharp(PNG.sync.write(png))
    .resize({ width: WIDTH })
    .sharpen({ sigma: 0.6 })
    .webp({ quality: QUALITY })
    .toFile(name);
  written++;
}

console.log(`wrote ${written} frames to ${OUT}/ (${W}x${H} → ${WIDTH}px wide, stride ${STRIDE})`);
