/**
 * Builds the three inner pages from their Figma exports.
 *
 *   npm run build:pages
 *
 * Each page is normalised by scripts/lib/page-pipeline.mjs, cut into one SVG
 * per element by scripts/lib/split-svg-parts.mjs, and its measured geometry
 * written to lib/<page>-geometry.json, which the layout reads. Nothing about
 * a page's positions is written by hand, so re-exporting an artwork moves its
 * buttons with its marks.
 *
 * The three share a template: logo top-left, seal top-right, a body block,
 * and three footer buttons with the current page's own blacked out. About Us
 * is the odd one — its body is two boxes rather than one, and its Our Focus
 * bitmap is damaged, so it alone substitutes a supplied vector for the body.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { splitIntoParts } from './lib/split-svg-parts.mjs';
import { resampleEmbedded } from './lib/resample-embedded.mjs';
import { preparePage, thickenBody, swapBody, BACKGROUND, INK } from './lib/page-pipeline.mjs';
import { substituteBodyVector } from './lib/about-artwork.mjs';

/** Where the vector logo's ink has to land, measured off the raster it replaces. */
const LOGO = {
  file: 'scripts/assets/logo-characters.svg',
  target: { x: 5, y: 11, w: 116, h: 116 },
};

/**
 * The "about us" label as vector. A hairline stroke in its own 1974-unit
 * space — 6 there is 0.065px of growth a side on the page — takes a 9px line
 * from 19% of its ink rendering solid to 31%, past both its neighbours.
 */
const ABOUT_LABEL = { file: 'scripts/assets/about/nav-about-label.svg', stroke: 6 };

const FOOTER_REGIONS = {
  navAbout: { x0: 60, x1: 160, y0: 700, y1: 820 },
  navTerms: { x0: 160, x1: 235, y0: 700, y1: 820 },
  navPrivacy: { x0: 235, x1: 330, y0: 700, y1: 820 },
};
const HEAD_REGIONS = {
  logo: { x0: 0, x1: 110, y0: 0, y1: 140 },
  seal: { x0: 250, x1: 390, y0: 0, y1: 100 },
};

const PAGES = [
  {
    id: 'about',
    src: 'scripts/assets/about-mobile.svg',
    active: 'navAbout',
    regions: {
      ...HEAD_REGIONS,
      intro: { x0: 0, x1: 390, y0: 140, y1: 380 },
      focus: { x0: 0, x1: 390, y0: 380, y1: 660 },
      ...FOOTER_REGIONS,
    },
    bodyVector: 'scripts/assets/about/body-text.svg',
  },
  {
    id: 'privacy',
    src: 'scripts/assets/privacy-mobile.svg',
    active: 'navPrivacy',
    regions: {
      ...HEAD_REGIONS,
      body: { x0: 0, x1: 390, y0: 140, y1: 700 },
      ...FOOTER_REGIONS,
    },
    bodyImage: 'scripts/assets/privacy-body.png',
    bodyThicken: 1,
  },
  {
    id: 'terms',
    src: 'scripts/assets/terms-mobile.svg',
    active: 'navTerms',
    regions: {
      ...HEAD_REGIONS,
      body: { x0: 0, x1: 390, y0: 140, y1: 700 },
      ...FOOTER_REGIONS,
    },
    bodyImage: 'scripts/assets/terms-body.png',
    bodyThicken: 1,
  },
];

for (const page of PAGES) {
  console.log(`\n=== ${page.id} ===`);
  const partsDir = `public/${page.id}/parts`;
  const geometryFile = `lib/${page.id}-geometry.json`;

  const { svg: prepared, snapped } = preparePage(readFileSync(page.src, 'utf8'), {
    logo: LOGO,
    aboutLabel: ABOUT_LABEL,
    active: page.active,
  });
  for (const [change, n] of snapped) console.log(`  snapped ${change} x${n}`);

  const swapped = await swapBody(prepared, page.bodyImage);
  if (swapped.note) console.log(`  ${swapped.note}`);

  const { svg: thickened, note } = await thickenBody(swapped.svg, page.bodyThicken);
  console.log(`  ${note}`);

  const { svg: out, report } = await resampleEmbedded(thickened);
  for (const r of report) {
    console.log(`  resampled ${r.imageId}: ${r.from} -> ${r.to} (was ${r.wasOversampled}, saved ${r.savedKB}KB)`);
  }

  mkdirSync('.artwork', { recursive: true });
  writeFileSync(`.artwork/${page.id}-mobile.svg`, out);
  mkdirSync(partsDir, { recursive: true });

  const geometry = await splitIntoParts(out, {
    outDir: partsDir,
    geometryFile,
    regions: page.regions,
    background: BACKGROUND,
    contrast: INK,
  });

  if (page.bodyVector) {
    console.log('  body:');
    for (const line of await substituteBodyVector({
      bodyTextFile: page.bodyVector,
      partsDir,
      page: { w: 390, h: 844 },
      background: BACKGROUND,
      geometry,
    })) {
      console.log(`    ${line}`);
    }
  }

  // A hover state for the two footer buttons that lead somewhere else: the
  // same box with its red fill turned black, so the white label stays legible
  // on top of it. Built here rather than drawn over at runtime, because the
  // label would go under anything painted across the box.
  for (const id of ['navAbout', 'navTerms', 'navPrivacy']) {
    if (id === page.active) continue;
    const part = readFileSync(`${partsDir}/${id}.svg`, 'utf8');
    const filled = part.replace(
      /(<rect x="[\d.]+" y="[\d.]+" width="51" height="51" )fill="#ff0000"/g,
      '$1fill="#000000"',
    );
    if (filled === part) throw new Error(`${page.id}/${id}: no red button rect to blacken`);
    writeFileSync(`${partsDir}/${id}-hover.svg`, filled);
  }

  writeFileSync(
    geometryFile,
    `${JSON.stringify(
      {
        note: 'Generated by npm run build:pages — do not edit by hand.',
        active: page.active,
        viewBox: { w: 390, h: 844 },
        background: BACKGROUND,
        parts: geometry,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`  wrote ${geometryFile}`);
}
