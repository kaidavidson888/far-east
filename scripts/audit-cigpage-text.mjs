// Does every line of type on the built cigarette pages still fit the box it
// sits in, now the numerals are wider? Widths are estimated from the ink
// table's advances (the face's own glyphs) plus Arial's for the punctuation
// the face lacks (the SVG stack falls to Arial). Each text is matched to the
// smallest rect that contains its anchor; the report lists any run whose
// estimated extent leaves less than PAD inside the rect, worst first, with
// the old-face width beside it so growth from the numerals is visible.
import { readFileSync, readdirSync } from 'node:fs';
const ink = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));
const OLD_ADV = { 0: 658, 1: 374, 2: 633, 3: 648, 4: 662, 5: 688, 6: 676, 7: 664, 8: 695, 9: 678, '#': 556, $: 556 }; // Arial's for # and $
const ARIAL = { '/': 278, '(': 333, ')': 333, '-': 333, '.': 278, ',': 278, "'": 191, '&': 667, '<': 584, '>': 584, '+': 584, ':': 278, '!': 278, '?': 556, '%': 889, '@': 1015, '"': 355, ';': 278, '"': 355 };
const width = (text, size, adv) => [...text].reduce((w, c) => w + (adv[c] ?? ink.adv[c] ?? ARIAL[c] ?? 600), 0) * size / 1000;
const num = (s) => parseFloat(s);
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };
const PAD = 2;
const rows = [];
let texts = 0;
for (const f of readdirSync('public/cigpages').filter((f) => f.endsWith('.svg'))) {
  const svg = readFileSync(`public/cigpages/${f}`, 'utf8');
  // rects (no transforms on the boxes; the title band's <g translate> only holds texts)
  const rects = [...svg.matchAll(/<rect\b[^>]*>/g)].map((m) => ({ x: num(attr(m[0], 'x') ?? 0), y: num(attr(m[0], 'y') ?? 0), w: num(attr(m[0], 'width')), h: num(attr(m[0], 'height')) })).filter((r) => r.w > 0 && r.h > 0);
  // the title band offset, if the text sits inside a translated group
  const groups = [...svg.matchAll(/<g transform="translate\(([-\d.]+),?\s*([-\d.]+)\)">([\s\S]*?)<\/g>/g)];
  const dyFor = (idx) => { for (const g of groups) if (idx > g.index && idx < g.index + g[0].length) return { dx: num(g[1]), dy: num(g[2]) }; return { dx: 0, dy: 0 }; };
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    texts++;
    const tag = m[1]; const text = m[2].replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const size = num(attr(tag, 'font-size')); const anchor = attr(tag, 'text-anchor') || 'start';
    const { dx, dy } = dyFor(m.index);
    const x = num(attr(tag, 'x')) + dx; const y = num(attr(tag, 'y')) + dy;
    const w = width(text, size, {}); const wOld = width(text, size, OLD_ADV);
    const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    const box = rects.filter((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && r.w < 380).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (!box) continue;
    const room = Math.min(left - box.x, box.x + box.w - (left + w));
    rows.push({ page: f.replace('.svg', ''), text, size, w: +w.toFixed(1), wOld: +wOld.toFixed(1), box: `${box.w}x${box.h}`, room: +room.toFixed(1) });
  }
}
rows.sort((a, b) => a.room - b.room);
const tight = rows.filter((r) => r.room < PAD);
console.log(`${texts} texts on ${rows.length} boxed lines; ${tight.length} with under ${PAD}px of room (worst first):`);
for (const r of tight.slice(0, 40)) console.log(`${r.room.toString().padStart(6)}  ${r.page.padEnd(42)} ${JSON.stringify(r.text).padEnd(28)} ${r.size}px  now ${r.w} (was ${r.wOld}) in ${r.box}`);
const grew = rows.filter((r) => r.w > r.wOld + 0.5);
console.log(`\n${grew.length} boxed lines grew with the numerals; tightest of those:`);
for (const r of grew.sort((a, b) => a.room - b.room).slice(0, 12)) console.log(`${r.room.toString().padStart(6)}  ${r.page.padEnd(42)} ${JSON.stringify(r.text).padEnd(28)} now ${r.w} (was ${r.wOld}) in ${r.box}`);
