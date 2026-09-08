/**
 * Splits "login box vector.svg" (one compound path: labels + ☁ glyphs + the
 * dashed lines) into one SVG with a <g> per part, so each part's opacity can be
 * driven independently:  #label-email #cloud-email #line-email … #border
 *   → public/splash/loginbox-parts.svg
 *
 *   npm run build:splash    (runs this too)
 *
 * The output viewBox is the content bounding box + a symmetric pad, and #border
 * is that rectangle — so the red outline hugs the content evenly on all sides
 * (no extra room on one side). It also prints the box aspect ratio and the row
 * geometry to paste into SPLASH_GEOM in lib/splashFrames.ts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'scripts/assets/login-box-vector.svg';
const OUT = 'public/splash';
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(SRC, 'utf8');
const [, , VW, VH] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const d = svg.match(/<path d="([^"]+)"/)[1];

const subs = d.split(/(?=[Mm])/).filter((s) => s.trim());
const bbox = (sp) => {
  const nums = (sp.match(/-?\d+\.?\d*/g) || []).map(Number);
  const xs = [], ys = [];
  for (let i = 0; i < nums.length - 1; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), sp };
};
const b = subs.map(bbox);

const rowOf = (yc) => (yc < VH * 0.33 ? 'email' : yc < VH * 0.66 ? 'password' : 'submit');
const w = (r) => r.x1 - r.x0;
const h = (r) => r.y1 - r.y0;
const pts = (r) => (r.sp.match(/-?\d+\.?\d*/g) || []).length / 2;
// dash marks are ~6px tall; the row's left edge has a thin vertical tick and a
// small L-corner bracket where it meets the dashes — both belong to the dotted
// line so they dim and light with it (not with the label). The leftmost label
// letter ("c" of create) is wider and taller, so it stays a label.
const isLine = (r) =>
  h(r) <= 8 ||
  (r.x0 < 46 && ((w(r) < 12 && h(r) < 95) || (w(r) < 34 && h(r) < 26)));
// the ☁ glyph is one dense curvy shape on the right of the row.
const isCloud = (r) => pts(r) > 100 || (w(r) > 115 && h(r) > 35 && r.x0 > VW * 0.42);

const parts = {};
const kindOf = (r) => (isLine(r) ? 'line' : isCloud(r) ? 'cloud' : 'label');
for (const r of b) {
  const row = rowOf((r.y0 + r.y1) / 2);
  ((parts[`${kindOf(r)}-${row}`] ||= [])).push(r);
}

// content bounding box → viewBox + border, padded evenly
const all = b;
const cx0 = Math.min(...all.map((r) => r.x0));
const cx1 = Math.max(...all.map((r) => r.x1));
const cy0 = Math.min(...all.map((r) => r.y0));
const cy1 = Math.max(...all.map((r) => r.y1));
const PAD = 22;
const X0 = cx0 - PAD, Y0 = cy0 - PAD;
const BW = cx1 - cx0 + 2 * PAD, BH = cy1 - cy0 + 2 * PAD;

const order = [
  'line-email', 'line-password', 'line-submit',
  'label-email', 'label-password', 'label-submit',
  'cloud-email', 'cloud-password', 'cloud-submit',
];
const groups = order
  .filter((k) => parts[k])
  .map((k) => `  <g id="${k}"><path d="${parts[k].map((r) => r.sp).join(' ')}" fill="#000000"/></g>`)
  .join('\n');
const border =
  `  <g id="border"><rect x="${(X0 + 1).toFixed(1)}" y="${(Y0 + 1).toFixed(1)}" ` +
  `width="${(BW - 2).toFixed(1)}" height="${(BH - 2).toFixed(1)}" ` +
  `fill="none" stroke="#ff0000" stroke-width="2.25" vector-effect="non-scaling-stroke"/></g>`;

const out =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X0.toFixed(1)} ${Y0.toFixed(1)} ${BW.toFixed(1)} ${BH.toFixed(1)}" ` +
  `preserveAspectRatio="none">\n${border}\n${groups}\n</svg>\n`;
writeFileSync(`${OUT}/loginbox-parts.svg`, out);

// row geometry as fractions of the new viewBox, for SPLASH_GEOM.rows
const rowGeom = {};
for (const row of ['email', 'password', 'submit']) {
  const dashes = (parts[`line-${row}`] || []).filter((r) => h(r) <= 8);
  const dashY = dashes.reduce((s, r) => s + (r.y0 + r.y1) / 2, 0) / dashes.length;
  const lx = Math.min(...dashes.map((r) => r.x0)); // first dash (typed text starts here)
  const rx = Math.max(...dashes.map((r) => r.x1));
  rowGeom[row] = {
    dashY: +((dashY - Y0) / BH).toFixed(3),
    lineX0: +((lx - X0) / BW).toFixed(3),
    endX: +((rx - X0) / BW).toFixed(3),
  };
}

console.log('wrote', `${OUT}/loginbox-parts.svg`);
console.log('box aspect (w/h):', (BW / BH).toFixed(4), ' → SPLASH_GEOM.box width should be height * this * (frame.h / frame.w)');
console.log('rows:', JSON.stringify(rowGeom));
console.log('parts:', Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length])));
