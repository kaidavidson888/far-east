/**
 * Builds a page for each cigarette from the supplied info-page vectors.
 *
 *   npm run build:cigpages
 *
 * The owner supplied 227 SVGs, one per cigarette, each a complete 390x844
 * page: the character logo, the seal, a photograph of the pack in a red
 * frame, some headings and figures, and a row of five icons. They are all
 * the same template with different content, which is what makes this
 * worth generating rather than laying out by hand.
 *
 * THE CROP. Measured in a browser rather than guessed, because the text is
 * real text and needs the font to have any extent at all: with the seal
 * removed the content of every one of them runs x 39..343 and y 18..730,
 * identical to the tenth of a pixel. So the design sits 39 from the left
 * and 47 from the right — the imbalance the owner spotted. Cropping the
 * viewBox to the content and letting the page centre it makes the two
 * margins equal by construction, at any width, which is the same rule the
 * rest of the site's pages follow.
 *
 * THE SEAL COMES OUT. It is drawn into the vector at 316,19, but on every
 * page of this site the seal is the animation button, which draws its own
 * first frame. Leaving the vector's copy in would put two seals on the
 * page, so it is stripped here exactly as the other pages omit their seal
 * part. The logo stays drawn and takes a transparent link on top, which is
 * how the landing page handles its logo too.
 *
 * SIZE. The vectors are 307KB each — 77MB for the set — and almost all of
 * that is one full-resolution PNG of the pack, 226KB, drawn into a 103x155
 * box. Every embedded image is re-encoded to WebP at three times the size
 * it is actually drawn at, which is the same rule `resample-embedded` uses
 * for the other pages. The 8KB subset font is left alone: an SVG loaded
 * through <img> cannot reach a font the page has, so it has to carry its
 * own.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/cigpages';
const OUT_DIR = 'public/cigpages';
const MANIFEST = 'lib/cigpages.json';
const PACKS = 'lib/cigs.json';

/** Measured in a browser, with the font loaded. See the header. */
const CONTENT = { x: 39, y: 18, w: 304, h: 712 };

/** Where the seal is drawn in the vector, so it can be taken out. */
const SEAL_AT = { x: 316, y: 19, w: 45, h: 31 };

/** The logo's box, which the home link is laid over. */
const LOGO_AT = { x: 39, y: 18, w: 42, h: 86 };

/** Embedded rasters are kept at this multiple of their drawn size. */
const OVERSAMPLE = 3;
const QUALITY = 82;

/**
 * Vectors whose names do not line up with the pack list on their own.
 *
 * Mostly abbreviation — the vectors say "Hard" where the packs say "Hard
 * Pack" — which the matcher handles. These are the ones where the two
 * disagree about the brand: the vectors use the Chinese name transcribed
 * (Longfengchengxiang) where the pack list uses the translation (Dragon
 * Phoenix), or the other way about.
 */
const MATCH = {
  'Baisha (Harmony Double Mid)': 'Baisha — Harmony of the World Dual Mid-Size Hard Pack',
  'Baisha (Harmony Prestige)': 'Baisha — Harmony of the World Prestige Mid-Size',
  'Baisha (Harmony Soft)': 'Baisha — Harmony of the World Soft Pack',
  'Baisha (Harmony of World)': 'Baisha — Harmony of the World',
  'Diamond Lotus (Black)': 'Lotus — Black',
  'Diamond Lotus (Green)': 'Lotus — Green',
  'Diamond Lotus (Red)': 'Lotus — Red',
  'Diamond Lotus (Silver)': 'Lotus — Silver',
  'ESSE (Change Café)': 'ESSE — Change Cafe',
  'ESSE (Double Shot Wine)': 'ESSE — Double Shot Red White Wine',
  'Huangshan (Huishang Slim)': 'Huangshan — Huizhou Merchant New Concept Slim',
  'Pride (Kuanzhai Yujinxiang)': 'Pride — Kuanzhai Yu Golden Aroma',
  // these two both scored closest to the Slim, and the Mid got there first
  'Huanghelou (Scenic Wonder Hard)': 'Huanghelou — Scenic Wonder Hard Pack',
  'Huanghelou (Scenic Wonder New)': 'Huanghelou — Scenic Wonder New Edition Hard Pack',
  'Zhongnanhai (Ice Shine Slim)': 'Zhongnanhai — Ice Shine Slim',
  'Zhongnanhai (Ice Shine Mid)': 'Zhongnanhai — Ice Shine Mid-Size',
};

/** No pack to attach these to, or the owner has said to leave them. */
const SKIP = new Set([
  'Huanghelou (Celebration)', // the pack photograph is missing from the set
  'Bohem (Cigar Mojito)', // no Bohem Cigar Mojito in the pack list; only Bohem Pearl
]);

const DROP = new Set(['pack', 'size', 'the', 'of', 'a', 'and', 'cigarettes', 'cigarette']);
const ALIAS = {
  longfengchengxiang: 'dragon phoenix',
  renmindahuitang: 'great hall',
  hongmei: 'red plum',
};

function tokens(s) {
  let t = s
    .toLowerCase()
    .replace(/／/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  for (const [k, v] of Object.entries(ALIAS)) t = t.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
  t = t
    .replace(/\bmid\s+size\b/g, 'midsize')
    .replace(/\bhard\s+pack\b/g, 'hard')
    .replace(/\bsoft\s+pack\b/g, 'soft');
  return t.split(/\s+/).filter((w) => w && !DROP.has(w));
}

const overlap = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / Math.max(A.size, B.size);
};

/** Every <image> in the file, with its geometry and payload. */
function images(svg) {
  const out = [];
  const re = /<image\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const tag = m[0];
    const num = (k) => {
      const g = new RegExp(`\\s${k}="([-0-9.]+)"`).exec(tag);
      return g ? Number(g[1]) : null;
    };
    const href = /\shref="(data:image\/([a-z+]+);base64,([A-Za-z0-9+/=]+))"/.exec(tag);
    out.push({
      tag,
      index: m.index,
      x: num('x'),
      y: num('y'),
      w: num('width'),
      h: num('height'),
      mime: href?.[2] ?? null,
      data: href?.[3] ?? null,
    });
  }
  return out;
}

const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;

const packs = JSON.parse(readFileSync(PACKS, 'utf8')).packs;
const byName = new Map(packs.map((p) => [p.name, p]));
const scored = packs.map((p) => ({ p, t: tokens(p.name) }));

const files = readdirSync(SRC)
  .filter((f) => f.endsWith('.svg'))
  .sort();

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const pages = [];
const unmatched = [];
const claimed = new Map();
let bytesIn = 0;
let bytesOut = 0;

for (const file of files) {
  const label = file.replace(/\.svg$/, '');
  if (SKIP.has(label)) continue;

  // which pack is this?
  let pack = null;
  if (MATCH[label]) {
    pack = byName.get(MATCH[label]) ?? null;
    if (!pack) throw new Error(`${label}: MATCH points at "${MATCH[label]}", which is not a pack`);
  } else {
    const t = tokens(label);
    let best = null;
    let score = -1;
    for (const q of scored) {
      const s = overlap(t, q.t);
      if (s > score) {
        score = s;
        best = q.p;
      }
    }
    if (score >= 0.5) pack = best;
  }
  if (!pack) {
    unmatched.push(label);
    continue;
  }
  if (claimed.has(pack.id)) {
    unmatched.push(`${label} (would take ${pack.id}, already used by ${claimed.get(pack.id)})`);
    continue;
  }
  claimed.set(pack.id, label);

  let svg = readFileSync(`${SRC}/${file}`, 'utf8');
  bytesIn += svg.length;

  // drop the seal: the animation button draws its own
  const imgs = images(svg);
  const seal = imgs.find(
    (i) => near(i.x, SEAL_AT.x) && near(i.y, SEAL_AT.y) && near(i.w, SEAL_AT.w),
  );
  if (!seal) throw new Error(`${label}: no seal found at ${SEAL_AT.x},${SEAL_AT.y}`);
  svg = svg.replace(seal.tag, '');

  // every remaining raster down to 3x the size it is drawn at
  for (const img of images(svg)) {
    if (!img.data || !img.w || !img.h) continue;
    const want = { w: Math.round(img.w * OVERSAMPLE), h: Math.round(img.h * OVERSAMPLE) };
    const raw = Buffer.from(img.data, 'base64');
    const meta = await sharp(raw).metadata();
    const pipeline = sharp(raw);
    if (meta.width > want.w || meta.height > want.h) {
      pipeline.resize({ width: want.w, height: want.h, fit: 'inside' });
    }
    const webp = await pipeline.webp({ quality: QUALITY, effort: 6 }).toBuffer();
    if (webp.length >= raw.length) continue; // no gain, leave it alone
    svg = svg.replace(
      `data:image/${img.mime};base64,${img.data}`,
      `data:image/webp;base64,${webp.toString('base64')}`,
    );
  }

  // crop to the content, so the page can centre it and the margins match
  svg = svg.replace(
    /<svg\b[^>]*?>/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CONTENT.w}" height="${CONTENT.h}" ` +
      `viewBox="${CONTENT.x} ${CONTENT.y} ${CONTENT.w} ${CONTENT.h}">`,
  );

  writeFileSync(`${OUT_DIR}/${pack.id}.svg`, svg);
  bytesOut += svg.length;
  pages.push({ id: pack.id, name: pack.name, source: label });
}

pages.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:cigpages — do not edit by hand.',
      body: { w: CONTENT.w, h: CONTENT.h },
      /** The design's top margin; the sides come from centring. */
      top: CONTENT.y,
      /** The logo's box within the cropped body, for the home link. */
      logo: { x: LOGO_AT.x - CONTENT.x, y: LOGO_AT.y - CONTENT.y, w: LOGO_AT.w, h: LOGO_AT.h },
      count: pages.length,
      pages,
    },
    null,
    2,
  )}\n`,
);

console.log(`${pages.length} pages -> ${OUT_DIR}`);
console.log(
  `  ${Math.round(bytesIn / 1024 / 1024)}MB of vectors -> ${Math.round(bytesOut / 1024 / 1024)}MB ` +
    `(${Math.round(bytesOut / Math.max(1, pages.length) / 1024)}KB a page)`,
);
if (unmatched.length) {
  console.log(`  ${unmatched.length} with no pack to attach to:`);
  for (const u of unmatched) console.log(`    ${u}`);
}
const without = packs.filter((p) => !claimed.has(p.id));
console.log(`  ${without.length} packs have no page`);
console.log(`wrote ${MANIFEST}`);
