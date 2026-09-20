/**
 * TRACING ONE OF THE OWNER'S MARKS INTO A PATH.
 *
 * They supply pictures, not vectors, and the buttons these marks sit in invert
 * under the pointer — so each has to be drawn inline and filled with
 * `currentColor`, which means a path (lib/cigToggleGlyph.ts says the same of
 * the plus and the minus). This is the shared machinery: threshold, an
 * optional opening of the white, marching squares round every boundary, and
 * Douglas-Peucker to thin the result.
 *
 * STRAIGHT SEGMENTS, NOT FITTED CURVES. A mark is traced at 1200px and drawn
 * at 16, so a vertex every couple of source px is finer than any screen will
 * show, and a polygon has no curve-fitting to get wrong. Holes need no
 * bookkeeping either: the path is filled EVEN-ODD, so a loop inside a loop is
 * a hole.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

/** Euclidean distance to the nearest set cell, by a two-pass chamfer. */
export function distanceTo(mask, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? 0 : INF;
  const D2 = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = d[i];
    if (y > 0) { if (x > 0) v = Math.min(v, d[i - W - 1] + D2); v = Math.min(v, d[i - W] + 1); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D2); }
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    let v = d[i];
    if (y < H - 1) { if (x < W - 1) v = Math.min(v, d[i + W + 1] + D2); v = Math.min(v, d[i + W] + 1); if (x > 0) v = Math.min(v, d[i + W - 1] + D2); }
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
    d[i] = v;
  }
  return d;
}

/**
 * The picture as an ink mask, with a white border all round so a mark that
 * touches the frame still closes its loops.
 *
 * Returns the mask and the geometry a caller needs to reason in the source's
 * own pixels: `at(x, y)` and `set(x, y, v)` work in those, `W0`/`H0` are its
 * size, and `grey` is the greyscale it was thresholded from.
 */
export async function inkMask(src, { trace = 1200, pad = 16 } = {}) {
  const meta = await sharp(src).metadata();
  const scale = trace / Math.max(meta.width, meta.height);
  const W0 = Math.round(meta.width * scale), H0 = Math.round(meta.height * scale);
  const { data: grey } = await sharp(src).resize({ width: W0, height: H0, fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = W0 + pad * 2, H = H0 + pad * 2;
  const ink = new Uint8Array(W * H);
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) ink[(y + pad) * W + x + pad] = grey[y * W0 + x] < 128 ? 1 : 0;
  return {
    ink, grey, W, H, W0, H0, pad, source: `${meta.width}x${meta.height}`,
    at: (x, y) => ink[(y + pad) * W + x + pad],
    set: (x, y, v) => { ink[(y + pad) * W + x + pad] = v; },
    count: () => ink.reduce((a, b) => a + b, 0),
  };
}

/**
 * Take `r` px off every edge of the ink — a real disc, by distance.
 *
 * The distance wanted is to the nearest WHITE, so the mask handed to
 * `distanceTo` is the complement: ink deeper than `r` from any white survives.
 * (Passing the ink itself measures the other way round and GROWS the mark —
 * it turned the glass into a blob at 171% of its ink before this said so.)
 */
export function erode(m, r) {
  if (r <= 0) return;
  const white = new Uint8Array(m.W * m.H);
  for (let i = 0; i < m.W * m.H; i++) white[i] = m.ink[i] ? 0 : 1;
  const d = distanceTo(white, m.W, m.H);
  for (let i = 0; i < m.W * m.H; i++) m.ink[i] = d[i] > r ? 1 : 0;
}

/**
 * Every boundary of the mask, as closed loops of edge midpoints.
 *
 * Each cell is the square between four samples; an edge of the boundary runs
 * through it wherever its samples disagree, and walking from edge to edge
 * closes a loop. The two saddle cases (5 and 10) are read as INK JOINED, so a
 * diagonal pair stays one shape rather than splitting in two.
 */
export function contours({ ink, W, H }) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : ink[y * W + x]);
  const caseOf = (x, y) => (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
  const mid = (x, y, e) => (e === 0 ? [x + 0.5, y] : e === 1 ? [x + 1, y + 0.5] : e === 2 ? [x + 0.5, y + 1] : [x, y + 0.5]);
  const SEG = {
    1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[1, 0]], 5: [[3, 0], [1, 2]], 6: [[2, 0]], 7: [[3, 0]],
    8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[0, 1]], 12: [[1, 3]], 13: [[1, 2]], 14: [[2, 3]],
  };
  const key = (x, y, e) => `${x},${y},${e}`;
  const canon = (x, y, e) => (e === 2 ? key(x, y + 1, 0) : e === 1 ? key(x + 1, y, 3) : key(x, y, e));
  const next = new Map();
  const pos = new Map();
  for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
    const segs = SEG[caseOf(x, y)];
    if (!segs) continue;
    for (const [a, b] of segs) {
      const ka = canon(x, y, a), kb = canon(x, y, b);
      next.set(ka, kb);
      pos.set(ka, mid(x, y, a));
      pos.set(kb, mid(x, y, b));
    }
  }
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const pts = [];
    let k = start;
    while (k && !seen.has(k)) {
      seen.add(k);
      pts.push(pos.get(k));
      k = next.get(k);
    }
    if (k !== start) continue; // an open run cannot happen inside the white border
    loops.push(pts);
  }
  return loops;
}

export const loopArea = (p) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
};

/** Douglas-Peucker on a closed loop: opened at its two furthest points. */
export function simplify(p, eps) {
  if (p.length < 8) return p;
  let far = 0, best = -1;
  for (let i = 1; i < p.length; i++) { const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2; if (d > best) { best = d; far = i; } }
  const dp = (a) => {
    const keep = new Uint8Array(a.length);
    keep[0] = keep[a.length - 1] = 1;
    const stack = [[0, a.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop();
      const [ax, ay] = a[i], [bx, by] = a[j];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      let m = -1, md = eps;
      for (let t = i + 1; t < j; t++) { const d = Math.abs((a[t][0] - ax) * dy - (a[t][1] - ay) * dx) / L; if (d > md) { md = d; m = t; } }
      if (m > 0) { keep[m] = 1; stack.push([i, m], [m, j]); }
    }
    return a.filter((_, t) => keep[t]);
  };
  const h1 = dp(p.slice(0, far + 1)), h2 = dp([...p.slice(far), p[0]]);
  return [...h1.slice(0, -1), ...h2.slice(0, -1)];
}

/**
 * The loops as one even-odd path in a box 100 units across its long side —
 * two decimals there is a fortieth of a source px, and the numbers stay short.
 */
export function toPath(loops) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of loops) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const bw = x1 - x0, bh = y1 - y0;
  const U = 100 / Math.max(bw, bh);
  const n2 = (v) => +v.toFixed(2);
  const d = loops.map((p) => `M${p.map(([x, y]) => `${n2((x - x0) * U)} ${n2((y - y0) * U)}`).join('L')}Z`).join('');
  return { d, vw: n2(bw * U), vh: n2(bh * U), points: loops.reduce((s, p) => s + p.length, 0) };
}

/** Everything above, in one call: a picture in, a path out. */
export async function traceMark(src, { trace = 1200, open = 0, eps = 1.6, minArea = 60, before } = {}) {
  const m = await inkMask(src, { trace, pad: Math.ceil(open) + 4 });
  if (before) before(m);
  const inkBefore = m.count();
  erode(m, open);
  const loops = contours(m).filter((p) => Math.abs(loopArea(p)) >= minArea).map((p) => simplify(p, eps));
  if (!loops.length) throw new Error(`trace-mark: nothing was traced out of ${src}`);
  return { ...toPath(loops), loops: loops.length, inkBefore, inkAfter: m.count(), source: m.source, traced: `${m.W0}x${m.H0}` };
}

export const readSvgText = (p) => readFileSync(p, 'utf8');
