import data from './cigtags.json';

/**
 * THE TAGS THE LANDING ROW FILTERS BY, and the rule for matching them.
 *
 * The owner asked for "a button for each cigarette info tag on the cigarette
 * info page sample", wired up so "the user can filter the catalogue using the
 * tag buttons", reusing the filtering the site already had before the
 * handoff.
 *
 * WHICH TAGS. An info page carries five fields. Three have closed
 * vocabularies — menthol (Y/N), harshness (Lite/mid/hard) and the pack price
 * ($15/$25/$30) — and two do not: the tasting notes run to 112 distinct
 * values across the 235 pages and the pairings to 207. A button apiece for
 * those is not a grid, it is a phone book, so the buttons are the three
 * closed vocabularies: eight in all. `scripts/build-cigtags.mjs` writes what
 * each pack carries.
 *
 * THE WORDS ARE THE SITE'S OWN. Lite, mid and hard are the info page's, and
 * so are the prices. Menthol's values are drawn Y and N, which mean nothing
 * on a button by themselves, so the two buttons take the words the
 * catalogue's own flavour facet already uses for exactly this distinction —
 * Menthol and Regular (`FACET_ORDER.flavour` in `lib/seed.ts`). Nothing here
 * is a word we invented.
 *
 * THE MATCHING IS THE CATALOGUE'S. `listCigarettes` builds one clause per
 * facet, `column = ANY(values)`, and ANDs them: within a group the values
 * are alternatives, across groups they all have to hold. `matchingPacks`
 * below is that same rule in the browser, over the row's own packs rather
 * than over the `cigarettes` table — which is the table the catalogue page
 * queries and which these 247 photographed packs are deliberately not in
 * (see the note on `pack_favorites` in CLAUDE.md). A pack with no tags
 * cannot satisfy a tag, exactly as a NULL column fails `= ANY(...)`.
 *
 * KEYED BY PACK, NOT BY PAGE. Twelve packs share a page with a name-twin;
 * the build resolves that, so the browser needs one lookup and never has to
 * carry `lib/cigpages.json`.
 */
export type CigTagKey = 'menthol' | 'harshness' | 'price';

export type CigTags = { menthol: string; harshness: string; price: number };

const TAGS = data.tags as Record<string, CigTags>;

/** What a pack's page says about it, or null for a pack with no page. */
export const tagsFor = (packId: string): CigTags | null => TAGS[packId] ?? null;

export type CigTagButton = { key: CigTagKey; value: string; label: string };

/**
 * The buttons, in the order the info page presents the fields: menthol,
 * harshness, price. They are grouped by field and the grid starts each
 * field on its own line, so the arrangement says what the values mean
 * without a heading over them. Keep each field's buttons adjacent here —
 * that adjacency is what the line break is worked out from.
 */
export const CIG_TAG_BUTTONS: CigTagButton[] = [
  { key: 'menthol', value: 'Y', label: 'Menthol' },
  { key: 'menthol', value: 'N', label: 'Regular' },
  { key: 'harshness', value: 'Lite', label: 'Lite' },
  { key: 'harshness', value: 'mid', label: 'mid' },
  { key: 'harshness', value: 'hard', label: 'hard' },
  { key: 'price', value: '15', label: '$15' },
  { key: 'price', value: '25', label: '$25' },
  { key: 'price', value: '30', label: '$30' },
];

/** A button's identity in the picked set: the pair, so two groups never collide. */
export const tagToken = (b: Pick<CigTagButton, 'key' | 'value'>) => `${b.key}:${b.value}`;

/** Does this pack satisfy every group that has something picked? */
export function packMatches(packId: string, picked: ReadonlySet<string>): boolean {
  if (!picked.size) return true;
  const tags = tagsFor(packId);
  if (!tags) return false; // no tags cannot satisfy a tag — NULL = ANY(...) is false
  for (const key of ['menthol', 'harshness', 'price'] as const) {
    // one clause per group, ANDed; within a group the values are alternatives
    const any = CIG_TAG_BUTTONS.some((b) => b.key === key && picked.has(tagToken(b)));
    if (!any) continue;
    const mine = String(tags[key]);
    if (!picked.has(`${key}:${mine}`)) return false;
  }
  return true;
}

/** The ids the row should show, in its own order. Empty picks mean everything. */
export function matchingPacks(ids: readonly string[], picked: ReadonlySet<string>): string[] {
  if (!picked.size) return [...ids];
  return ids.filter((id) => packMatches(id, picked));
}
