/**
 * Splits "login box vector.svg" (one compound path: labels + ☁ glyphs + the
 * dashed lines) into one SVG with a <g> per part, so each part's opacity can be
 * driven independently:  #label-email #cloud-email #line-email … #border
 *   → public/splash/loginbox-parts.svg
 *
 *   npm run build:splash    (runs this too)
 *
 * Classifies each M-subpath by its bounding box: row by Y, then within a row
 * line = short/flat dash marks, cloud = the right-hand glyph, label = the rest.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'scripts/assets/login-box-vector.svg';
const OUT = 'public/splash';
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(SRC, 'utf8');
const vb = svg.match(/viewBox="([^"]+)"/)[1];
const [, , VW, VH] = vb.split(/\s+/).map(Number);
const d = svg.match(/<path d="([^"]+)"/)[1];

const subs = d.split(/(?=[Mm])/).filter((s) => s.trim());
const bbox = (sp) => {
  const nums = (sp.match(/-?\d+\.?\d*/g) || []).map(Number);
  const xs = [];
  const ys = [];
  for (let i = 0; i < nums.length - 1; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), sp };
};
const b = subs.map(bbox);

// Row bands by Y (three roughly-even rows across the viewBox).
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
const add = (key, r) => { (parts[key] ||= []).push(r.sp); };

for (const r of b) {
  const row = rowOf((r.y0 + r.y1) / 2);
  if (isLine(r)) add(`line-${row}`, r);
  else if (isCloud(r)) add(`cloud-${row}`, r);
  else add(`label-${row}`, r);
}

const order = [
  'line-email', 'line-password', 'line-submit',
  'label-email', 'label-password', 'label-submit',
  'cloud-email', 'cloud-password', 'cloud-submit',
];
const groups = order
  .filter((k) => parts[k])
  .map((k) => `  <g id="${k}"><path d="${parts[k].join(' ')}" fill="#000000"/></g>`)
  .join('\n');
// A red border rect sized to the box's own extent inside the viewBox.
const bx0 = Math.min(...b.map((r) => r.x0));
const bx1 = Math.max(...b.map((r) => r.x1));
const by0 = Math.min(...b.map((r) => r.y0));
const by1 = Math.max(...b.map((r) => r.y1));
const pad = 30;
const border =
  `  <g id="border"><rect x="${(bx0 - pad).toFixed(0)}" y="${(by0 - pad).toFixed(0)}" ` +
  `width="${(bx1 - bx0 + 2 * pad).toFixed(0)}" height="${(by1 - by0 + 2 * pad).toFixed(0)}" ` +
  `fill="none" stroke="#ff0000" stroke-width="2.25" vector-effect="non-scaling-stroke"/></g>`;

const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none">\n${border}\n${groups}\n</svg>\n`;
writeFileSync(`${OUT}/loginbox-parts.svg`, out);
console.log(`wrote ${OUT}/loginbox-parts.svg`, Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length])));
