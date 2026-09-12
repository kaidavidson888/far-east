import cigs from './cigs.json';
import cigpages from './cigpages.json';

/**
 * Which page a pack on the landing row opens.
 *
 * The owner supplied one info-page vector per cigarette *name*, but the
 * photographs run ahead of that: twelve packs carry a name another pack
 * already has — `299_Karelia-Blue` and `252_Karelia-Blue`, `111_GoldenLeaf-
 * Love_Style` and `42_Golden_Leaf-Love_Style`, and ten more. The build gives
 * the vector to whichever asks first, which left the other twelve as packs
 * you could see and not press.
 *
 * They are the same cigarette, so they get the same page. Matching is on the
 * name with the punctuation and spacing taken out, which is what makes
 * `GoldenLeaf` and `Golden Leaf` meet — the two spellings the audit flagged
 * and the owner has not yet settled. If those names are ever pulled apart
 * into genuinely different products, each will claim its own vector and this
 * will quietly find nothing to do.
 *
 * A name that somehow matched two pages would be ambiguous, so it is left
 * alone rather than guessed at.
 */
type Page = (typeof cigpages.pages)[number];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const byId = new Map<string, Page>(cigpages.pages.map((p) => [p.id, p]));

const byName = new Map<string, Page[]>();
for (const page of cigpages.pages) {
  const k = key(page.name);
  const held = byName.get(k);
  if (held) held.push(page);
  else byName.set(k, [page]);
}

/** Pack id -> the page it stands in for, for the twelve without one. */
export const TWINS: Record<string, string> = {};
for (const pack of cigs.packs) {
  if (byId.has(pack.id)) continue;
  const match = byName.get(key(pack.name));
  if (match?.length === 1) TWINS[pack.id] = match[0].id;
}

/** Every pack id that leads somewhere, which the row uses to decide a button. */
export const PRESSABLE: string[] = [
  ...cigpages.pages.map((p) => p.id),
  ...Object.keys(TWINS),
];

/** The page a pack id opens, its own or its twin's. */
export function pageFor(id: string): Page | null {
  return byId.get(id) ?? byId.get(TWINS[id] ?? '') ?? null;
}

/**
 * The box the info content occupies, in the body's own coordinates.
 *
 * Everything on the page below the 遠東 logo and the seal: the title block
 * down to the foot of the two comment panels. The numbers are the design's,
 * and they are the same on every page — which is only true because the build
 * puts the title block on the landing page's own line, so its ink top is 161
 * whatever the brand name is. They come from `scripts/lib/cigpage-layout.mjs`:
 *
 *   left    TITLE_X 44 - FRAME.x 39
 *   top     TITLE_TOP 161 - FRAME.y 18
 *   right   the notes strip ends the design at 343
 *   bottom  the comment panels end it at 730, which is FRAME's own foot
 *
 * If any of those move, move these with them.
 */
export const INFO_BOX = { left: 5, top: 143, width: 299, height: 569 };

/** The rule's weight, which globals.css draws and the page has to allow for. */
export const RULE = 5;
