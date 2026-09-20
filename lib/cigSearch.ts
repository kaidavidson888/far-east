import { CIG_PACKS, CIG_CONTROLS } from '@/lib/cigRow';
import { CIG_TAG_BUTTONS, tagsFor } from '@/lib/cigTags';

/**
 * THE ROW'S SEARCH — the owner's 2026-09-19 ask: "when a user types in the
 * text editor bar and hits enter or search check every cigarette for tags or
 * name or brand and pull up any matching cigarettes the same way you do for
 * the my saved button".
 *
 * IT RUNS IN THE BROWSER, AND IT NEEDS NOTHING IT DOES NOT ALREADY HAVE. A
 * pack's name is in `lib/cigs.json` and its tags in `lib/cigtags.json`, and
 * the row imports both already, so the index is built from what is loaded:
 * 247 packs, a few KB of words, made once. My Saved goes to the server only
 * because a shelf belongs to a reader; a search belongs to nobody.
 *
 * WHAT A PACK ANSWERS TO:
 *   - its NAME, which is always `Brand — Variant`, so the brand is in it;
 *   - its BRAND as the tag menu names it (they differ on a few: the button
 *     says "Golden Leaf" where one pack's file says "GoldenLeaf");
 *   - its TAGS, by the words ON THE BUTTONS, not by the values under them —
 *     a reader types "menthol", not "Y". So Menthol or Regular; Lite, mid or
 *     hard; $15, $25 or $30 (and the bare number, so "25" works as well); and
 *     the five families of notes and of pairings.
 *
 * THE RULE: fold the query and the index the same way, split into words, and
 * a pack matches when EVERY word of the query is a whole word of the pack or
 * the START of one. Every word, because "esse menthol" means the menthol
 * ESSEs and not everything that is either; a prefix, because a reader stops
 * typing when they see what they want.
 *
 * NOT A SUBSTRING, and this is measured rather than a preference: "esse" as a
 * substring returns 127 packs, because "Dessert" contains it, against the 14
 * that are ESSE. "baisha" would bring in Changbaishan the same way.
 */

/** Lower case, accents folded, and anything that is not a letter, a digit or `$` a space. */
const words = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9$]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** A tag value's words as its BUTTON says them. */
const LABEL = new Map(CIG_TAG_BUTTONS.map((b) => [`${b.group}:${b.value}`, b.label]));
const said = (group: string, value: string | number) => LABEL.get(`${group}:${value}`) ?? String(value);

function indexOf(id: string, name: string): string[] {
  const bag = [name];
  const t = tagsFor(id);
  if (t) {
    bag.push(
      said('brand', t.brand),
      said('menthol', t.menthol),
      said('harshness', t.harshness),
      said('price', t.price),
      String(t.price),
      ...t.notes.map((v) => said('notes', v)),
      ...t.pairings.map((v) => said('pairings', v)),
    );
  }
  return [...new Set(words(bag.join(' ')))];
}

const INDEX = new Map(CIG_PACKS.map((p) => [p.id, indexOf(p.id, p.name)]));

/**
 * The packs a query finds, out of `ids`, in the row's own order — the same
 * shape `matchingPacks` hands back, so `startSpin` takes it as it is. An empty
 * query finds nothing: a bar with nothing in it is not a question.
 */
export function searchPacks(ids: readonly string[], query: string): string[] {
  const terms = words(query);
  if (!terms.length) return [];
  return ids.filter((id) => {
    const idx = INDEX.get(id);
    return !!idx && terms.every((t) => idx.some((w) => w === t || w.startsWith(t)));
  });
}

/**
 * THE BAR, IN THE MENU'S OWN PX. It is drawn at the plus's scale, in the same
 * zoomed layer construction the tag menu uses, and it runs from the red
 * frame's left edge to its right — which is the menu's own design width — so
 * the field is that less the button and one gap.
 *
 * THE FIELD IS A ROW OF THE LOGIN BOX, LARGER (the owner's "a text editor with
 * the dashed lines and sigil of the text editor in the login box"). That box's
 * marks are not CSS: they are one hand-drawn sprite, `public/splash/
 * blackbox.webp`, and the splash shows them through windows onto it. The same
 * windows are used here, at this bar's size, so the dashes ARE the login
 * box's — irregular runs, a line that wanders a few px — rather than a ruled
 * `border-bottom: dashed` sitting beside the real thing. Everything below is a
 * FRACTION OF THE LINE'S LENGTH, measured off that sprite, so it all scales as
 * one: the row is "the same row, bigger" at any width.
 */
const FIELD_W = CIG_CONTROLS.width * 3 + CIG_CONTROLS.gap * 2 + 15 - CIG_CONTROLS.height - CIG_CONTROLS.gap;
/** The sprite is the whole 430px box and the line is 0.800 of it. */
const BOX = FIELD_W / 0.8;
/**
 * The SUBMIT row's marks, in fractions of the box (`SPLASH_GEOM.parts.submit`
 * in lib/splashFrames.ts). Its line is the straightest of the three — 2.9
 * sprite px of wander against the email row's 4.9 and the password's 8.2 —
 * and a line twice as long shows its wander twice as plainly.
 */
const ROW = { x0: 0.1, x1: 0.9, tickX1: 0.1116, y0: 0.8, lineY0: 0.887, lineY1: 0.908 };

export const CIG_SEARCH = {
  fieldW: FIELD_W,
  /** the sprite, and how big it is drawn so the line is the field's width */
  sprite: '/splash/blackbox.webp',
  box: BOX,
  row: ROW,
  /** how many pieces the line is shown in, so it can arrive left to right */
  segments: 8,
  /** the ☁: 0.151 of the line wide, its own 126x60 shape, standing on the line */
  sigilW: +(FIELD_W * 0.151).toFixed(2),
  sigilH: +((FIELD_W * 0.151 * 60) / 126).toFixed(2),
  /** typed text: 0.113 of the line, starting 0.0204 of it in from the tick */
  type: +(FIELD_W * 0.113).toFixed(2),
  textX: +(FIELD_W * 0.0204).toFixed(2),
  /** the least the type may shrink to, to fit a long query on the line */
  typeMin: 12,
} as const;

/** How long the ☁ holds red when nothing was found, and how long it takes to go back. */
export const SEARCH_MISS_MS = 500;
export const SEARCH_MISS_FADE_MS = 150;
