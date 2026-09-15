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
