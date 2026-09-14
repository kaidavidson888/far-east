/**
 * npm run build:font — the site's face, with the owner's numerals, # and $
 * set into it.
 *
 * The owner supplied the face as a webfont (scripts/assets/far-east-webfont.woff2:
 * space, 0-9, A-Z, a-z, TrueType outlines, 1000 upem) and later drew a new set of
 * numerals to match its letters (scripts/assets/numerals.svg — 688 tall like the
 * originals, 60 left / 83 right bearings like the originals, cubic outlines) and
 * a # and a $ in the same hand (scripts/assets/hash-dollar.svg), which the face
 * never carried. This build replaces the ten digits and adds the two marks, and
 * changes NOTHING ELSE: every letter's outline and metrics are copied out of the
 * owner's file byte for byte, and every table that does not describe a glyph
 * (OS/2, name) goes through untouched. The output is public/fonts/far-east-N.woff2;
 * bump N in globals.css and app/layout.tsx together when the file changes.
 *
 * WHY NOT A FONT EDITOR'S ROUND TRIP. Re-serialising the whole font through a
 * library would rewrite the letters too — into CFF, or through its own idea of
 * a glyf table — and the owner asked for the numbers changed, not the face
 * rebuilt. So the font is spliced at the table level: glyf/loca/hmtx are
 * rebuilt from the original records plus the new ones, head/hhea/maxp get their
 * bounds and counts brought up to date, cmap and post learn the two new
 * codepoints, and the rest is bytes in, bytes out. It is checked afterwards
 * with an independent parser (opentype.js): the letters must come back with
 * exactly the outlines and metrics they went in with.
 *
 * THE OUTLINES ARE CUBIC AND TRUETYPE WANTS QUADRATIC. Each cubic is split in
 * half until the one-quadratic approximation of each piece is within a fifth
 * of a unit of it (the standard bound), then written as off-curve control +
 * on-curve end, rounded to whole units like every other point in the face.
 * At 1000 upem that error is a hundredth of a pixel at the largest size the
 * site sets.
 *
 * TWO SHEETS, TWO CONVENTIONS. numerals.svg places each glyph with
 * translate(x, 900) scale(1,-1), so its path coordinates are already glyph
 * coordinates (y up, baseline at 0) and it states each glyph's advance in its
 * header comment. hash-dollar.svg has no flip, so its paths are SVG
 * coordinates (y DOWN, 0 at the top of the 688 digit height), and it states
 * no metrics — the # leans the right way and the $'s top terminal is on the
 * right only when read that way. Both are given the numerals' own rule for
 * the advance: ink + 60 + 83.
 *
 * OVERLAPPING CONTOURS. The 3 is drawn as two filled shapes that overlap at
 * the waist, which the sheet says to merge on import. Every font rasteriser
 * the site meets fills glyphs non-zero, so the overlap draws correctly as it
 * is; the OVERLAP_SIMPLE flag is set on every new glyph so Apple's rasteriser
 * knows to do the same.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { compress, decompress } from 'wawoff2';
import opentype from 'opentype.js';

const SOURCE = 'scripts/assets/far-east-webfont.woff2';
const NUMERALS = 'scripts/assets/numerals.svg';
const MARKS = 'scripts/assets/hash-dollar.svg';
const OUT = process.argv[2] || 'public/fonts/far-east-2.woff2';
const LSB = 60;
const RSB = 83;
const TOLERANCE = 0.2;

// ---------------------------------------------------------------- the sheets
/** Parse an absolute M/L/C/Z path into contours of segments. */
function parsePath(d) {
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const contours = [];
  let cur = null;
  let i = 0;
  const num = () => {
    const v = parseFloat(toks[i++]);
    if (Number.isNaN(v)) throw new Error(`bad number in path near token ${i}`);
    return v;
  };
  while (i < toks.length) {
    const t = toks[i++];
    if (t === 'M') {
      cur = { start: [num(), num()], segs: [] };
      contours.push(cur);
    } else if (t === 'L') {
      cur.segs.push({ kind: 'L', to: [num(), num()] });
    } else if (t === 'C') {
      cur.segs.push({ kind: 'C', c1: [num(), num()], c2: [num(), num()], to: [num(), num()] });
    } else if (t === 'Z') {
      cur = null;
    } else {
      throw new Error(`unsupported path command ${t}`);
    }
  }
  return contours;
}

/** The glyphs on a sheet: id → path, taken from each <g id><path d>. */
function sheetGlyphs(svg) {
  const out = new Map();
  for (const m of svg.matchAll(/<g id="([^"]+)"[^>]*>\s*<path d="([^"]+)"/g)) out.set(m[1], parsePath(m[2]));
  return out;
}

// ------------------------------------------------- cubic → quadratic → points
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * One cubic as a list of quadratics, each within TOLERANCE of the piece it
 * stands for. The mid-point quadratic's worst error is (√3/36)·|P3 − 3P2 + 3P1 − P0|.
 */
function cubicToQuads(p0, p1, p2, p3, out = []) {
  const ex = p3[0] - 3 * p2[0] + 3 * p1[0] - p0[0];
  const ey = p3[1] - 3 * p2[1] + 3 * p1[1] - p0[1];
  const err = (Math.sqrt(3) / 36) * Math.hypot(ex, ey);
  if (err <= TOLERANCE) {
    const q = [(3 * (p1[0] + p2[0]) - p0[0] - p3[0]) / 4, (3 * (p1[1] + p2[1]) - p0[1] - p3[1]) / 4];
    out.push({ ctrl: q, to: p3 });
    return out;
  }
  const p01 = lerp(p0, p1, 0.5);
  const p12 = lerp(p1, p2, 0.5);
  const p23 = lerp(p2, p3, 0.5);
  const p012 = lerp(p01, p12, 0.5);
  const p123 = lerp(p12, p23, 0.5);
  const mid = lerp(p012, p123, 0.5);
  cubicToQuads(p0, p01, p012, mid, out);
  cubicToQuads(mid, p123, p23, p3, out);
  return out;
}

/**
 * A contour as TrueType points: {x, y, on}, whole units, closed implicitly.
 * `map` takes sheet coordinates to glyph coordinates.
 */
function contourPoints(contour, map) {
  const pts = [];
  const push = (p, on) => {
    const x = Math.round(p[0]);
    const y = Math.round(p[1]);
    const last = pts[pts.length - 1];
    if (last && last.x === x && last.y === y && last.on && on) return; // a zero-length line
    pts.push({ x, y, on });
  };
  let at = map(contour.start);
  push(at, true);
  for (const s of contour.segs) {
    if (s.kind === 'L') {
      at = map(s.to);
      push(at, true);
    } else {
      const c1 = map(s.c1);
      const c2 = map(s.c2);
      const to = map(s.to);
      for (const q of cubicToQuads(at, c1, c2, to)) {
        push(q.ctrl, false);
        push(q.to, true);
      }
      at = to;
    }
  }
  // the contour closes back to its first point; TrueType closes it itself
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && last.on && last.x === first.x && last.y === first.y) pts.pop();
  return pts;
}

// --------------------------------------------------------- TrueType writing
const OVERLAP_SIMPLE = 0x40;

/** A simple glyph record from its contours' points. */
function encodeGlyph(contours) {
  const all = contours.flat();
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs);
  const yMin = Math.min(...ys);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...ys);
  const flags = [];
  const xBytes = [];
  const yBytes = [];
  let px = 0;
  let py = 0;
  all.forEach((p, i) => {
    let f = p.on ? 1 : 0;
    if (i === 0) f |= OVERLAP_SIMPLE;
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx === 0) f |= 0x10;
    else if (Math.abs(dx) < 256) {
      f |= 0x02;
      if (dx > 0) f |= 0x10;
      xBytes.push(Math.abs(dx));
    } else xBytes.push((dx >> 8) & 0xff, dx & 0xff);
    if (dy === 0) f |= 0x20;
    else if (Math.abs(dy) < 256) {
      f |= 0x04;
      if (dy > 0) f |= 0x20;
      yBytes.push(Math.abs(dy));
    } else yBytes.push((dy >> 8) & 0xff, dy & 0xff);
    flags.push(f);
    px = p.x;
    py = p.y;
  });
  const endPts = [];
  let n = -1;
  for (const c of contours) {
    n += c.length;
    endPts.push(n);
  }
  const size = 10 + endPts.length * 2 + 2 + flags.length + xBytes.length + yBytes.length;
  const buf = Buffer.alloc(size);
  let o = 0;
  buf.writeInt16BE(contours.length, o); o += 2;
  buf.writeInt16BE(xMin, o); o += 2;
  buf.writeInt16BE(yMin, o); o += 2;
  buf.writeInt16BE(xMax, o); o += 2;
  buf.writeInt16BE(yMax, o); o += 2;
  for (const e of endPts) { buf.writeUInt16BE(e, o); o += 2; }
  buf.writeUInt16BE(0, o); o += 2; // no instructions
  for (const f of flags) buf[o++] = f;
  for (const b of xBytes) buf[o++] = b;
  for (const b of yBytes) buf[o++] = b;
  return { bytes: buf, xMin, yMin, xMax, yMax, points: all.length, contours: contours.length };
}

/** What a copied record says about itself (bounds, points, contours). */
function readGlyphHeader(bytes) {
  if (bytes.length === 0) return { xMin: 0, yMin: 0, xMax: 0, yMax: 0, points: 0, contours: 0, empty: true };
  const contours = bytes.readInt16BE(0);
  if (contours < 0) throw new Error('composite glyphs are not expected in this face');
  const points = contours ? bytes.readUInt16BE(10 + (contours - 1) * 2) + 1 : 0;
  return { xMin: bytes.readInt16BE(2), yMin: bytes.readInt16BE(4), xMax: bytes.readInt16BE(6), yMax: bytes.readInt16BE(8), points, contours };
}

const pad4 = (n) => (n + 3) & ~3;

function checksum(buf) {
  let sum = 0;
  const padded = Buffer.alloc(pad4(buf.length));
  buf.copy(padded);
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

/** An sfnt from {tag: Buffer}; head's checkSumAdjustment is filled in. */
function writeSfnt(tables, sfntVersion) {
  const tags = [...tables.keys()].sort();
  const n = tags.length;
  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= n) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;
  const header = Buffer.alloc(12 + n * 16);
  header.writeUInt32BE(sfntVersion, 0);
  header.writeUInt16BE(n, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(n * 16 - searchRange, 10);
  let offset = header.length;
  const parts = [header];
  const headAt = { offset: -1 };
  tags.forEach((tag, i) => {
    const data = tables.get(tag);
    const o = 12 + i * 16;
    header.write(tag, o, 'ascii');
    header.writeUInt32BE(checksum(data), o + 4);
    header.writeUInt32BE(offset, o + 8);
    header.writeUInt32BE(data.length, o + 12);
    if (tag === 'head') headAt.offset = offset;
    const padded = Buffer.alloc(pad4(data.length));
    data.copy(padded);
    parts.push(padded);
    offset += padded.length;
  });
  const out = Buffer.concat(parts);
  out.writeUInt32BE(0, headAt.offset + 8);
  const adjust = (0xb1b0afba - checksum(out)) >>> 0;
  out.writeUInt32BE(adjust, headAt.offset + 8);
  return out;
}

// ------------------------------------------------------------------- build
const sourceWoff2 = readFileSync(SOURCE);
const ttf = Buffer.from(await decompress(sourceWoff2));
const original = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

// the table directory, as bytes
const tables = new Map();
const numTables = ttf.readUInt16BE(4);
const sfntVersion = ttf.readUInt32BE(0);
for (let i = 0; i < numTables; i++) {
  const o = 12 + i * 16;
  const tag = ttf.toString('ascii', o, o + 4);
  const off = ttf.readUInt32BE(o + 8);
  const len = ttf.readUInt32BE(o + 12);
  tables.set(tag, ttf.subarray(off, off + len));
}
for (const t of ['head', 'hhea', 'maxp', 'loca', 'glyf', 'hmtx', 'cmap', 'post', 'OS/2', 'name']) {
  if (!tables.has(t)) throw new Error(`source has no ${t} table`);
}
const head = Buffer.from(tables.get('head'));
head.writeUInt32BE(0, 8); // checkSumAdjustment: zero while the checksums are taken, filled in last
const hhea = Buffer.from(tables.get('hhea'));
const maxp = Buffer.from(tables.get('maxp'));
const numGlyphs = maxp.readUInt16BE(4);
const indexToLocFormat = head.readInt16BE(50);
const numberOfHMetrics = hhea.readUInt16BE(34);
if (numberOfHMetrics !== numGlyphs) throw new Error('expected a full hmtx (one entry per glyph)');
if (maxp.readUInt32BE(0) !== 0x00010000) throw new Error('expected maxp 1.0 (TrueType)');

// the original glyph records and metrics
const loca = tables.get('loca');
const glyf = tables.get('glyf');
const hmtx = tables.get('hmtx');
const locaAt = (i) => (indexToLocFormat === 0 ? loca.readUInt16BE(i * 2) * 2 : loca.readUInt32BE(i * 4));
const glyphs = [];
for (let i = 0; i < numGlyphs; i++) {
  const g = original.glyphs.get(i);
  glyphs.push({
    index: i,
    name: g.name,
    unicode: g.unicode,
    bytes: Buffer.from(glyf.subarray(locaAt(i), locaAt(i + 1))),
    adv: hmtx.readUInt16BE(i * 4),
    lsb: hmtx.readInt16BE(i * 4 + 2),
    copied: true,
  });
}

// the numerals: glyph coordinates as drawn, advance from the sheet's own table
const numeralsSvg = readFileSync(NUMERALS, 'utf8');
const numeralAdvances = new Map();
for (const m of numeralsSvg.matchAll(/^\s*(\d)\s+ink\s+(\d+)\s+advance\s+(\d+)\s*$/gm)) numeralAdvances.set(m[1], { ink: +m[2], adv: +m[3] });
if (numeralAdvances.size !== 10) throw new Error(`numerals.svg: expected an advance for each of 0-9, found ${numeralAdvances.size}`);
const numerals = sheetGlyphs(numeralsSvg);
const marks = sheetGlyphs(readFileSync(MARKS, 'utf8'));

const replaced = [];
const yUp = ([x, y]) => [x + LSB, y];
const yDown = ([x, y]) => [x + LSB, 688 - y];
function makeGlyph(name, unicode, contours, map, adv) {
  const pts = contours.map((c) => contourPoints(c, map));
  const enc = encodeGlyph(pts);
  const advance = adv ?? enc.xMax + RSB; // ink + 60 + 83, the numerals' rule
  return { name, unicode, bytes: enc.bytes, adv: advance, lsb: enc.xMin, copied: false, enc };
}
for (let d = 0; d <= 9; d++) {
  const ch = String(d);
  const contours = numerals.get(`digit-${ch}`);
  if (!contours) throw new Error(`numerals.svg has no digit-${ch}`);
  const { ink, adv } = numeralAdvances.get(ch);
  if (adv !== ink + LSB + RSB) throw new Error(`numerals.svg: ${ch}'s advance ${adv} is not ink ${ink} + ${LSB} + ${RSB}`);
  const i = glyphs.findIndex((g) => g.unicode === ch.charCodeAt(0));
  if (i < 0) throw new Error(`the face has no ${ch}`);
  const made = makeGlyph(glyphs[i].name, ch.charCodeAt(0), contours, yUp, adv);
  made.index = i;
  glyphs[i] = made;
  replaced.push(made);
}
for (const [id, ch, name] of [['glyph-numbersign', '#', 'numbersign'], ['glyph-dollar', '$', 'dollar']]) {
  const contours = marks.get(id);
  if (!contours) throw new Error(`hash-dollar.svg has no ${id}`);
  if (glyphs.some((g) => g.unicode === ch.charCodeAt(0))) throw new Error(`the face already has ${ch}`);
  const made = makeGlyph(name, ch.charCodeAt(0), contours, yDown, null);
  made.index = glyphs.length;
  glyphs.push(made);
  replaced.push(made);
}

// glyf + loca + hmtx
const records = glyphs.map((g) => {
  const padded = Buffer.alloc(pad4(g.bytes.length));
  g.bytes.copy(padded);
  return padded;
});
const newGlyf = Buffer.concat(records);
const longLoca = newGlyf.length > 0x1fffe;
const newLoca = Buffer.alloc((glyphs.length + 1) * (longLoca ? 4 : 2));
{
  let off = 0;
  glyphs.forEach((g, i) => {
    if (longLoca) newLoca.writeUInt32BE(off, i * 4);
    else newLoca.writeUInt16BE(off / 2, i * 2);
    off += records[i].length;
  });
  if (longLoca) newLoca.writeUInt32BE(off, glyphs.length * 4);
  else newLoca.writeUInt16BE(off / 2, glyphs.length * 2);
}
const newHmtx = Buffer.alloc(glyphs.length * 4);
glyphs.forEach((g, i) => {
  newHmtx.writeUInt16BE(g.adv, i * 4);
  newHmtx.writeInt16BE(g.lsb, i * 4 + 2);
});

// head: bounds, loca format
const headers = glyphs.map((g) => readGlyphHeader(g.bytes));
const inked = headers.filter((h) => !h.empty);
head.writeInt16BE(Math.min(...inked.map((h) => h.xMin)), 36);
head.writeInt16BE(Math.min(...inked.map((h) => h.yMin)), 38);
head.writeInt16BE(Math.max(...inked.map((h) => h.xMax)), 40);
head.writeInt16BE(Math.max(...inked.map((h) => h.yMax)), 42);
head.writeInt16BE(longLoca ? 1 : 0, 50);

// hhea: extents, metric count
const withInk = glyphs.map((g, i) => ({ g, h: headers[i] })).filter(({ h }) => !h.empty);
hhea.writeUInt16BE(Math.max(...glyphs.map((g) => g.adv)), 10);
hhea.writeInt16BE(Math.min(...withInk.map(({ g }) => g.lsb)), 12);
hhea.writeInt16BE(Math.min(...withInk.map(({ g, h }) => g.adv - g.lsb - (h.xMax - h.xMin))), 14);
hhea.writeInt16BE(Math.max(...withInk.map(({ g, h }) => g.lsb + (h.xMax - h.xMin))), 16);
hhea.writeUInt16BE(glyphs.length, 34);

// maxp: counts
maxp.writeUInt16BE(glyphs.length, 4);
maxp.writeUInt16BE(Math.max(...headers.map((h) => h.points)), 6);
maxp.writeUInt16BE(Math.max(...headers.map((h) => h.contours)), 8);

// cmap: one format-4 subtable, under the same encoding records the source had
const cmapIn = tables.get('cmap');
const encodings = [];
for (let i = 0; i < cmapIn.readUInt16BE(2); i++) encodings.push([cmapIn.readUInt16BE(4 + i * 8), cmapIn.readUInt16BE(6 + i * 8)]);
{
  const map = glyphs.filter((g) => g.unicode).map((g) => [g.unicode, g.index]).sort((a, b) => a[0] - b[0]);
  const segs = [];
  for (const [code, gid] of map) {
    const last = segs[segs.length - 1];
    if (last && code === last.end + 1 && gid === last.endGid + 1) {
      last.end = code;
      last.endGid = gid;
    } else segs.push({ start: code, end: code, startGid: gid, endGid: gid });
  }
  segs.push({ start: 0xffff, end: 0xffff, startGid: 0, endGid: 0, sentinel: true });
  const segCount = segs.length;
  const sub = Buffer.alloc(16 + segCount * 8);
  sub.writeUInt16BE(4, 0);
  sub.writeUInt16BE(sub.length, 2);
  sub.writeUInt16BE(0, 4);
  sub.writeUInt16BE(segCount * 2, 6);
  let es = 0;
  while (1 << (es + 1) <= segCount) es++;
  sub.writeUInt16BE((1 << es) * 2, 8);
  sub.writeUInt16BE(es, 10);
  sub.writeUInt16BE(segCount * 2 - (1 << es) * 2, 12);
  segs.forEach((s, i) => {
    sub.writeUInt16BE(s.end, 14 + i * 2);
    sub.writeUInt16BE(s.start, 16 + segCount * 2 + i * 2);
    sub.writeInt16BE(s.sentinel ? 1 : ((s.startGid - s.start) << 16) >> 16, 16 + segCount * 4 + i * 2);
    sub.writeUInt16BE(0, 16 + segCount * 6 + i * 2);
  });
  const start = 4 + encodings.length * 8;
  const cmap = Buffer.alloc(start + sub.length);
  cmap.writeUInt16BE(0, 0);
  cmap.writeUInt16BE(encodings.length, 2);
  encodings.forEach(([platformID, encodingID], i) => {
    cmap.writeUInt16BE(platformID, 4 + i * 8);
    cmap.writeUInt16BE(encodingID, 6 + i * 8);
    cmap.writeUInt32BE(start, 8 + i * 8);
  });
  sub.copy(cmap, start);
  tables.set('cmap', cmap);
}

// post: the same format-2 name indices, plus the two standard names
{
  const postIn = tables.get('post');
  if (postIn.readUInt32BE(0) !== 0x00020000) throw new Error('expected post 2.0');
  const n = postIn.readUInt16BE(32);
  if (n !== numGlyphs || postIn.length !== 34 + n * 2) throw new Error('expected post 2.0 with standard names only');
  const STANDARD = { numbersign: 6, dollar: 7 };
  const post = Buffer.alloc(34 + glyphs.length * 2);
  postIn.copy(post, 0, 0, 34 + n * 2);
  post.writeUInt16BE(glyphs.length, 32);
  glyphs.slice(n).forEach((g, k) => {
    if (!(g.name in STANDARD)) throw new Error(`no standard post name for ${g.name}`);
    post.writeUInt16BE(STANDARD[g.name], 34 + (n + k) * 2);
  });
  tables.set('post', post);
}

tables.set('glyf', newGlyf);
tables.set('loca', newLoca);
tables.set('hmtx', newHmtx);
tables.set('head', head);
tables.set('hhea', hhea);
tables.set('maxp', maxp);

const outTtf = writeSfnt(tables, sfntVersion);
const outWoff2 = Buffer.from(await compress(outTtf));
writeFileSync(OUT, outWoff2);

// ------------------------------------------------------------------ check
const backTtf = Buffer.from(await decompress(outWoff2));
const back = opentype.parse(backTtf.buffer.slice(backTtf.byteOffset, backTtf.byteOffset + backTtf.byteLength));
function pathOf(g) {
  return JSON.stringify(g.path.commands);
}
let same = 0;
const problems = [];
for (let i = 0; i < numGlyphs; i++) {
  const a = original.glyphs.get(i);
  const b = back.glyphs.get(i);
  if (!glyphs[i].copied) continue;
  if (pathOf(a) !== pathOf(b) || a.advanceWidth !== b.advanceWidth || a.leftSideBearing !== b.leftSideBearing || a.unicode !== b.unicode || a.name !== b.name) problems.push(`glyph ${i} (${a.name}) differs`);
  else same++;
}
if (back.numGlyphs !== glyphs.length) problems.push(`glyph count ${back.numGlyphs}, expected ${glyphs.length}`);
for (const g of glyphs) if (g.unicode && back.charToGlyphIndex(String.fromCharCode(g.unicode)) !== g.index) problems.push(`${String.fromCharCode(g.unicode)} maps to glyph ${back.charToGlyphIndex(String.fromCharCode(g.unicode))}, expected ${g.index}`);
if (problems.length) throw new Error(problems.join('\n'));

console.log(`${OUT}: ${outWoff2.length} bytes (was ${sourceWoff2.length}); ${back.numGlyphs} glyphs, ${same} letters identical to the source`);
console.log('ch   adv  lsb   xMin yMin xMax yMax  pts contours');
for (const g of replaced) {
  const b = back.glyphs.get(g.index);
  console.log(
    `${String.fromCharCode(g.unicode).padEnd(3)} ${String(b.advanceWidth).padStart(4)} ${String(b.leftSideBearing).padStart(4)}   ${String(b.xMin).padStart(4)} ${String(b.yMin).padStart(4)} ${String(b.xMax).padStart(4)} ${String(b.yMax).padStart(4)}  ${String(g.enc.points).padStart(3)} ${g.enc.contours}`,
  );
}
console.log(`head bbox ${[36, 38, 40, 42].map((o) => head.readInt16BE(o)).join(',')}; loca ${longLoca ? 'long' : 'short'}; size on disk ${statSync(OUT).size}`);
