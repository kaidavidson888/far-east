/**
 * THE OWNER'S MENU GIF, READ ONCE.
 *
 * `scripts/assets/monkey-grow.gif` is the source of the six words two menus
 * are built from — the three across the top of the landing page, and the three
 * that used to hang under it and now belong to the dots button. Nothing of its
 * ANIMATION is used by either: both grow their own (scripts/lib/ink-growth.mjs).
 * What is taken is the drawing of the words on its last frame, and the scale
 * and the box they are laid out against.
 *
 * Everything here is measured every build and every measurement is checked, so
 * a different gif fails loudly rather than shifting the words half a pixel.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/monkey-grow.gif';
const LANDING = 'lib/landing-geometry.json';

/** Letters join into a phrase at this radius and phrases do not — page px. */
const DILATE_PAGE = 4.5;
const MIN_INK = 400;

const isPaper = (r, g, b) => r > 244 && g > 244 && b > 244;

export async function openMenuGif(label = 'menu', { ss = 2 } = {}) {
  /** The backing-store scale the caller bakes at: renderPiece draws into it. */
  const SS = ss;
  const fail = (msg) => {
    throw new Error(`${label}: ${msg}`);
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



  return {
    SRC, W, H, N, frameMs, K, START, BOX, last, isPaper, low, inkBox,
    pageX, pageY, gifX, gifY, topWords, stackWords, glyphMask, components, lineBands, renderPiece,
  };
}
