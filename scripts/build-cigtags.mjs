/**
 * npm run build:cigtags — the tags the landing row filters by.
 *
 *   public/cigpages/*.svg + lib/cigs.json  ->  lib/cigtags.json
 *
 * Five things can be filtered on, and all five come out of the cigarette's
 * own info page or its name:
 *
 *   menthol    Y or N, as the page draws it
 *   harshness  Lite, mid or hard
 *   price      the pack price: 15, 25 or 30
 *   brand      the name before the em dash, 63 of them
 *   notes      which of five families the page's tasting notes fall in
 *   pairings   which of five families its three pairings fall in
 *
 * THE FIRST FOUR ARE READ, THE LAST TWO ARE CLASSIFIED. Notes and pairings
 * are open vocabularies — 112 distinct notes and 207 distinct pairings
 * across the 235 pages — so a button apiece is not a grid, it is a phone
 * book. The owner asked for five categories encompassing all of each, and
 * the tables below are those: every value is matched by an explicit rule,
 * and ANYTHING UNMATCHED IS A HARD ERROR rather than a silent "other", so a
 * word the owner adds later cannot quietly stop being filterable.
 *
 * A pack can be in more than one family — it has three notes and three
 * pairings — so those two are array-valued and a pack matches if ANY of its
 * families is picked. The other four are single values.
 *
 * IT READS THE BUILT PAGES, NOT THE SOURCE VECTORS, and is therefore fast
 * (text, no rasters) where `build:cigpages` takes half an hour. The built
 * page is the artefact that actually ships and carries the text verbatim.
 * **Re-run this after `build:cigpages`.**
 *
 * THE MANIFEST IS KEYED BY PACK, NOT BY PAGE. Twelve packs share a page with
 * a name-twin, so the twin rule from `lib/cigPages.ts` is applied here — the
 * same key, lowercased and stripped to letters and digits — and the result
 * is asserted to cover every pack. That way the client filters with one
 * lookup and the page manifest stays out of the browser bundle.
 *
 * IT ALSO MEASURES EVERY BUTTON'S LABEL. The buttons are all the reset
 * button's 88x30 and some brands are long — "Great Hall of the People" is
 * 24 characters where "reset" is five — so each label's width per em is
 * worked out here from the owner's own ink table and written alongside it.
 * The page uses that to step the type down on the few labels that need it,
 * which keeps every button the same box, which is what was asked for.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const PAGES = 'public/cigpages';
const OUT = 'lib/cigtags.json';

const MENTHOL = ['Y', 'N'];
const HARSHNESS = ['Lite', 'mid', 'hard'];

/**
 * THE HEADING THAT STANDS OVER EACH GROUP IN THE MENU — the owner's own
 * words and their own order (2026-09-15), set in capitals because that is
 * how they asked for them. The grid used to say what a group meant only by
 * starting it on a new line; these name it.
 *
 * They are written out here rather than derived from the group's key so
 * that the reader's words and the code's are free to differ — "notes" is
 * FLAVOR PROFILE and "pairings" is RECOMMENDED PAIRINGS — and the order is
 * asserted against the buttons below, so a group added later cannot quietly
 * arrive with no heading over it.
 */
const GROUP_HEADING = {
  menthol: 'MENTHOL CONTENT',
  harshness: 'HARSHNESS',
  price: 'PRICE PER PACK',
  notes: 'FLAVOR PROFILE',
  pairings: 'RECOMMENDED PAIRINGS',
  brand: 'BRAND',
};

/**
 * THE FIVE NOTE FAMILIES. Each rule is a list of whole words; a note joins
 * the first family whose list contains it. The families are the owner's
 * vocabulary sorted by what the word is about — sweetness, fruit, the cool
 * end, the perfumed end, and the tobacco end. EARTHY ALSO TAKES THE BLEND'S
 * OWN CHARACTER (strong, balanced, classic, the origins), because those
 * describe the smoke rather than a flavour and the tobacco end is where
 * they belong; that is a judgement and it is written here rather than
 * hidden in a default.
 */
const NOTE_FAMILY = {
  Sweet: ['Sweet', 'Sweet Tip', 'Vanilla', 'Honey', 'Caramel', 'Candy', 'Bubblegum', 'Monkfruit', 'Creamy', 'Cocoa', 'Yogurt', 'Velvet', 'Velvety'],
  Fruit: ['Grape', 'Berry', 'Blueberry', 'Strawberry', 'Mango', 'Peach', 'Apple', 'Plum', 'Banana', 'Tropical', 'Fruity', 'Mixed Fruit', 'Orange', 'Tangerine', 'Lemon', 'Lime', 'Citrus', 'Zesty', 'Tart', 'Sour', 'Chenpi'],
  Fresh: ['Mint', 'Minty', 'Intense Mint', 'Menthol', 'Intense Menthol', 'Cool', 'Cold', 'Freezing', 'Fresh', 'Crisp', 'Clean', 'Airy', 'Light', 'Mild', 'Smooth', 'Mellow', 'Gentle', 'Pure', 'Simple', 'Ultra-light', 'Low-Tar', 'Slim'],
  Floral: ['Floral', 'Rose', 'Jasmine', 'Perfumed', 'Aromatic', 'Herbal', 'Tea', 'Lotus', 'Cherry Blossom', 'Gynostemma', 'Dendrobium', 'Powdery', 'Delicate', 'Elegant', 'Refined', 'Luxurious', 'Opulent', 'Ultra-premium'],
  Earthy: ['Earthy', 'Woody', 'Cedar', 'Toasted', 'Roasted', 'Smoky', 'Coffee', 'Tobacco', 'Cigar-Leaf', 'Pipe-Tobacco', 'Nutty', 'Resinous', 'Tannic', 'Dark', 'Deep', 'Rich', 'Robust', 'Strong', 'Harsh', 'Heavy', 'Intense', 'Dense', 'Solid', 'Classic', 'Traditional', 'Dry', 'Sharp', 'Unfiltered', 'Balanced', 'Blended', 'Mixed', 'Complex', 'Long', 'American', 'Greek', 'Korean', 'Esters', 'Surprise'],
};

/**
 * THE FIVE PAIRING FAMILIES. The owner pairs every cigarette with a food, a
 * drink and a cannabis strain, so the split almost draws itself: the food
 * into sweet and savoury, the drink into with and without alcohol, and the
 * strains on their own. Matched on whole words within the pairing, longest
 * rule first, so "Mint Chocolate" lands in Dessert and "Mint Candies" with
 * it rather than either falling to a stray "Mint".
 *
 * THE DRINKS WITHOUT ALCOHOL ARE "Beverage" (the owner's 2026-09-15 name
 * for them, in two steps). It was "Soft", which means a cold fizzy drink
 * where most of these are a tea or a coffee; it was briefly "Alcohol Free",
 * which is what they are but reads as a qualifier on the button beside it
 * rather than as a thing of its own. A hyphen was never an option either
 * way: the owner's face carries letters, digits, # and $ and nothing else,
 * so "Non-Alcoholic" would have drawn its hyphen in the fallback face.
 *
 * A BROTH IS FOOD, so it is Savoury (the owner's ask in the same breath).
 * "Herbal Broth" sat with the drinks on the strength of being sipped, which
 * is the one thing about it that is not the point; it is stock with herbs
 * in it and it belongs with the jerky and the braised pork. The rule is the
 * bare word, so any broth the owner adds later lands there too — and with
 * it gone, this family is drinks and nothing else, which is what lets it be
 * called what it is now called.
 */
const PAIRING_FAMILY = {
  Cannabis: ['(Hybrid)', '(Indica)', '(Sativa)', '(CBD)', 'Strains'],
  Alcohol: ['Stout', 'Mojito', 'White Wine', 'Gin', 'Lager', 'Bourbon', 'Vodka', 'Rum', 'Scotch', 'Champagne', 'Cider', 'Moscato', 'Amber Ale', 'Baijiu', 'Sake', 'Bordeaux', 'Syrah', 'Cognac', 'Sangria', 'Prosecco', 'Bellini', 'Mimosa', 'Cabernet', 'Whiskey', 'Ouzo', 'Soju', 'Amaretto', 'Jägermeister', 'Piña Colada', 'Margarita', 'Paloma', 'Port Wine', 'Plum Wine', 'Porter', 'Pilsner', 'IPA', 'Merlot', 'Rosé', 'Single Malt', "Bailey's", 'Orange Liqueur', 'Peppermint Schnapps', 'Sweet Wine', 'Wine', 'Beer'],
  Beverage: ['Espresso', 'Green Tea', 'Ice Water', 'Iced Tea', 'Jasmine Tea', 'Oolong Tea', 'Black Coffee', 'Coffee', 'Mineral Water', 'Herbal Tea', 'Lemonade', 'Black Tea', 'Tonic'],
  Dessert: ['Chocolate', 'Biscuits', 'Jelly', 'Wafers', 'Tart', 'Macarons', 'Turkish Delight', 'Shortcake', 'Cake', 'Pudding', 'Ice Cream', 'Tiramisu', 'Cheesecake', 'Cobbler', 'Pie', 'Brownies', 'Pastries', 'Pastry', 'Parfait', 'Candies', 'Candy', 'Sorbet', 'Sundae', 'Macaroons', 'Cookies', 'Sticky Rice', 'Truffles', 'Peppermint Patty', 'Caramel Corn', 'Banana Bread', 'Fruit Salad', 'Watermelon', 'Melon', 'Green Apple', 'Dried Fruit', 'Dried Plums', 'Sponge'],
  Savoury: ['Jerky', 'Pretzels', 'Cucumber Salad', 'Cured Meats', 'Ribs', 'Nuts', 'Smoked Meats', 'Sushi', 'Steak', 'Steamed Fish', 'Sunflower Seeds', 'Wagyu', 'Crackers', 'BBQ', 'Chicken', 'Salty Snacks', 'Peanuts', 'Steamed Veggies', 'Dim Sum', 'Duck', 'Foie Gras', 'Truffle Pasta', 'Braised Pork', 'Roasted Lamb', 'Olives', 'Ceviche', 'Lotus Root', 'Bitter Melon', 'Almonds', 'Walnuts', 'Brisket', 'Beef', 'Pork', 'Noodles', 'Tacos', 'Lily Soup', 'Broth', 'Rice Crackers'],
};

/** A note joins the one family that names it, or the build stops. */
function noteFamily(note) {
  for (const [family, words] of Object.entries(NOTE_FAMILY)) if (words.includes(note)) return family;
  return null;
}

/**
 * A pairing joins a family by the rules inside it, longest rule first — so
 * "Green Plum Wine" is caught by "Plum Wine" rather than by "Wine".
 *
 * CANNABIS IS ASKED FIRST AND OUTRIGHT, not by rule length. Strains are
 * named after puddings: "Mint Chocolate (Hybrid)" and "Mint Chocolate Chip
 * (Hybrid)" both went to Dessert on length alone, because "Chocolate" is a
 * character longer than "(Hybrid)". The bracket is the thing that says what
 * a pairing IS, so it settles it before anything is weighed. Two of the
 * thirty-seven strains were wrong without this.
 */
const CANNABIS_RULES = PAIRING_FAMILY.Cannabis;
const OTHER_RULES = Object.entries(PAIRING_FAMILY)
  .filter(([family]) => family !== 'Cannabis')
  .flatMap(([family, words]) => words.map((word) => ({ family, word })))
  .sort((a, b) => b.word.length - a.word.length);
function pairingFamily(pairing) {
  if (CANNABIS_RULES.some((word) => pairing.includes(word))) return 'Cannabis';
  const hit = OTHER_RULES.find((r) => pairing.includes(r.word));
  return hit ? hit.family : null;
}

/** The owner's own text, as it sits in the page. */
const texts = (svg) =>
  [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    m[1]
      .replace(/&#x27;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim(),
  );

const unknownNotes = new Set();
const unknownPairings = new Set();
const pages = new Map();

for (const file of readdirSync(PAGES).filter((f) => f.endsWith('.svg'))) {
  const id = file.replace(/\.svg$/, '');
  const t = texts(readFileSync(`${PAGES}/${file}`, 'utf8'));

  const at = t.indexOf('Possible Pairings');
  if (at < 0) throw new Error(`${id}: no "Possible Pairings" label`);
  const menthol = t[at + 1];
  const harshness = t[at + 2];
  if (!MENTHOL.includes(menthol)) throw new Error(`${id}: menthol is ${JSON.stringify(menthol)}`);
  if (!HARSHNESS.includes(harshness)) throw new Error(`${id}: harshness is ${JSON.stringify(harshness)}`);

  const priced = t.find((x) => /^\$\d+\/p$/.test(x));
  if (!priced) throw new Error(`${id}: no pack price`);
  const price = Number(priced.slice(1, -2));

  const line = t.find((x) => x.startsWith('Notes of'));
  if (!line) throw new Error(`${id}: no tasting notes`);
  const notes = new Set();
  for (const raw of line.replace('Notes of ', '').split(',')) {
    const note = raw.trim();
    if (!note) continue;
    const family = noteFamily(note);
    if (!family) unknownNotes.add(note);
    else notes.add(family);
  }

  const pairings = new Set();
  for (const raw of t.slice(at + 3, at + 6)) {
    const pairing = raw.trim();
    if (!pairing) continue;
    const family = pairingFamily(pairing);
    if (!family) unknownPairings.add(pairing);
    else pairings.add(family);
  }

  pages.set(id, { menthol, harshness, price, notes: [...notes], pairings: [...pairings] });
}

if (unknownNotes.size || unknownPairings.size) {
  throw new Error(
    `no family for ${unknownNotes.size} notes and ${unknownPairings.size} pairings:\n` +
      `  notes:    ${[...unknownNotes].join(', ')}\n` +
      `  pairings: ${[...unknownPairings].join(', ')}`,
  );
}

// the twin rule, as lib/cigPages.ts applies it
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const packs = JSON.parse(readFileSync('lib/cigs.json', 'utf8')).packs;
const manifest = JSON.parse(readFileSync('lib/cigpages.json', 'utf8'));
const byName = new Map();
for (const page of manifest.pages) {
  const k = key(page.name);
  if (byName.has(k)) byName.get(k).push(page);
  else byName.set(k, [page]);
}

/** The brand is the name before the em dash, which every pack carries. */
const brandOf = (name) => name.split('—')[0].trim();

const tags = {};
const orphans = [];
const brands = new Map();
for (const pack of packs) {
  let tag = pages.get(pack.id);
  if (!tag) {
    const match = byName.get(key(pack.name));
    if (match?.length === 1) tag = pages.get(match[0].id);
  }
  if (!tag) {
    orphans.push(pack.id);
    continue;
  }
  const brand = brandOf(pack.name);
  brands.set(brand, (brands.get(brand) ?? 0) + 1);
  tags[pack.id] = { ...tag, brand };
}
if (orphans.length) throw new Error(`no tags for ${orphans.length} packs: ${orphans.slice(0, 6).join(', ')}`);

/**
 * Every button, in the order the grid lays them out, each with its label's
 * width per em so the page can fit long ones into the same box. The ink
 * table is the owner's own, measured in Chrome; a character it does not
 * carry falls back to the mean advance, which is close enough to choose a
 * type size by and is never used to place anything.
 */
const ink = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));
const MEAN_ADV = 670;
const emOf = (label) => +([...label].reduce((w, c) => w + (ink.adv[c] ?? MEAN_ADV), 0) / 1000).toFixed(3);
const button = (group, value, label) => ({ group, value, label, em: emOf(label) });

const buttons = [
  button('menthol', 'Y', 'Menthol'),
  button('menthol', 'N', 'Regular'),
  ...HARSHNESS.map((h) => button('harshness', h, h)),
  ...[15, 25, 30].map((p) => button('price', String(p), `$${p}`)),
  ...Object.keys(NOTE_FAMILY).map((f) => button('notes', f, f)),
  ...Object.keys(PAIRING_FAMILY).map((f) => button('pairings', f, f)),
  ...[...brands.keys()].sort((a, b) => a.localeCompare(b)).map((b) => button('brand', b, b)),
];

/**
 * The headings, measured the same way the labels are, and checked against
 * the groups the buttons actually run in — same set, same order, or the
 * build stops rather than shipping a menu with a group nobody named.
 */
const groups = Object.entries(GROUP_HEADING).map(([group, heading]) => ({ group, heading, em: emOf(heading) }));
const ordered = [...new Set(buttons.map((b) => b.group))];
if (ordered.join() !== groups.map((g) => g.group).join()) {
  throw new Error(`headings ${groups.map((g) => g.group).join()} do not match the buttons' groups ${ordered.join()}`);
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:cigtags from public/cigpages and lib/cigs.json — do not edit by hand. Keyed by PACK id (twins resolved to their page). See scripts/build-cigtags.mjs.',
      count: Object.keys(tags).length,
      groups,
      buttons,
      tags,
    },
    null,
    1,
  )}\n`,
);

const tally = (field) => {
  const m = new Map();
  for (const t of Object.values(tags)) for (const v of [t[field]].flat()) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(', ');
};

console.log(
  `${pages.size} pages -> ${Object.keys(tags).length} packs tagged, ${buttons.length} buttons under ${groups.length} headings, wrote ${OUT}`,
);
for (const field of ['menthol', 'harshness', 'price', 'notes', 'pairings']) {
  console.log(`  ${field.padEnd(10)} ${tally(field)}`);
}
console.log(`  brands     ${brands.size} distinct`);
const widest = buttons.slice().sort((a, b) => b.em - a.em).slice(0, 4);
console.log(`  widest labels: ${widest.map((b) => `${b.label} (${b.em}em)`).join(', ')}`);
