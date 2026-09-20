/**
 * INK THAT GROWS: the machinery behind the landing menu's animation.
 *
 * The owner's 2026-09-19 ask: "make sure the animation grows into the text
 * like branches or flowing water that is interconnected but sprouts more
 * connected paths as it flows outward", in the seal button's language, "where
 * the black leaves traces in the white as if it is draining as the text is
 * written".
 *
 * So this is not a drawing being uncovered. A network of channels is grown out
 * of the button and rasterised frame by frame:
 *
 *   - A CHANNEL is a polyline with a width that tapers along it, a time it
 *     starts, and a speed. At any moment it is drawn up to the arc length its
 *     front has reached, so the same network plays forwards (growing) and
 *     backwards (draining away) with nothing to bake twice.
 *
 *   - THREE KINDS OF CHILD come off a channel, and the three together are what
 *     the owner asked for:
 *       * a BYPASS leaves the channel and REJOINS it further along, bowing out
 *         — a braided stream's island. This is the interconnection: a tree can
 *         only ever split, and water does not.
 *       * a BRANCH leaves and keeps going, and sprouts children of its own.
 *       * a TWIG is short and ends in a CURL — the seal's cloud filigree, which
 *         is what the drawing this menu came from is made of.
 *     They are spawned at intervals that SHORTEN with distance from the button,
 *     so the network thickens as it flows outward rather than thinning.
 *
 *   - THE FRONT of a channel is a real position at a real time, so a word can
 *     be written by it: the bake asks where the front is and reveals the word
 *     up to that column.
 *
 * Everything is deterministic: one seeded PRNG, no wall clock, no Math.random,
 * so a rebuild is byte-identical.
 */

/** A small, fast, seeded PRNG — deterministic across machines. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/** A Catmull-Rom spline through the given points, sampled every `step`. */
export function spline(way, step = 0.5) {
  if (way.length < 2) return way.slice();
  const pts = [way[0]];
  const P = [way[0], ...way, way[way.length - 1]];
  for (let i = 1; i + 2 < P.length; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const seg = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let j = 1; j <= seg; j++) {
      const t = j / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return pts;
}

/**
 * A curl, continuing from `at` in direction `dir` (radians): an Archimedean
 * spiral whose radius runs out, which is how the seal's clouds end. `sign`
 * picks the handedness.
 */
export function curl(at, dir, r0, turns, sign, step = 0.5) {
  const pts = [];
  // the centre sits one radius to the side of the heading, so the spiral
  // leaves the stroke tangentially rather than kinking
  const cx = at.x + Math.cos(dir + (sign * Math.PI) / 2) * r0;
  const cy = at.y + Math.sin(dir + (sign * Math.PI) / 2) * r0;
  const a0 = Math.atan2(at.y - cy, at.x - cx);
  const total = turns * Math.PI * 2;
  const n = Math.max(6, Math.ceil((r0 * total) / step));
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = a0 + sign * total * u;
    const r = r0 * Math.pow(1 - u, 0.65);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Cumulative arc length along a polyline. */
export function arcs(pts) {
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + dist(pts[i - 1], pts[i]);
  return cum;
}

/** A channel: a polyline that is drawn up to wherever its front has reached. */
export function channel({ pts, w0, w1, t0 = 0, speed = 1, depth = 0, id = null }) {
  const cum = arcs(pts);
  const len = cum[cum.length - 1];
  return { id, pts, cum, len, w0, w1, t0, dur: Math.max(1e-6, len / speed), depth };
}

/** The point at arc length `s` along a channel, and the heading there. */
export function atArc(c, s) {
  const { pts, cum } = c;
  if (s <= 0) return { ...pts[0], dir: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), s: 0 };
  if (s >= c.len) {
    const n = pts.length - 1;
    return { ...pts[n], dir: Math.atan2(pts[n].y - pts[n - 1].y, pts[n].x - pts[n - 1].x), s: c.len };
  }
  let lo = 0, hi = pts.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const t = (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
  const a = pts[lo], b = pts[hi];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), dir: Math.atan2(b.y - a.y, b.x - a.x), s };
}

/** How far along a channel its front has reached at time `t` (arc length). */
export function frontArc(c, t) {
  const u = (t - c.t0) / c.dur;
  return u <= 0 ? -1 : u >= 1 ? c.len : u * c.len;
}

/** The width of a channel at arc length `s`. */
export const widthAt = (c, s) => lerp(c.w0, c.w1, Math.min(1, s / Math.max(1e-6, c.len)));

/**
 * Cut a polyline where it first leaves the region it is allowed in, and say
 * how long what is left is. A child that leaves the band is shortened rather
 * than moved: the band is the page, and a stroke that would run off it is one
 * nobody would ever see the end of.
 */
function clipTo(pts, inside) {
  if (!inside) return pts;
  let n = 1;
  while (n < pts.length && inside(pts[n].x, pts[n].y)) n++;
  return n === pts.length ? pts : pts.slice(0, n);
}
const plen = (pts) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
};

/**
 * Grow children off a channel, and their children, into `out`.
 *
 * `p` carries the rule:
 *   gap0/gap1     the spacing between children at the start and the end of the
 *                 run — gap1 < gap0 is what makes it sprout MORE as it flows
 *                 outward rather than fewer
 *   lens          how long a child is at each depth, in page px. A LENGTH, not
 *                 a fraction of the parent: the run along the top row is 400px
 *                 and half of what is left of it is a cane, not a branch.
 *   angle         how far off the parent's heading a child leaves
 *   maxDepth      how many generations
 *   bypass        the chance a child is a bypass that rejoins its parent
 *   twig          the chance it is a short one ending in a curl
 *   inside(x,y)   the band this run is allowed to grow in
 */
/**
 * An arc leaving `here` at `turn` off the heading and bending by `bend` over
 * its length: the shape every child is made of. A run of short steps rather
 * than a curve fitted to endpoints, so the bend is felt all the way along —
 * which is what makes it read as a current rather than a strut.
 */
function arc(here, turn, bend, len, steps = 5) {
  const way = [{ x: here.x, y: here.y }];
  let d = here.dir + turn;
  let pt = { x: here.x, y: here.y };
  for (let i = 1; i <= steps; i++) {
    d += bend / steps;
    pt = { x: pt.x + Math.cos(d) * (len / steps), y: pt.y + Math.sin(d) * (len / steps) };
    way.push(pt);
  }
  return way;
}

export function sprout(parent, p, rng, out, depth = 1) {
  if (depth > p.maxDepth || parent.len < p.minLen) return;
  const start = parent.len * (depth === 1 ? p.start0 : 0.18);
  let s = start + rng() * p.gap0 * 0.5;
  let side = rng() < 0.5 ? 1 : -1;
  /**
   * Try a child to one side and then to the other, and take the first that
   * fits the band. WITHOUT THIS THE BAND THINS THE GROWTH RATHER THAN SHAPING
   * IT: the run along the top row has the words under it, so every child that
   * happened to point down was dropped and the whole row grew upward only.
   */
  const bothSides = (here, make) => {
    let best = null;
    // BIASED TOWARD THE OPEN SIDE. Strict alternation sends half of everything
    // into whatever the run is hugging — the page's top edge, on a row that
    // sits a few pixels under it — and those are the children the band cuts
    // down to ticks. `bias` is the chance of taking the +y side instead.
    const down = Math.sign(Math.cos(here.dir)) || 1;
    if (p.bias) side = rng() < p.bias ? down : -down;
    for (const sg of [side, -side]) {
      const pts = make(sg);
      const cut = clipTo(pts, p.inside);
      if (plen(cut) >= plen(pts) * 0.8) return { pts: cut, sign: sg };
      if (!best || plen(cut) > plen(best.pts)) best = { pts: cut, sign: sg };
    }
    // A STUB IS WORSE THAN NOTHING. A child cut down to a few pixels by the
    // band reads as a tick across the channel, which is what the first bake
    // was covered in; either it has room to be a stroke or it does not grow.
    return best && plen(best.pts) >= Math.max(p.minLen * 2, 9) ? best : null;
  };
  while (s < parent.len * 0.97) {
    const u = s / parent.len;
    const gap = lerp(p.gap0, p.gap1, u) * (0.75 + rng() * 0.5);
    const here = atArc(parent, s);
    const w = widthAt(parent, s);
    const left = parent.len - s;
    const born = parent.t0 + (s / parent.len) * parent.dur;
    const r = rng();
    if (r < p.bypass && left > p.bypassLen * 1.4 && depth <= 2) {
      // A BRAID: out of the channel and back onto it further along, bowing to
      // one side. A tree can only split; water rejoins, and this is what says
      // so. Whole or not at all — half a braid is a twig.
      const back = Math.min(left * 0.8, p.bypassLen * (0.7 + rng() * 0.8));
      const end = atArc(parent, s + back);
      const mid = atArc(parent, s + back / 2);
      const nx = -Math.sin(mid.dir), ny = Math.cos(mid.dir);
      const full = (sg) => {
        const bow = p.bow * (0.6 + rng() * 0.9) * sg;
        return spline([
          { x: here.x, y: here.y },
          { x: mid.x + nx * bow * 0.8, y: mid.y + ny * bow * 0.8 },
          { x: end.x, y: end.y },
        ], p.step);
      };
      let made = null;
      for (const sg of [side, -side]) {
        const pts = full(sg);
        if (!p.inside || pts.every((q) => p.inside(q.x, q.y))) { made = pts; break; }
      }
      if (made) out.push(channel({ pts: made, w0: w * 0.55, w1: w * 0.5, t0: born, speed: p.speed, depth, id: 'bypass' }));
    } else if (r < p.bypass + p.twig || depth === p.maxDepth) {
      // a twig: a shallow arc that turns as it goes and ends in a curl
      const len = p.twigLen * (0.6 + rng() * 0.9);
      const got = bothSides(here, (sg) => {
        const pts = spline(arc(here, sg * p.angle * (0.7 + rng() * 0.6), sg * (0.7 + rng() * 0.8), len, 4), p.step);
        const tip = pts[pts.length - 1];
        const tdir = Math.atan2(tip.y - pts[pts.length - 2].y, tip.x - pts[pts.length - 2].x);
        pts.push(...curl(tip, tdir, p.curl * (0.7 + rng() * 0.8), 0.8 + rng() * 0.6, sg, p.step));
        return pts;
      });
      if (got) out.push(channel({ pts: got.pts, w0: w * 0.5, w1: w * 0.2, t0: born, speed: p.speed, depth, id: 'twig' }));
    } else {
      // A BRANCH that carries on and sprouts in its turn. It leaves at a
      // shallow angle and bends back toward the run, so it travels ALONGSIDE
      // its parent — a braid of the flow rather than a limb off a tree.
      const len = p.lens[Math.min(p.lens.length - 1, depth - 1)] * (0.7 + rng() * 0.7);
      const got = bothSides(here, (sg) => spline(arc(here, sg * p.angle * (0.45 + rng() * 0.5), -sg * (0.25 + rng() * 0.5), len, 5), p.step));
      if (got) {
        const child = channel({ pts: got.pts, w0: w * 0.6, w1: w * 0.32, t0: born, speed: p.speed, depth, id: 'branch' });
        out.push(child);
        sprout(child, p, rng, out, depth + 1);
        // FURTHER OUT, A BRANCH FORKS. "sprouts more connected paths as it
        // flows outward" is this: the same rule, run more often the further
        // from the button it is.
        if (u > 0.45 && rng() < p.fork) {
          const twin = bothSides(here, (sg) => spline(arc(here, sg * p.angle * (1.1 + rng() * 0.5), -sg * (0.2 + rng() * 0.4), len * 0.7, 4), p.step));
          if (twin) {
            const c2 = channel({ pts: twin.pts, w0: w * 0.45, w1: w * 0.24, t0: born + 0.004, speed: p.speed, depth: depth + 1, id: 'fork' });
            out.push(c2);
            sprout(c2, p, rng, out, depth + 2);
          }
        }
      }
    }
    side = -side;
    s += gap;
  }
}

/**
 * Cross-links between channels that grew near one another: the second half of
 * "interconnected". A link is drawn only once both of its ends exist, so it
 * never appears hanging in the air.
 */
export function linkTips(streams, p, rng) {
  const tips = streams
    .filter((c) => c.depth > 0)
    .map((c) => {
      const n = c.pts.length - 1;
      return { c, p: c.pts[n], born: c.t0 + c.dur, dir: Math.atan2(c.pts[n].y - c.pts[n - 1].y, c.pts[n].x - c.pts[n - 1].x) };
    });
  const links = [];
  const used = new Set();
  for (let i = 0; i < tips.length; i++) {
    if (used.has(i) || links.length >= p.maxLinks) continue;
    for (let j = i + 1; j < tips.length; j++) {
      if (used.has(j)) continue;
      const d = dist(tips[i].p, tips[j].p);
      if (d < p.near * 0.35 || d > p.near) continue;
      // THE TWO HAVE TO BE GOING THE SAME WAY. Joining a tip above the channel
      // to one below it draws a straight tick straight across the channel —
      // the opposite of a join. An anastomosis is two neighbours that were
      // already running together meeting.
      const turn = Math.abs(((tips[i].dir - tips[j].dir + Math.PI) % (2 * Math.PI)) - Math.PI);
      if (turn > p.align) continue;
      if (rng() > p.chance) continue;
      const a = tips[i], b = tips[j];
      const mx = (a.p.x + b.p.x) / 2, my = (a.p.y + b.p.y) / 2;
      const nx = -(b.p.y - a.p.y) / d, ny = (b.p.x - a.p.x) / d;
      const bow = (rng() < 0.5 ? 1 : -1) * d * 0.33;
      const pts = spline([a.p, { x: mx + nx * bow, y: my + ny * bow }, b.p], p.step);
      if (p.inside && !pts.every((q) => p.inside(q.x, q.y))) continue; // never across a word
      links.push(channel({ pts, w0: 0.42, w1: 0.42, t0: Math.max(a.born, b.born), speed: p.speed, depth: 9, id: 'link' }));
      used.add(i);
      used.add(j);
      break;
    }
  }
  return links;
}

/** Put every channel's clock into 0..1, and hand back what it was scaled by. */
export function normalise(streams) {
  const end = Math.max(...streams.map((c) => c.t0 + c.dur));
  for (const c of streams) {
    c.t0 /= end;
    c.dur /= end;
  }
  return end;
}

// ---- rasterising --------------------------------------------------------

/** A coverage buffer in device px: black ink, 0..1, max-combined. */
export class Ink {
  constructor(w, h, ss) {
    this.w = w;
    this.h = h;
    this.ss = ss;
    this.a = new Float32Array(w * h);
  }
  clear() {
    this.a.fill(0);
  }
  /** One capsule: the segment a-b at half-width hw, all in device px. */
  capsule(ax, ay, bx, by, hw) {
    const { w, h, a } = this;
    const pad = hw + 1;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + pad));
    if (x1 < x0 || y1 < y0) return;
    const dx = bx - ax, dy = by - ay;
    const dd = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        let t = dd > 1e-9 ? (px * dx + py * dy) / dd : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(px - dx * t, py - dy * t);
        const c = hw + 0.5 - d;
        if (c <= 0) continue;
        const v = c >= 1 ? 1 : c;
        const i = y * w + x;
        if (v > a[i]) a[i] = v;
      }
    }
  }
  /**
   * A channel, drawn from its start to arc length `to` (page px in, device
   * out). Two things may take width off a segment as it is drawn:
   *
   *   erode(arrival)  device px off the half-width, by when that point of the
   *                   channel arrived. This is how the ink LEAVES: a stroke
   *                   thins to a hairline and then to nothing, tips first,
   *                   rather than being cut back — "the black leaves traces in
   *                   the white", in the same arithmetic the mark drains by.
   *   gmask(x, y)     0..1 of a glyph under that point, which suppresses the
   *                   width almost to nothing. IT IS WHAT MAKES THIS WRITING
   *                   RATHER THAN CROSSING OUT: the flow threads between the
   *                   letters and the letter stands in for the stroke.
   */
  stroke(c, to, opts = {}) {
    if (to <= 0) return;
    const scale = opts.scale ?? this.ss;
    const { erode, gmask, widthScale = 1 } = opts;
    const { pts, cum } = c;
    for (let i = 1; i < pts.length; i++) {
      if (cum[i - 1] >= to) break;
      const a = pts[i - 1];
      let b = pts[i];
      if (cum[i] > to) {
        const t = (to - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        b = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      }
      let hw = (widthAt(c, cum[i - 1]) * widthScale * scale) / 2;
      if (gmask) hw *= 1 - 0.92 * gmask(a.x, a.y);
      if (erode) hw -= erode(c.t0 + (cum[i - 1] / Math.max(1e-9, c.len)) * c.dur);
      if (hw <= 0.02) continue;
      this.capsule(a.x * scale, a.y * scale, b.x * scale, b.y * scale, hw);
    }
  }
  /** A bead at the front, so the tip reads as a drop rather than a cut. */
  bead(x, y, r) {
    this.capsule(x * this.ss, y * this.ss, x * this.ss, y * this.ss, r * this.ss);
  }
  /** A coverage field the same size, combined in (used for the mark and words). */
  blit(field, ox, oy, fw, fh, gain = 1) {
    const { w, h, a } = this;
    for (let y = 0; y < fh; y++) {
      const Y = oy + y;
      if (Y < 0 || Y >= h) continue;
      for (let x = 0; x < fw; x++) {
        const X = ox + x;
        if (X < 0 || X >= w) continue;
        const v = field[y * fw + x] * gain;
        if (v <= 0) continue;
        const i = Y * w + X;
        if (v > a[i]) a[i] = v > 1 ? 1 : v;
      }
    }
  }
  /** Black ink, straight to RGBA — no un-multiplying: this was never on paper. */
  rgba() {
    const out = Buffer.alloc(this.w * this.h * 4);
    for (let i = 0; i < this.w * this.h; i++) {
      const v = this.a[i];
      if (v <= 0) continue;
      out[i * 4 + 3] = Math.round(Math.min(1, v) * 255);
    }
    return out;
  }
}

/**
 * Value noise on a lattice, from a hash rather than a stream: the same point
 * gives the same value whatever order things are asked in, so adding a rule
 * somewhere else cannot reshuffle it.
 */
export function vn2(x, y, seed) {
  const h = (i, j) => {
    let n = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

/** Smooth 0..1. */
export const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-9, e1 - e0)));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeIn = (t) => t * t;
