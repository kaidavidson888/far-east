/**
 * THE SHELF'S CLOUD BUTTON: FIVE MARKS THAT OPEN.
 *
 * The owner supplied two drawings of the same five clouds — `clouds-shut.svg`,
 * a rosette with them gathered at the centre, and `clouds-open.svg`, the same
 * five thrown out into a ring — and asked for "the svg of the clouds together
 * but in red … a button that on hover or click sees the clouds open up within
 * the outline into the second image".
 *
 * SO THE TWO DRAWINGS ARE TWO POSES OF ONE OBJECT, and this works out the
 * motion between them rather than cross-fading one into the other. Every one
 * of the ten paths rasterises to the same area (123.0 ± 0.3 square units), so
 * they are congruent: each cloud in the open drawing IS a cloud from the shut
 * one, moved and turned. What the page needs is therefore five paths and ten
 * placements, not ten paths — and a cloud that travels and rotates reads as a
 * cloud opening out, where a cross-fade reads as one picture replacing
 * another.
 *
 * HOW THE PAIRS AND THE MOTION ARE FOUND, and why it is done on pixels:
 *
 *   1. Each path is rasterised on its own at 8x and reduced to area, centroid
 *      and a mask.
 *   2. For each pair the rotation is found by sweeping the angle and scoring
 *      the overlap, coarse then fine. Second moments would give it in closed
 *      form up to a 180 degree ambiguity; the sweep has no ambiguity to
 *      resolve and is a second of work. THE SWEEP ANSWERS BACKWARDS and
 *      `turn()` inverts it — see the note there, which is a shipped bug.
 *   3. The five are paired against the five by trying ALL 120 permutations and
 *      keeping the one with the best total overlap. A greedy match on bounding
 *      boxes gets four of the five right and swaps the two that happen to sit
 *      at similar angles — which is exactly the sort of thing that looks fine
 *      in a still and crosses over in motion.
 *   4. THE RESULT IS PROVED BY DRAWING IT, AND BOTH 2 AND 3 ARE SCORED ON THAT
 *      DRAWING. The shut path is put through the transform string the
 *      component itself writes, rasterised into the finished frame, and
 *      compared with the open drawing in that same frame; the build fails
 *      under 95%. This is the only measure that can see a turn reported in
 *      the wrong sense, because it is the only one that asks the question the
 *      page asks. Scoring against `iou()` instead — which is what the header
 *      used to claim and the code did not do — passed a whole-pose overlap of
 *      31% at 96.9%.
 *
 * Emits lib/shelfClouds.ts: the five paths about their own centres, each with
 * where it sits shut and where it sits open, in one square viewBox so the page
 * can draw it at any size.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SHUT = 'scripts/assets/clouds-shut.svg';
const OPEN = 'scripts/assets/clouds-open.svg';
const OUT = 'lib/shelfClouds.ts';
/** How many device pixels per drawing unit the registration works in. */
const K = 8;
/** The overlap a pair must reach for the motion to be called right. */
const MIN_IOU = 0.95;

const fail = (m) => { console.error(`build-shelf-clouds: ${m}`); process.exit(1); };

function read(file) {
  const s = readFileSync(file, 'utf8');
  const box = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!box) fail(`${file} has no viewBox at the origin`);
  const paths = [...s.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length !== 5) fail(`${file} has ${paths.length} paths, expected the five clouds`);
  return { w: +box[1], h: +box[2], paths };
}

/** One path, alone, as a mask in the drawing's own frame. */
async function mask(d, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * K)}" height="${Math.round(h * K)}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="#000"/></svg>`;
  const r = await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).greyscale()
    .raw().toBuffer({ resolveWithObject: true });
  const W = r.info.width, H = r.info.height, C = r.info.channels;
  const a = new Uint8Array(W * H);
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (r.data[(y * W + x) * C] < 128) { a[y * W + x] = 1; n += 1; sx += x; sy += y; }
    }
  }
  if (!n) fail('a path rasterised to nothing');
  return { a, W, H, n, cx: sx / n, cy: sy / n };
}

/**
 * One path drawn THROUGH A TRANSFORM into the finished square frame — the
 * frame the page draws in, at the same K px per unit as everything else.
 *
 * This is what makes the proof below a proof. `iou()` compares two marks by
 * pulling one back through a rotation of its own sampling coordinates, which
 * cannot tell a turn from its inverse; this renders the transform STRING the
 * component writes and looks at the pixels, so a sign error has nowhere to
 * hide. Pass `xf` exactly as ShelfClouds.tsx composes it.
 */
async function placed(d, xf, view) {
  const n = Math.round(view * K);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" `
    + `viewBox="0 0 ${view} ${view}"><g transform="${xf}">`
    + `<path d="${d}" fill="#000"/></g></svg>`;
  const r = await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).greyscale()
    .raw().toBuffer({ resolveWithObject: true });
  const W = r.info.width, H = r.info.height, C = r.info.channels;
  const a = new Uint8Array(W * H);
  let on = 0;
  for (let i = 0; i < W * H; i += 1) if (r.data[i * C] < 128) { a[i] = 1; on += 1; }
  return { a, W, H, n: on };
}

/** Two masks already in the same frame, compared where they lie. */
function overlap(A, B) {
  let both = 0, only = 0;
  for (let i = 0; i < A.a.length; i += 1) {
    if (A.a[i] && B.a[i]) both += 1;
    else if (A.a[i] || B.a[i]) only += 1;
  }
  return both / Math.max(1, both + only);
}

/** The transform the page writes, in one place so the proof cannot drift. */
const xform = (place, ox, oy, view) =>
  `translate(${view / 2 + place.x} ${view / 2 + place.y}) `
  + `rotate(${place.a}) translate(${-ox} ${-oy})`;

/** The overlap of B on A when B is turned by `ang` about its own centroid. */
function iou(A, B, ang) {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  let both = 0, only = 0;
  for (let y = 0; y < A.H; y += 1) {
    for (let x = 0; x < A.W; x += 1) {
      const inA = A.a[y * A.W + x] === 1;
      // the same point of A, expressed in B's frame
      const dx = x - A.cx, dy = y - A.cy;
      const bx = Math.round(B.cx + dx * c - dy * s);
      const by = Math.round(B.cy + dx * s + dy * c);
      const inB = bx >= 0 && by >= 0 && bx < B.W && by < B.H && B.a[by * B.W + bx] === 1;
      if (inA && inB) both += 1;
      else if (inA || inB) only += 1;
    }
  }
  return both / Math.max(1, both + only);
}

/** The turn that best carries A onto B, coarse then fine. */
function register(A, B) {
  let best = { ang: 0, iou: -1 };
  for (let d = 0; d < 360; d += 4) {
    const ang = (d * Math.PI) / 180;
    const v = iou(A, B, ang);
    if (v > best.iou) best = { ang, iou: v };
  }
  for (let step = 2; step >= 0.125; step /= 2) {
    for (const s of [-1, 1]) {
      const ang = best.ang + (s * step * Math.PI) / 180;
      const v = iou(A, B, ang);
      if (v > best.iou) best = { ang, iou: v };
    }
  }
  return best;
}

const shut = read(SHUT);
const open = read(OPEN);

const S = [];
const O = [];
for (let i = 0; i < 5; i += 1) {
  S.push(await mask(shut.paths[i], shut.w, shut.h));
  O.push(await mask(open.paths[i], open.w, open.h));
}
const areas = [...S, ...O].map((m) => m.n / (K * K));
const spread = Math.max(...areas) - Math.min(...areas);
if (spread > 2) fail(`the ten clouds are not one mark: areas span ${spread.toFixed(2)} square units`);
console.log(`ten clouds, area ${(areas[0]).toFixed(1)} each (spread ${spread.toFixed(2)})`);

/*
 * One square frame for both poses, so the page draws one viewBox and the
 * clouds travel inside it. The open drawing is the larger, and both are
 * centred on their own middle.
 */
const VIEW = Math.max(open.w, open.h, shut.w, shut.h);
/*
 * EACH POSE IS CENTRED ON ITS OWN CLOUDS, not on the artboard that carries
 * them. The owner's note is that the drawings "are just an aproximation that
 * may be subject to human error", and measured they are: the shut rosette
 * sits 1.75 units left of its artboard's middle and the open ring 3.0 left
 * and 1.9 down of its. Left alone the button does not open in place — the
 * whole group drifts a couple of units as it goes — so both poses hang from
 * the mean of their own five centroids and the opening is symmetrical about
 * the middle of the button.
 */
const mid = (ms) => ({
  x: ms.reduce((t, m) => t + m.cx, 0) / (ms.length * K),
  y: ms.reduce((t, m) => t + m.cy, 0) / (ms.length * K),
});
const shutMid = mid(S);
const openMid = mid(O);
console.log(
  `centred: shut on ${shutMid.x.toFixed(2)},${shutMid.y.toFixed(2)} `
  + `(artboard ${(shut.w / 2).toFixed(1)},${(shut.h / 2).toFixed(1)}), `
  + `open on ${openMid.x.toFixed(2)},${openMid.y.toFixed(2)} `
  + `(artboard ${(open.w / 2).toFixed(1)},${(open.h / 2).toFixed(1)})`,
);

/*
 * THE TURN IS FOUND BY THE SWEEP AND THEN INVERTED, AND THAT IS NOT A DETAIL.
 *
 * `iou(A, B, ang)` scores by pulling A's pixel grid back through a rotation of
 * the SAMPLING coordinates, so a high score means `B(p) = A(R(ang)·p)` — the
 * angle that carries the OPEN mark onto the SHUT one. The page needs the other
 * direction. Emitting `+ang` shipped every cloud misoriented at t=1 (whole-pose
 * overlap with the drawing: 31%), and the 95% gate passed it, because the gate
 * was the same arithmetic run a second time. `turn()` is the one place the
 * inversion happens.
 */
const turn = (rad) => {
  // THE SHORT WAY ROUND. The sweep answers in 0..360, so a cloud that settles
  // ten degrees anticlockwise comes back as 349.6 — and a button that turns it
  // 349.6 degrees is a cloud spinning almost all the way round to arrive where
  // it nearly already was.
  const d = (-rad * 180) / Math.PI;
  return +((((d + 180) % 360) + 360) % 360 - 180).toFixed(2);
};

/*
 * WHERE THE FIVE OPEN SLOTS ARE, AND WHAT BELONGS IN EACH. The slots are the
 * open drawing's own five clouds, each drawn in the finished frame — so this
 * is the picture the button has to arrive at, rasterised.
 */
const target = [];
for (let j = 0; j < 5; j += 1) {
  target.push(await placed(
    open.paths[j],
    `translate(${VIEW / 2 - openMid.x} ${VIEW / 2 - openMid.y})`,
    VIEW,
  ));
}

/*
 * ALL 120 PAIRINGS, SCORED ON THE PIXELS THE PAGE WILL DRAW.
 *
 * The sweep finds each pair's angle; the pairing is then chosen by rendering
 * the shut path into the open slot through the component's own transform and
 * measuring the overlap there. It used to be chosen on `iou()`'s own numbers,
 * and those span 96.5% to 97.0% across all 25 pairs — half a point, which is
 * rasterisation noise, so the argmax over 120 permutations was picking at
 * random. Rendered, the same table spans 88% to 99% and the answer is the one
 * where every cloud fans straight out: five travels of about 31 units and no
 * turn past 23 degrees, against two clouds crossing the ring and spinning 73
 * and 141 degrees under the old pick.
 */
const table = [];
for (let i = 0; i < 5; i += 1) {
  table.push([]);
  for (let j = 0; j < 5; j += 1) {
    const r = register(S[i], O[j]);
    const place = {
      x: O[j].cx / K - openMid.x,
      y: O[j].cy / K - openMid.y,
      a: turn(r.ang),
    };
    const drawn = await placed(
      shut.paths[i], xform(place, S[i].cx / K, S[i].cy / K, VIEW), VIEW,
    );
    table[i].push({ ang: r.ang, a: place.a, iou: overlap(drawn, target[j]) });
  }
}
const perms = [];
(function walk(left, acc) {
  if (!left.length) { perms.push(acc.slice()); return; }
  for (const j of left) walk(left.filter((k) => k !== j), [...acc, j]);
}([0, 1, 2, 3, 4], []));
let pick = null;
for (const p of perms) {
  const total = p.reduce((sum, j, i) => sum + table[i][j].iou, 0);
  if (!pick || total > pick.total) pick = { p, total };
}
console.log(`best pairing ${pick.p.join('')} — mean overlap ${(pick.total / 5 * 100).toFixed(2)}%`);

const clouds = [];
for (let i = 0; i < 5; i += 1) {
  const j = pick.p[i];
  const r = table[i][j];
  // The gate now reads the RENDERED overlap — the shut path put through the
  // page's own transform against the open drawing, in the page's own frame.
  // On the sign error above it reads 22.8% to 38.7% and stops the build;
  // `iou()` read 96.9% for the same data and let it through.
  if (r.iou < MIN_IOU) {
    fail(`cloud ${i} lands on ${j} at only ${(r.iou * 100).toFixed(1)}% overlap: the motion is wrong`);
  }
  clouds.push({
    // where it sits in each pose, about the frame's own middle
    shut: {
      x: +(S[i].cx / K - shutMid.x).toFixed(3),
      y: +(S[i].cy / K - shutMid.y).toFixed(3),
      a: 0,
    },
    open: {
      x: +(O[j].cx / K - openMid.x).toFixed(3),
      y: +(O[j].cy / K - openMid.y).toFixed(3),
      a: r.a,
    },
    iou: +(r.iou * 100).toFixed(2),
    /** the shut path, moved so its centroid is the origin */
    d: shut.paths[i],
    ox: +(S[i].cx / K).toFixed(3),
    oy: +(S[i].cy / K).toFixed(3),
  });
  console.log(
    `  cloud ${i} → ${j}: turns ${r.a.toFixed(1)}°, `
    + `travels ${Math.hypot(clouds[i].open.x - clouds[i].shut.x, clouds[i].open.y - clouds[i].shut.y).toFixed(1)}u, `
    + `overlap ${(r.iou * 100).toFixed(2)}%`,
  );
}

const body = `/**
 * THE SHELF'S CLOUD BUTTON — GENERATED by \`npm run build:shelfclouds\`, from the
 * owner's two drawings (scripts/assets/clouds-shut.svg and clouds-open.svg).
 * Do not edit.
 *
 * The two drawings are two poses of ONE object: all ten paths rasterise to the
 * same area, so each cloud in the open pose is a cloud from the shut one,
 * moved and turned. The build pairs them by trying every pairing and keeping
 * the best overlap, then finds each turn by sweeping the angle — and proves
 * it by drawing the answer and requiring 95% intersection-over-union with the
 * pose it should land on. So the button MOVES five marks rather than
 * cross-fading two pictures, which is what "the clouds open up" means.
 *
 * Each cloud's \`d\` is drawn about \`origin\`; the page places it at \`shut\` or
 * \`open\` (offsets from the middle of \`view\`) and turns it by \`a\`.
 */
export type ShelfCloud = {
  d: string;
  origin: { x: number; y: number };
  shut: { x: number; y: number; a: number };
  open: { x: number; y: number; a: number };
};

/** The square both poses are drawn in, centred on its middle. */
export const SHELF_CLOUD_VIEW = ${VIEW};

export const SHELF_CLOUDS: ShelfCloud[] = [
${clouds.map((c) => `  {
    origin: { x: ${c.ox}, y: ${c.oy} },
    shut: { x: ${c.shut.x}, y: ${c.shut.y}, a: 0 },
    open: { x: ${c.open.x}, y: ${c.open.y}, a: ${c.open.a} },
    d: '${c.d}',
  },`).join('\n')}
];
`;
writeFileSync(OUT, body);
console.log(`wrote ${OUT} — 5 clouds, view ${VIEW}, ${(body.length / 1024).toFixed(1)}KB`);
