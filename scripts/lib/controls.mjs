/**
 * The row's control sizes, for the build scripts.
 *
 * `CIG_CONTROLS` in lib/cigRow.ts is the one copy the page uses, and a build
 * script cannot import a .ts module, so the numbers are read back out of that
 * file every run rather than restated here: a build that disagreed with the
 * page about how big a button is would lay a menu out to the wrong width.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync('lib/cigRow.ts', 'utf8');
const found = src.match(/export const CIG_CONTROLS = \{([^}]*)\}/);
if (!found) throw new Error('controls: CIG_CONTROLS was not found in lib/cigRow.ts');
const read = (k) => {
  const m = found[1].match(new RegExp(`${k}:\\s*([\\d.]+)`));
  if (!m) throw new Error(`controls: CIG_CONTROLS has no ${k}`);
  return Number(m[1]);
};

export const CIG_CONTROLS_JSON = {
  edge: read('edge'),
  width: read('width'),
  height: read('height'),
  gap: read('gap'),
};
