/**
 * THE MENU BUTTON'S MARK: the owner's mountain, cut out of their own vector.
 *
 * The vector (scripts/assets/mountain.svg) is drawn as a picture: a red sky, a
 * white mountain filling the frame, and a black tipi at the summit. The owner's
 * 2026-09-19 ask makes it a mark instead — "make the mountain black and the
 * tipi black with a white outline the same thickness as the outline box" — so
 * the sky goes, the mountain becomes the ink, and the tipi is separated from
 * the mountain it now shares a colour with by a white rule of the box's own
 * weight.
 *
 * The three regions are read off a RENDER, not out of the path data: the
 * mountain is not a shape in the file at all, it is the white paper the sky
 * does not cover, so pixels are the only honest way to ask where it is.
 *
 * Everything here works in DEVICE px (the caller's SS), supersampled by `OVER`
 * and box-filtered down, which is what gives the small mark a clean edge.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/mountain.svg';
/** Supersampling for the classification pass. */
const OVER = 8;

const isRed = (r, g, b) => r > 200 && g < 110 && b < 110;
const isBlack = (r, g, b) => r < 90 && g < 90 && b < 90;

/** A mask's ink box, or null. */
function maskBox(m, w, h) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Grow a mask by `r` cells (chebyshev-free: a real disc, via a distance pass). */
function dilate(m, w, h, r) {
  const d = distanceTo(m, w, h);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i] <= r ? 1 : 0;
  return out;
}

/**
 * Euclidean distance from every cell to the nearest set cell (0 inside the
 * mask). Two-pass chamfer, which is within a few per cent of exact and is all
 * a 2px rule needs.
 */
export function distanceTo(m, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? 0 : INF;
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i];
    if (y > 0) {
      if (x > 0) v = Math.min(v, d[i - w - 1] + D2);
      v = Math.min(v, d[i - w] + D1);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2);
    }
    if (x > 0) v = Math.min(v, d[i - 1] + D1);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i];
    if (y < h - 1) {
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2);
      v = Math.min(v, d[i + w] + D1);
      if (x > 0) v = Math.min(v, d[i + w - 1] + D2);
    }
    if (x < w - 1) v = Math.min(v, d[i + 1] + D1);
    d[i] = v;
  }
  return d;
}

/** Box-filter a supersampled mask down to coverage in [0,1]. */
function down(m, W, H, over) {
  const w = W / over, h = H / over;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (let sy = 0; sy < over; sy++) for (let sx = 0; sx < over; sx++) {
      n += m[(y * over + sy) * W + x * over + sx];
    }
    out[y * w + x] = n / (over * over);
  }
  return out;
}

/**
 * The mark at `w` x `h` device px.
 *
 * `rule` is the white outline's weight, in the same device px — the box's own
 * rule, so the two read as one drawing.
 *
 * Returns coverage fields in [0,1]:
 *   body   the whole silhouette, mountain and tipi together
 *   ink    what is actually painted black: the silhouette less the white rule
 *   tipi   the tipi alone
 *   ring   the white rule round the tipi, clipped to the silhouette
 */
export async function badgeMark(w, h, rule) {
  const W = w * OVER, H = h * OVER;
  const { data } = await sharp(readFileSync(SRC), { density: 300 })
    .resize({ width: W, height: H, fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sky = new Uint8Array(W * H);
  const tipi = new Uint8Array(W * H);
  for (let i = 0, o = 0; i < W * H; i++, o += 3) {
    const r = data[o], g = data[o + 1], b = data[o + 2];
    if (isRed(r, g, b)) sky[i] = 1;
    else if (isBlack(r, g, b)) tipi[i] = 1;
  }
  const body = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) body[i] = sky[i] ? 0 : 1;
  const tb = maskBox(tipi, W, H);
  const bb = maskBox(body, W, H);
  if (!tb || !bb) throw new Error('badge-mark: the vector did not give a mountain and a tipi');
  // the source is a full-bleed picture: the mountain reaches every edge but the top
  if (bb.w !== W || bb.y + bb.h !== H) {
    throw new Error(`badge-mark: the mountain does not fill the frame (${JSON.stringify(bb)} of ${W}x${H})`);
  }
  // the white rule stands OUTSIDE the tipi and is clipped to the mountain, so
  // where the tipi's own edge is the mountain's edge — its two upper sides are
  // the summit — nothing is drawn and nothing spills into the sky
  const grown = dilate(tipi, W, H, rule * OVER);
  const ring = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ring[i] = grown[i] && !tipi[i] && body[i] ? 1 : 0;
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ink[i] = body[i] && !ring[i] ? 1 : 0;
  return {
    w,
    h,
    body: down(body, W, H, OVER),
    ink: down(ink, W, H, OVER),
    tipi: down(tipi, W, H, OVER),
    ring: down(ring, W, H, OVER),
    /** The tipi's box at the mark's own size, for anything that has to avoid it. */
    tipiBox: { x: tb.x / OVER, y: tb.y / OVER, w: tb.w / OVER, h: tb.h / OVER },
  };
}

/** The mark's aspect, straight off the vector (width / height of the silhouette). */
export async function markAspect() {
  const R = 512;
  const { data } = await sharp(readFileSync(SRC), { density: 300 })
    .resize({ width: R, height: R, fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let top = R;
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const o = (y * R + x) * 3;
      if (!isRed(data[o], data[o + 1], data[o + 2])) { top = Math.min(top, y); break; }
    }
    if (top < R) break;
  }
  return R / (R - top);
}
