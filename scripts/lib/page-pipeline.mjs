/**
 * The steps every page built from one of these Figma exports needs.
 *
 * The three inner pages — About Us, Privacy Policy, Terms of Service — are
 * the same template with different body copy and a different footer button
 * blacked out, so they share this pipeline and differ only in their config.
 *
 * 1. MASKS INTO DEFS. The exports put `<mask>` at the top level. A mask
 *    separated from the shape that uses it stops masking, so cutting a page
 *    into parts would turn the seal's mark and every footer icon into a
 *    solid white block.
 *
 * 2. THE LOGO. Drawn as a 2048x2048 PNG alpha mask, 293KB and soft on a
 *    dense screen. Swapped for the same mark as vector, recoloured for a red
 *    ground: strokes to white, the counters inside them to the page's red.
 *
 * 3. THE "about us" LABEL. Also a bitmap mask — 1974x456 painted into 43x9,
 *    which Chrome downscales badly enough that the text never reached white.
 *    Swapped for the supplied vector, whose counters take the colour of
 *    whichever fill that button carries on this page.
 *
 * 4. FOOTER FILLS. The button for the page you are on is filled black, the
 *    other two red, and the label is drawn after the fill so it sits on top.
 *    The exports already do this; it is asserted rather than assumed, since
 *    a wrong one would be easy to miss and reads as a broken nav.
 *
 * 5. COLOUR SNAPPING. Values a hair off the page's red or off white are
 *    snapped to exactly those, so no two shapes seam where they meet.
 */
import { readFileSync } from 'node:fs';

export const BACKGROUND = '#ff0000';
export const INK = '#ffffff';
export const ACTIVE_FILL = '#000000';

/** Channels this close to a reference colour count as that colour. */
const NEAR = 0x08;

export const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c ?? '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const near = (colour, reference) => {
  const a = hex(colour);
  const b = hex(reference);
  if (!a || !b) return false;
  return a.every((v, i) => Math.abs(v - b[i]) <= NEAR);
};

/** Paths with their absolute extents, from the coordinates and the translate. */
export function readPaths(svg) {
  return (svg.match(/<path\b[^>]*\/>/g) ?? []).map((src) => {
    const t = /transform="translate\(([-\d.]+),([-\d.]+)\)"/.exec(src);
    const tx = t ? Number(t[1]) : 0;
    const ty = t ? Number(t[2]) : 0;
    const n = (/ d="([^"]+)"/.exec(src)?.[1] ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = n[i] + tx;
      const y = n[i + 1] + ty;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { src, fill: /fill="([^"]+)"/.exec(src)?.[1], x0, y0, x1, y1 };
  });
}

const luma = (c) => {
  const v = hex(c);
  return v ? 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2] : 255;
};

/** Round a path's coordinates; a hundredth of a unit is far under a pixel. */
const trim = (src) =>
  src.replace(/ d="([^"]+)"/, (whole, d) =>
    ` d="${d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100))}"`,
  );

/**
 * A traced vector placed into a box, its dark paths taking `ink` and its pale
 * ones `ground` so the counters inside letters still read as holes.
 *
 * VTracer lays an opaque rectangle over the whole canvas first; that one is
 * dropped, and its absence is a hard error rather than a silent miss. Sorting
 * the rest by luminance also disposes of the stray specks a trace leaves.
 */
export function placeTrace(file, box, { ink, ground, stroke = 0, uniform = false }) {
  const svg = readFileSync(file, 'utf8');
  const size = /<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/.exec(svg);
  if (!size) throw new Error(`${file}: no width/height on the root svg`);
  const [W, H] = [Number(size[1]), Number(size[2])];

  const paths = readPaths(svg);
  if (!paths.length) throw new Error(`${file}: no paths`);
  const backdrop = paths.filter((p) => p.x1 - p.x0 >= W - 1 && p.y1 - p.y0 >= H - 1);
  if (backdrop.length !== 1) {
    throw new Error(`${file}: expected one full-canvas backdrop, found ${backdrop.length}`);
  }

  let strokes = 0;
  const body = paths
    .filter((p) => p !== backdrop[0])
    .map((p) => {
      const dark = luma(p.fill) < 128;
      if (dark) strokes++;
      const paint = dark
        ? `fill="${ink}"${stroke ? ` stroke="${ink}" stroke-width="${stroke}"` : ''}`
        : `fill="${ground}"`;
      return trim(p.src.replace(/fill="[^"]+"/, paint));
    })
    .join('\n');
  if (!strokes) throw new Error(`${file}: found no dark strokes to recolour`);

  const sx = box.w / W;
  const sy = box.h / H;
  // a logo keeps its proportions; a label matches the export's own squeeze
  const scale = uniform
    ? `scale(${Math.min(sx, sy).toFixed(8)})`
    : `scale(${sx.toFixed(8)},${sy.toFixed(8)})`;
  const dx = uniform ? box.x + (box.w - W * Math.min(sx, sy)) / 2 : box.x;
  const dy = uniform ? box.y + (box.h - H * Math.min(sx, sy)) / 2 : box.y;
  return `<g transform="translate(${dx},${dy}) ${scale}">\n${body}\n</g>`;
}

/**
 * Find the mask whose content rect matches `match`, and return everything
 * needed to replace what it paints: the mask element, the group that uses it,
 * and the pattern and image ids it pulls in.
 */
function findMaskedRects(svg, match) {
  const found = [];
  const masks = svg.match(/<mask id="[^"]+"[\s\S]*?<\/mask>/g) ?? [];
  for (const mask of masks) {
    const rect = /<rect\b([^>]*)>/.exec(mask);
    if (!rect) continue;
    const get = (n) => Number((new RegExp(`\\b${n}="([\\d.-]+)"`).exec(rect[1]) ?? [])[1]);
    const box = { x: get('x') || 0, y: get('y') || 0, w: get('width'), h: get('height') };
    const fits = ['x', 'y', 'w', 'h'].every((k) => Math.abs(box[k] - match[k]) < 0.75);
    if (!fits) continue;
    const id = /<mask id="([^"]+)"/.exec(mask)[1];
    const pattern = /fill="url\(#([^)"]+)\)"/.exec(rect[1])?.[1];
    const image = pattern
      ? new RegExp(`<pattern id="${pattern}"[\\s\\S]*?href="#([^"]+)"`).exec(svg)?.[1]
      : null;
    const group = new RegExp(`<g mask="url\\(#${id}\\)">[\\s\\S]*?<\\/g>`).exec(svg)?.[0];
    if (!group) continue;
    found.push({ id, mask, group, pattern, image, box });
  }
  return found;
}

/** Drop a mask, the group it paints through, and the defs only it needed. */
function stripMasked(svg, found) {
  let out = svg.split(found.group).join('');
  out = out.replace(found.mask, '');
  if (found.pattern) {
    out = out.replace(new RegExp(`<pattern id="${found.pattern}"[\\s\\S]*?<\\/pattern>`), '');
  }
  if (found.image && !new RegExp(`href="#${found.image}"`).test(out)) {
    out = out.replace(new RegExp(`<image id="${found.image}"[^>]*\\/>`), '');
  }
  return out;
}

/** The 51x51 footer button rects, left to right. */
const FOOTER = {
  navAbout: 94.5,
  navTerms: 169.5,
  navPrivacy: 244.5,
};

export function preparePage(src, { logo, aboutLabel, active }) {
  let svg = src;

  // 1. masks into defs, so a part can be cut out without losing its mask
  const masks = svg.match(/<mask id="[^"]+"[\s\S]*?<\/mask>/g) ?? [];
  if (!masks.length) throw new Error('expected top-level <mask> elements');

  // 2. the logo. An export may stack duplicate layers — Terms of Service
  //    repeats its whole footer — so every copy goes, not just the first.
  const logoFound = findMaskedRects(svg, { x: 5, y: 11, w: 116, h: 116 });
  if (!logoFound.length) throw new Error('could not find the logo mask (a 116x116 rect at 5,11)');
  svg = logoFound.reduce((acc, f) => stripMasked(acc, f), svg);
  svg = svg.replace(
    /(<rect x="-1" y="1" width="43" height="43"[^>]*\/>)/,
    (m) => `${m}\n${placeTrace(logo.file, logo.target, { ink: INK, ground: BACKGROUND, uniform: true })}`,
  );

  // 3. the "about us" label, in whatever colour its button carries here
  const labelFound = findMaskedRects(svg, { x: 98.5, y: 752.5, w: 43, h: 9 });
  if (!labelFound.length) throw new Error('could not find the about-us label mask');
  const aboutFill = active === 'navAbout' ? ACTIVE_FILL : BACKGROUND;
  const label = placeTrace(aboutLabel.file, labelFound[0].box, {
    ink: INK,
    ground: aboutFill,
    stroke: aboutLabel.stroke ?? 0,
  });
  svg = labelFound.reduce((acc, f) => stripMasked(acc, f), svg);

  // 4. footer fills — active black, the rest red, each label drawn after its
  //    fill so it sits on top
  for (const [id, x] of Object.entries(FOOTER)) {
    const want = id === active ? ACTIVE_FILL : BACKGROUND;
    const re = new RegExp(`<rect x="${x}" y="731\\.5" width="51" height="51"([^>]*)\\/>`, 'g');
    let seen = 0;
    svg = svg.replace(re, (whole, attrs) => {
      seen++;
      const rest = attrs.replace(/\s*fill="[^"]*"/, '');
      return `<rect x="${x}" y="731.5" width="51" height="51" fill="${want}"${rest}/>`;
    });
    if (!seen) throw new Error(`no footer button rect at x=${x} to fill`);
  }
  // the label goes in after the fills, so nothing can paint over it
  svg = svg.replace('</svg>', `${label}\n</svg>`);

  // 5. snap the near-misses to the page's own two colours
  const snapped = new Map();
  const snap = (whole, attr, colour) => {
    const target = near(colour, BACKGROUND) ? BACKGROUND : near(colour, INK) ? INK : null;
    if (!target || colour.toLowerCase() === target) return whole;
    snapped.set(`${colour} -> ${target}`, (snapped.get(`${colour} -> ${target}`) ?? 0) + 1);
    return `${attr}="${target}"`;
  };
  svg = svg
    .replace(/fill="([^"]+)"/g, (w, c) => snap(w, 'fill', c))
    .replace(/stroke="([^"]+)"/g, (w, c) => snap(w, 'stroke', c));

  // masks last, so the ones the swaps removed are already gone
  const remaining = svg.match(/<mask id="[^"]+"[\s\S]*?<\/mask>/g) ?? [];
  svg = remaining.reduce((acc, m) => acc.replace(m, ''), svg);
  if (!svg.includes('<defs>')) throw new Error('no <defs> to move the masks into');
  svg = svg.replace('<defs>', `<defs>\n${remaining.join('\n')}`);

  return { svg, snapped };
}
