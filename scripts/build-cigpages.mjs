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
 * THE TITLE MOVES. The one change the owner asked for to the supplied
 * design: the title block goes up under the 遠東 logo and takes the landing
 * page's own left edge for it, three pixels in from the logo. Everything else
 * stays where it was drawn, and the same page serves a phone and a desktop.
 * scripts/lib/cigpage-layout.mjs does the moving and explains how.
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
import { alignTitle, titleGap } from './lib/cigpage-layout.mjs';

const SRC = 'scripts/assets/cigpages';
const OUT_DIR = 'public/cigpages';
const MANIFEST = 'lib/cigpages.json';
const PACKS = 'lib/cigs.json';

/** Measured in a browser, with the font loaded. See the header. */
const CONTENT = { x: 39, y: 18, w: 304, h: 712 };

/** Where the seal is drawn in the vector, so it can be taken out. */
const SEAL_AT = { x: 316, y: 19, w: 45, h: 31 };

/**
 * The box the pack photograph is fitted into, and the centre it is fitted
 * around. Read off all 227: the frame and the photograph are always the
 * same rectangle, always as large as fits inside this at the pack's own
 * aspect, always centred here.
 */
const FRAME = { w: 103, h: 161, cx: 100.5, cy: 348.5 };

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
  // The pack list calls this one Pearl and the vector calls it Cigar
  // Mojito, and neither is wrong: the pack reads 宝亨 宝珠 — Bohem Pearl —
  // with "Mojito Ball" across the capsule strip. Same cigarette.
  'Bohem (Cigar Mojito)': 'Bohem — Pearl',
};

/** No pack to attach these to, or the owner has said to leave them. */
const SKIP = new Set([
  'Huanghelou (Celebration)', // the pack photograph is missing from the set
]);

/**
 * Pages for packs the owner had no vector for, built from the template.
 *
 * Nine packs came with a photograph but no info page. Each gets one
 * assembled from a supplied vector: the same template, the same type, the
 * same everything but the eleven fields that differ between one page and
 * the next.
 *
 * THE OWNER'S WORDS ONLY. Every value on these pages is one the owner
 * already used somewhere across the 225 supplied pages — the same price
 * bands, the same three harshness grades, a tasting note and three
 * pairings that each appear on at least one of them. The build extracts
 * that vocabulary from the vectors themselves and refuses a value that is
 * not in it, so a word that is not the owner's cannot reach a page.
 *
 * Where the owner has already written a page for the same product under
 * another name, that page's values are used whole — Hadmen Golden Classic
 * is their Hadmen (Gold Classic), Double Happiness Soft Nanyang is their
 * Double Happiness (Soft Nanyang), and the plain Huanghelou 1916 and Blue
 * packs are the 1916 Hard, 1916 Soft and Blue Hard lines. Only Nanjing Red
 * and Nanjing Gold have no such page; their values come from the brand's
 * own nearest, chosen to agree with the researched strength — Nanjing Red
 * is 13-15mg tar and 1.2-1.3mg nicotine, so it takes Nanjing (Black), the
 * brand's other full-strength $15 pack.
 *
 * `from` on each entry names the page its values came from.
 */
const PRICE = [
  ['$15/p', '$120/c'],
  ['$25/p', '$200/c'],
  ['$30/p', '$240/c'],
];

/** The supplied page every researched one is assembled from. */
const TEMPLATE = 'Changbaishan (Soft Red).svg';

const RESEARCHED = {
  '121_Hadmen-Golden_Classic': {
    from: 'Hadmen (Gold Classic)',
    brand: 'Hadmen',
    variant: 'Golden Classic',
    price: 0,
    notes: 'Notes of Traditional, Harsh, Smoky',
    menthol: 'N',
    harshness: 'hard',
    pairings: ['Peanuts', 'Baijiu', 'Sour Diesel (Sativa)'],
  },
  '148_Double_Happiness-Soft_Nanyang': {
    from: 'Double Happiness (Soft Nanyang)',
    brand: 'Double Happiness',
    variant: 'Soft Nanyang',
    price: 0,
    notes: 'Notes of Mild, Sweet, Floral',
    menthol: 'N',
    harshness: 'Lite',
    pairings: ['Almond Cake', 'Oolong Tea', 'Wedding Cake (Hybrid)'],
  },
  '207_Huanghelou-1916': {
    from: 'Huanghelou (1916 Hard)',
    brand: 'Huanghelou',
    variant: '1916',
    price: 2,
    notes: 'Notes of Robust, Woody, Smooth',
    menthol: 'N',
    harshness: 'hard',
    pairings: ['Truffle Pasta', 'Cabernet Sauvignon', 'Hindu Kush (Indica)'],
  },
  '223_Huanghelou-1916': {
    from: 'Huanghelou (1916 Soft)',
    brand: 'Huanghelou',
    variant: '1916',
    price: 2,
    notes: 'Notes of Pure, Earthy, Luxurious',
    menthol: 'N',
    harshness: 'Lite',
    pairings: ['Wagyu Beef', 'Aged Scotch', 'Afghan Kush (Indica)'],
  },
  '209_Huanghelou-Blue': {
    from: 'Huanghelou (Blue Hard)',
    brand: 'Huanghelou',
    variant: 'Blue',
    price: 1,
    notes: 'Notes of Classic, Toasted, Mild',
    menthol: 'N',
    harshness: 'Lite',
    pairings: ['Pretzels', 'Pilsner', 'Sour Diesel (Sativa)'],
  },
  '213_Nanjing-Red': {
    from: 'Nanjing (Black)',
    brand: 'Nanjing',
    variant: 'Red',
    price: 0,
    notes: 'Notes of Robust, Earthy, Toasted',
    menthol: 'N',
    harshness: 'hard',
    pairings: ['BBQ Ribs', 'Amber Ale', 'OG Kush (Indica)'],
  },
  '237_Nanjing-Red': {
    from: 'Nanjing (Black)',
    brand: 'Nanjing',
    variant: 'Red',
    price: 0,
    notes: 'Notes of Robust, Earthy, Toasted',
    menthol: 'N',
    harshness: 'hard',
    pairings: ['BBQ Ribs', 'Amber Ale', 'OG Kush (Indica)'],
  },
  '214_Nanjing-Gold': {
    from: 'Nanjing (Golden Dragon)',
    brand: 'Nanjing',
    variant: 'Gold',
    price: 1,
    notes: 'Notes of Sweet, Toasted, Aromatic',
    menthol: 'N',
    harshness: 'mid',
    pairings: ['Nuts', 'Pilsner', 'Pineapple Express (Sativa)'],
  },
  '238_Nanjing-Gold': {
    from: 'Nanjing (Golden Dragon)',
    brand: 'Nanjing',
    variant: 'Gold',
    price: 1,
    notes: 'Notes of Sweet, Toasted, Aromatic',
    menthol: 'N',
    harshness: 'mid',
    pairings: ['Nuts', 'Pilsner', 'Pineapple Express (Sativa)'],
  },
};

/** Which <text> in the template each field fills. Measured, not guessed. */
const SLOT = {
  brand: 0,
  variant: 1,
  full: 2,
  pricePack: 3,
  priceCarton: 4,
  notes: 5,
  menthol: 9,
  harshness: 10,
  pair0: 11,
  pair1: 12,
  pair2: 13,
};

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

/** Cut the page down to a frame, so it can be centred with equal margins. */
const cropTo = (svg, box) =>
  svg.replace(
    /<svg\b[^>]*?>/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" ` +
      `viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`,
  );

/**
 * Write both arrangements of one page. The rearranging runs on the whole
 * design, before either crop, because it works in the design's own
 * coordinates — and the phone's cut is taken first, off the untouched one.
 *
 * The phone's is a plain cropped svg, loaded through <img> and centred. The
 * desktop's is markup meant to be INLINED in the page, because its columns
 * spread with the window and CSS cannot reach inside an <img>. Being inline
 * lets three things go: it needs no viewBox (one user unit is one css pixel
 * of the stage), no embedded font (the page's own is already loaded, and it
 * is the same file byte for byte), and no copy of the pack photograph — it
 * points at the one the landing row already serves. What is left is a few
 * kilobytes of geometry.
 */
const moves = [];
const gaps = [];
function emit(svg, id, label) {
  const aligned = alignTitle(svg, label);
  moves.push(aligned.dy);
  const out = cropTo(aligned.svg, CONTENT);
  writeFileSync(`${OUT_DIR}/${id}.svg`, out);
  // measured on what actually ships, so the page's rule can stand off the
  // info by the same distance the brand line stands off the flavour
  const gap = +titleGap(aligned.svg, label).toFixed(2);
  gaps.push(gap);
  return { bytes: out.length, gap };
}

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
  svg = stripLogo(svg, label);

  // the row's cleaned photograph, with the frame closed around it
  const fitted = fitPhoto(svg, pack, label);
  svg = fitted.svg;

  // every remaining raster down to 3x the size it is drawn at
  for (const img of images(svg)) {
    if (img.data === fitted.photo) continue; // already a sized WebP
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

  const made = emit(svg, pack.id, label);
  bytesOut += made.bytes;
  pages.push({ id: pack.id, name: pack.name, source: label, gap: made.gap });
}

/** Swap the content of the nth <text>, leaving its position and size. */
function setText(svg, nth, value, fontSize) {
  let seen = -1;
  return svg.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g, (whole, open, _body, close) => {
    seen++;
    if (seen !== nth) return whole;
    const tag = fontSize ? open.replace(/font-size="[0-9.]+"/, `font-size="${fontSize}"`) : open;
    return tag + String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;') + close;
  });
}

// Nearly every field is sized to its own words. The tasting note sits in a
// fixed red strip and the owner fitted each one to it — 143 different sizes
// across the 227, from 6.68 to 10.5, all landing at about the same width —
// and the names, the carton price, the harshness grade and the pairings are
// fitted the same way. The template's sizes are only right for its own
// words: "Robust, Earthy, Toasted" at Changbaishan's 9.02 ran off both ends
// of the strip.
//
// So each field takes the size the owner gave that exact phrase in that
// slot. The only strings the owner never wrote are some of the names —
// "Nanjing (Red)" is new — and those take the size the owner gave the
// nearest-length string in the same slot.
/**
 * The two graded boxes are colour-coded, and the template only carries one
 * of the five states. Taken verbatim from the owner's pages: the box behind
 * the value changes with it, not just the lettering.
 *
 *   Menthol   N     black box, white letter
 *             Y     white box with a black rule, black letter
 *   Harshness Lite  black box, white word
 *             hard  black box, RED word
 *             mid   no fill, a black rule, black word
 *
 * Changbaishan is N and Lite, so seven of the ten researched pages would
 * have come out with the wrong box had this been left to the template.
 */
const STATE = {
  menthol: {
    N: { rect: '<rect x="48" y="471.5" width="68" height="63" fill="black"/>', fill: 'white' },
    Y: {
      rect: '<rect x="48" y="471.5" width="68" height="63" fill="white" stroke="black" stroke-width="3"/>',
      fill: 'black',
    },
  },
  harshness: {
    Lite: { rect: '<rect x="140" y="471.5" width="68" height="63" fill="black"/>', fill: 'white' },
    hard: { rect: '<rect x="140" y="471.5" width="68" height="63" fill="black"/>', fill: '#FF0000' },
    mid: {
      rect: '<rect x="141.5" y="473" width="65" height="60" fill="none" stroke="black" stroke-width="3"/>',
      fill: 'black',
    },
  },
};

/**
 * Put the pack's own mark in the frame, and close the frame around it.
 *
 * Every page takes the same photograph the landing row uses — the one
 * already cropped to the box, cleaned of catalogue numbers and loose
 * cigarettes, on the page's white. The vectors carry their own
 * photographs, but those are the uncleaned originals: the owner's Nanjing
 * Black page has "180" printed under the pack.
 *
 * The frame closes on it exactly. Both the photograph and the red rule are
 * the same rectangle — as large as fits inside FRAME at the pack's own
 * aspect, centred on FRAME's centre — so there is no margin between the
 * two, which is how the row draws it.
 */
function fitPhoto(svg, pack, label) {
  const mark = readFileSync(`public/cigs/${pack.id}.svg`, 'utf8');
  const photo = /base64,([A-Za-z0-9+/=]+)"/.exec(mark)?.[1];
  if (!photo) throw new Error(`${label}: no photograph in public/cigs/${pack.id}.svg`);

  // the pack photograph is the one image drawn without preserving its
  // aspect — it does not need to, because its box is already cut to it
  const shot = images(svg).find((i) => i.tag.includes('preserveAspectRatio="none"'));
  if (!shot) throw new Error(`${label}: no pack photograph to replace`);

  const aspect = pack.w / pack.h;
  const scale = Math.min(FRAME.w / (aspect * FRAME.h), 1);
  const w = aspect * FRAME.h * scale;
  const h = FRAME.h * scale;
  const x = FRAME.cx - w / 2;
  const y = FRAME.cy - h / 2;
  const box = (tag) =>
    tag
      .replace(/\sx="[-0-9.]+"/, ` x="${x.toFixed(2)}"`)
      .replace(/\sy="[-0-9.]+"/, ` y="${y.toFixed(2)}"`)
      .replace(/\swidth="[-0-9.]+"/, ` width="${w.toFixed(2)}"`)
      .replace(/\sheight="[-0-9.]+"/, ` height="${h.toFixed(2)}"`);

  let out = svg.replace(
    shot.tag,
    box(shot.tag).replace(/href="[^"]*"/, `href="data:image/webp;base64,${photo}"`),
  );
  const frame = /<rect[^>]*stroke="#FF0000"[^>]*\/>/.exec(out)?.[0];
  if (!frame) throw new Error(`${label}: no red frame around the photograph`);
  return { svg: out.replace(frame, box(frame)), photo };
}

/**
 * Take the logo out of the artwork.
 *
 * The vector draws it as a raster, and at the size it is shown that reads
 * soft. The page puts the landing page's own vector logo in its place, at
 * the landing page's size, pinned to the page's margin — so it is the same
 * mark in the same spot on every page of the site, and it is sharp.
 */
function stripLogo(svg, label) {
  const logo = images(svg).find(
    (i) => near(i.x, LOGO_AT.x) && near(i.y, LOGO_AT.y) && near(i.w, LOGO_AT.w),
  );
  if (!logo) throw new Error(`${label}: no logo found at ${LOGO_AT.x},${LOGO_AT.y}`);
  return svg.replace(logo.tag, '');
}

/** Swap the box before the nth text, and that text's colour, together. */
function setState(svg, nth, state) {
  const texts = [...svg.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)];
  const target = texts[nth];
  if (!target) throw new Error(`no text at slot ${nth}`);
  const before = svg.slice(0, target.index);
  const rectStart = before.lastIndexOf('<rect');
  const rectEnd = svg.indexOf('/>', rectStart) + 2;
  if (rectStart < 0 || rectEnd < rectStart) throw new Error(`no box before slot ${nth}`);
  const tag = target[0].replace(/fill="[^"]+"/, `fill="${state.fill}"`);
  return svg.slice(0, rectStart) + state.rect + svg.slice(rectEnd, target.index) + tag +
    svg.slice(target.index + target[0].length);
}

const slotSizes = new Map(Object.values(SLOT).map((i) => [i, { byText: new Map(), byLen: [] }]));
function sizeFor(slot, value) {
  const { byText, byLen } = slotSizes.get(slot);
  if (byText.has(value)) return byText.get(value);
  let best = null;
  for (const [len, size] of byLen) {
    if (!best || Math.abs(len - value.length) < Math.abs(best[0] - value.length)) best = [len, size];
  }
  return best?.[1];
}

// Every value on a researched page must be one the owner already used.
// The vocabulary is read off the supplied vectors, slot by slot, so it is
// whatever the owner wrote and nothing else.
const vocabulary = Object.fromEntries(Object.keys(SLOT).map((k) => [k, new Set()]));
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.svg'))) {
  const texts = [...readFileSync(`${SRC}/${file}`, 'utf8').matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(
    (m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim(),
  );
  for (const [k, i] of Object.entries(SLOT)) vocabulary[k].add(texts[i]);
  const tags = [...readFileSync(`${SRC}/${file}`, 'utf8').matchAll(/<text\b[^>]*>/g)].map((m) => m[0]);
  for (const i of Object.values(SLOT)) {
    const size = /font-size="([0-9.]+)"/.exec(tags[i] ?? '')?.[1];
    if (!size || texts[i] == null) continue;
    const rec = slotSizes.get(i);
    if (!rec.byText.has(texts[i])) rec.byText.set(texts[i], size);
    rec.byLen.push([texts[i].length, size]);
  }
}
for (const [id, copy] of Object.entries(RESEARCHED)) {
  const [pp, pc] = PRICE[copy.price];
  const check = {
    pricePack: pp,
    priceCarton: pc,
    notes: copy.notes,
    menthol: copy.menthol,
    harshness: copy.harshness,
    pair0: copy.pairings[0],
    pair1: copy.pairings[1],
    pair2: copy.pairings[2],
  };
  for (const [k, value] of Object.entries(check)) {
    if (!vocabulary[k].has(value)) {
      throw new Error(`${id}: "${value}" is not a ${k} the owner has used on any supplied page`);
    }
  }
}

// the pages the owner had no vector for, assembled from the template
const template = readFileSync(`${SRC}/${TEMPLATE}`, 'utf8');
let researched = 0;
for (const [id, copy] of Object.entries(RESEARCHED)) {
  const pack = packs.find((p) => p.id === id);
  if (!pack) throw new Error(`RESEARCHED has ${id}, which is not a pack`);
  if (claimed.has(id)) throw new Error(`${id} already has a page from a vector`);

  let svg = template;

  // the same treatment as every other page: seal and logo out, the row's
  // cleaned photograph in, frame closed around it
  const sealTag = images(svg).find(
    (i) => near(i.x, SEAL_AT.x) && near(i.y, SEAL_AT.y) && near(i.w, SEAL_AT.w),
  );
  if (!sealTag) throw new Error(`${TEMPLATE}: no seal to strip`);
  svg = svg.replace(sealTag.tag, '');
  svg = stripLogo(svg, id);
  const fitted = fitPhoto(svg, pack, id);
  svg = fitted.svg;
  const photo = fitted.photo;

  const [pp, pc] = PRICE[copy.price];
  const notes = copy.notes;
  const fields = {
    brand: copy.brand,
    variant: copy.variant,
    full: `${copy.brand} (${copy.variant})`,
    pricePack: pp,
    priceCarton: pc,
    notes,
    menthol: copy.menthol,
    harshness: copy.harshness,
    pair0: copy.pairings[0],
    pair1: copy.pairings[1],
    pair2: copy.pairings[2],
  };
  for (const [k, value] of Object.entries(fields)) {
    const size = sizeFor(SLOT[k], value);
    if (!size) throw new Error(`${id}: no size on record for the ${k} slot`);
    svg = setText(svg, SLOT[k], value, size);
  }
  // the graded boxes carry the state in their colour, not only their word
  const mentholState = STATE.menthol[copy.menthol];
  const harshnessState = STATE.harshness[copy.harshness];
  if (!mentholState) throw new Error(`${id}: no box for menthol "${copy.menthol}"`);
  if (!harshnessState) throw new Error(`${id}: no box for harshness "${copy.harshness}"`);
  svg = setState(svg, SLOT.menthol, mentholState);
  svg = setState(svg, SLOT.harshness, harshnessState);

  // the template's own rasters still need bringing down
  for (const img of images(svg)) {
    if (!img.data || !img.w || !img.h) continue;
    if (img.data === photo) continue; // already a sized WebP
    const raw = Buffer.from(img.data, 'base64');
    const want = { w: Math.round(img.w * OVERSAMPLE), h: Math.round(img.h * OVERSAMPLE) };
    const meta = await sharp(raw).metadata();
    const pipe = sharp(raw);
    if (meta.width > want.w || meta.height > want.h) {
      pipe.resize({ width: want.w, height: want.h, fit: 'inside' });
    }
    const webp = await pipe.webp({ quality: QUALITY, effort: 6 }).toBuffer();
    if (webp.length >= raw.length) continue;
    svg = svg.replace(
      `data:image/${img.mime};base64,${img.data}`,
      `data:image/webp;base64,${webp.toString('base64')}`,
    );
  }

  const made = emit(svg, id, id);
  bytesOut += made.bytes;
  claimed.set(id, `researched from ${TEMPLATE}`);
  pages.push({ id, name: pack.name, source: 'researched', gap: made.gap });
  researched++;
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
      count: pages.length,
      pages,
    },
    null,
    2,
  )}\n`,
);

console.log(`${pages.length} pages -> ${OUT_DIR} (${researched} assembled from the template)`);
if (moves.length) {
  const d = moves.slice().sort((a, b) => a - b);
  const g = gaps.slice().sort((a, b) => a - b);
  console.log(
    `  title lifted ${(-d[d.length - 1]).toFixed(1)}..${(-d[0]).toFixed(1)}px onto the landing page's own line`,
  );
  console.log(
    `  brand-to-flavour gap ${g[0].toFixed(1)}..${g[g.length - 1].toFixed(1)}px ` +
      `(median ${g[Math.floor(g.length / 2)].toFixed(1)}) — the rule's stand-off`,
  );
}
console.log(
  `  ${Math.round(bytesIn / 1024 / 1024)}MB of vectors -> ${Math.round(bytesOut / 1024 / 1024)}MB ` +
    `(${Math.round(bytesOut / Math.max(1, pages.length) / 1024)}KB a page)`,
);
if (unmatched.length) {
  console.log(`  ${unmatched.length} with no pack to attach to:`);
  for (const u of unmatched) console.log(`    ${u}`);
}
const without = packs.filter((p) => !claimed.has(p.id));
console.log(
  `  ${without.length} packs have no vector of their own; lib/cigPages.ts sends ` +
    `each to the page its name-twin claimed`,
);
console.log(`wrote ${MANIFEST}`);
