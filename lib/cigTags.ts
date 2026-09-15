import data from './cigtags.json';
import { CIG_CONTROLS } from './cigRow';

/**
 * THE TAGS THE LANDING ROW FILTERS BY, and the rule for matching them.
 *
 * Six groups, all of them out of the cigarette's own info page or its name:
 * menthol, harshness, price, the note family, the pairing family and the
 * brand. `scripts/build-cigtags.mjs` reads what each pack carries and writes
 * both the per-pack tags and the button list below, so the vocabulary here
 * is never typed twice — the 63 brands in particular are whatever the
 * catalogue actually holds.
 *
 * WHY TWO OF THEM ARE FAMILIES RATHER THAN VALUES. Notes and pairings are
 * open vocabularies: 112 distinct tasting notes and 207 distinct pairings
 * across the 235 pages. A button apiece is not a grid, so the owner asked
 * for five categories encompassing all of each, and the build classifies
 * every value into one — with anything unmatched a hard error, so a word
 * added later cannot quietly stop being filterable. A pack carries three
 * notes and three pairings, so it can be in more than one family; those two
 * groups are array-valued and a pack matches if ANY of its families is
 * picked.
 *
 * THE MATCHING IS THE CATALOGUE'S. `listCigarettes` builds one clause per
 * facet, `column = ANY(values)`, and ANDs them: within a group the values
 * are alternatives, across groups they all have to hold. `matchingPacks` is
 * that same rule in the browser, over the row's own packs rather than over
 * the `cigarettes` table — which the catalogue page queries and which these
 * 247 photographed packs are deliberately not in (see the note on
 * `pack_favorites` in CLAUDE.md). A pack with no tags cannot satisfy a tag,
 * exactly as a NULL column fails `= ANY(...)`.
 *
 * KEYED BY PACK, NOT BY PAGE. Twelve packs share a page with a name-twin;
 * the build resolves that, so the browser needs one lookup and never has to
 * carry `lib/cigpages.json`.
 */
export type CigTagGroup = 'menthol' | 'harshness' | 'price' | 'notes' | 'pairings' | 'brand';

/** The groups a pack holds several of at once — its three notes, its three pairings. */
const MANY: ReadonlySet<CigTagGroup> = new Set<CigTagGroup>(['notes', 'pairings']);

export type CigTags = {
  menthol: string;
  harshness: string;
  price: number;
  brand: string;
  notes: string[];
  pairings: string[];
};

export type CigTagButton = {
  group: CigTagGroup;
  value: string;
  label: string;
  /** The label's width per em in the owner's face, measured by the build. */
  em: number;
};

const TAGS = data.tags as Record<string, CigTags>;

/** Every button, in the order the grid lays them out. */
export const CIG_TAG_BUTTONS = data.buttons as CigTagButton[];

/** What a pack's page says about it, or null for a pack with no page. */
export const tagsFor = (packId: string): CigTags | null => TAGS[packId] ?? null;

/** A button's identity in the picked set: the pair, so two groups never collide. */
export const tagToken = (b: Pick<CigTagButton, 'group' | 'value'>) => `${b.group}:${b.value}`;

/** The groups that have something picked in them, in the order the buttons run. */
function pickedGroups(picked: ReadonlySet<string>): CigTagGroup[] {
  const groups = new Set<CigTagGroup>();
  for (const b of CIG_TAG_BUTTONS) if (picked.has(tagToken(b))) groups.add(b.group);
  return [...groups];
}

/** Does this pack satisfy every group that has something picked? */
export function packMatches(packId: string, picked: ReadonlySet<string>): boolean {
  if (!picked.size) return true;
  const tags = tagsFor(packId);
  if (!tags) return false; // no tags cannot satisfy a tag — NULL = ANY(...) is false
  for (const group of pickedGroups(picked)) {
    // one clause per group, ANDed; within a group the values are alternatives
    const mine = MANY.has(group) ? (tags[group] as string[]) : [String(tags[group])];
    if (!mine.some((value) => picked.has(`${group}:${value}`))) return false;
  }
  return true;
}

/** The ids the row should show, in its own order. Empty picks mean everything. */
export function matchingPacks(ids: readonly string[], picked: ReadonlySet<string>): string[] {
  if (!picked.size) return [...ids];
  return ids.filter((id) => packMatches(id, picked));
}

/**
 * HOW BIG A BUTTON'S LABEL IS SET, so that 63 brand names and "reset" can be
 * the same 88x30 box — which is what "the same parameters" has to mean once
 * the labels run from "mid" to "Great Hall of the People".
 *
 * The room inside is the button less its 2px rule on each side and 2px of
 * air, and the type is the page's 15px wherever that fits. Where it does
 * not, the label takes two lines and as much size as THAT allows, capped at
 * 12 so two lines still clear the box's 26px of height. Only the longest
 * dozen brands ever reach the second line; everything else is set at 15
 * exactly as before.
 */
export const TAG_LABEL = { size: 15, twoLineMax: 12, oneLineFloor: 10 };

export function fitLabel(em: number): { size: number; lines: 1 | 2 } {
  const room = CIG_CONTROLS.width - 2 * 2 - 2 * 2;
  const one = room / em;
  if (one >= TAG_LABEL.oneLineFloor) return { size: +Math.min(TAG_LABEL.size, one).toFixed(2), lines: 1 };
  return { size: +Math.min(TAG_LABEL.twoLineMax, (room * 2) / em).toFixed(2), lines: 2 };
}

/**
 * THE HEADING OVER EACH GROUP (the owner's 2026-09-15 ask): a red outline
 * two buttons wide and one tall, standing between one group of tags and the
 * next, with the group's name in it — in the owner's face, in capitals, and
 * bold. Six of them, one before each group, and none after the last: they
 * open a group rather than close one.
 *
 * BOLD IS A STROKE, because the face has one weight — the shelf price's own
 * trick and the age gate's, 0.03 of the size laid on the glyph's outline.
 * `font-weight: bold` would ask the browser to smear the drawn weight, which
 * is what `font-synthesis: none` is on these controls to refuse.
 *
 * ALL SIX ARE SET AT ONE SIZE, worked out from the LONGEST of them
 * ("RECOMMENDED PAIRINGS", 13.8em) so that it fits its box on one line.
 * Sizing each heading to its own width the way `fitLabel` sizes a button
 * would have given six different sizes down a column of headings, which
 * reads as carelessness; a button is one of eighty and is judged against its
 * neighbours in the line, a heading is judged against the other headings.
 * The box is two buttons and the gap between them, less its own rule and
 * the same 2px of air a button's label gets.
 */
export const TAG_HEADING = { columns: 2, stroke: 0.03, pad: 2 };

export type CigTagHeading = { group: CigTagGroup; heading: string; em: number };

export const CIG_TAG_HEADINGS = data.groups as CigTagHeading[];

/** Two buttons and the gap between them — the outline's drawn width. */
export const CIG_HEADING_WIDTH = CIG_CONTROLS.width * TAG_HEADING.columns + CIG_CONTROLS.gap * (TAG_HEADING.columns - 1);

export const CIG_HEADING_SIZE = +Math.min(
  TAG_LABEL.size,
  (CIG_HEADING_WIDTH - 2 * 2 - 2 * TAG_HEADING.pad) / Math.max(...CIG_TAG_HEADINGS.map((h) => h.em)),
).toFixed(2);

/**
 * The menu as it is laid out: every group's heading, then that group's
 * buttons. Flat rather than nested, because the grid is one flow and the
 * arrival's stagger counts through it — a heading is as much a thing that
 * appears as a button is.
 */
export type CigMenuItem =
  | { kind: 'heading'; key: string; heading: string }
  | { kind: 'tag'; key: string; tag: CigTagButton; first: boolean };

export const CIG_TAG_MENU: CigMenuItem[] = (() => {
  const headings = new Map(CIG_TAG_HEADINGS.map((h) => [h.group, h.heading]));
  const items: CigMenuItem[] = [];
  let group: CigTagGroup | null = null;
  for (const tag of CIG_TAG_BUTTONS) {
    const first = tag.group !== group;
    if (first) {
      group = tag.group;
      items.push({ kind: 'heading', key: `heading:${tag.group}`, heading: headings.get(tag.group) ?? tag.group.toUpperCase() });
    }
    items.push({ kind: 'tag', key: tagToken(tag), tag, first });
  }
  return items;
})();
