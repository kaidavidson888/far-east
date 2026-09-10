/**
 * Cuts the flattened landing artwork into one SVG per element.
 *
 * The page positions each element against the viewport's own edges so the
 * design's margins survive at any width, and it cannot do that while
 * everything is a single flat image.
 *
 * REGIONS assigns every top-level node to an element by where it sits, not by
 * its index, so a re-export that reorders the document still lands each piece
 * in the right group. Anything falling outside every region, matching two, or
 * any region coming back empty is a hard error — a silently missing mark on a
 * landing page is worse than a failed build.
 *
 * Two of the nodes are white knockout plates that carve the detail into the
 * cloud; they render nothing alone, so they have no ink box to place them by
 * and fall back to the extent of their own path coordinates. Deleting them
 * would save ~390KB and turn the cloud into a blob.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const REGIONS = {
  logo: { x0: 0, x1: 110, y0: 0, y1: 140 },
  seal: { x0: 250, x1: 390, y0: 0, y1: 100 },
  offers: { x0: 0, x1: 390, y0: 150, y1: 205 },
  saved: { x0: 0, x1: 390, y0: 205, y1: 235 },
  recommended: { x0: 0, x1: 390, y0: 235, y1: 270 },
  luck: { x0: 0, x1: 390, y0: 660, y1: 730 },
  cloud: { x0: 0, x1: 200, y0: 730, y1: 810 },
  square: { x0: 200, x1: 390, y0: 730, y1: 810 },
};

const SS = 4; // supersample, for a sub-pixel ink box

/** Split a document body into its top-level nodes, keeping <g> trees whole. */
function topLevelNodes(body) {
  const nodes = [];
  let i = 0;
  while (i < body.length) {
    const lt = body.indexOf('<', i);
    if (lt < 0) break;
    if (/^<g[\s>]/.test(body.slice(lt, lt + 3))) {
      let depth = 0;
      let j = lt;
      while (j < body.length) {
        const next = body.indexOf('<', j);
        if (next < 0) break;
        if (/^<g[\s>]/.test(body.slice(next, next + 3))) depth++;
        else if (body.startsWith('</g>', next)) {
          depth--;
          if (depth === 0) {
            j = next + 4;
            break;
          }
        }
        j = next + 1;
      }
      nodes.push(body.slice(lt, j));
      i = j;
    } else {
      const gt = body.indexOf('>', lt);
      if (gt < 0) break;
      nodes.push(body.slice(lt, gt + 1));
      i = gt + 1;
    }
  }
  return nodes;
}

async function inkBox(svg, W) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 72 * SS })
    .resize({ width: W * SS })
    .flatten({ background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < info.width * info.height; p++) {
    const o = p * info.channels;
    if (data[o] > 244 && data[o + 1] > 244 && data[o + 2] > 244) continue;
    const x = p % info.width;
    const y = (p / info.width) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  return { x: x0 / SS, y: y0 / SS, w: (x1 - x0 + 1) / SS, h: (y1 - y0 + 1) / SS };
}

/**
 * Where a shape sits, even when it paints nothing.
 *
 * The knockout plates are white on white, so they have no ink to find. Rather
 * than parse path data to locate them — H and V take one number each, so
 * pairing the numbers off as x,y silently drifts — repaint them black and
 * measure that. It is the same renderer either way, so the answer agrees with
 * every other box by construction.
 */
const paintBlack = (node) => node.replace(/fill="#ffffff"/gi, 'fill="#000000"');

const inside = (b, r) => {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1;
};

export async function splitIntoParts(svgText, { outDir, geometryFile }) {
  const openEnd = svgText.indexOf('>') + 1;
  const header = svgText.slice(0, openEnd);
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(header);
  if (!vb) throw new Error('could not read the viewBox');
  const W = Number(vb[1]);
  const H = Number(vb[2]);

  const inner = svgText.slice(openEnd, svgText.lastIndexOf('</svg>'));
  const defsMatch = /<defs>[\s\S]*<\/defs>/.exec(inner);
  const defs = defsMatch ? defsMatch[0] : '';
  const body = defsMatch
    ? inner.slice(0, defsMatch.index) + inner.slice(defsMatch.index + defs.length)
    : inner;

  const assigned = Object.fromEntries(Object.keys(REGIONS).map((k) => [k, []]));
  for (const node of topLevelNodes(body)) {
    // the full-canvas rect is the page's own background, not a part
    if (/^<rect/.test(node) && node.includes(`width="${W}"`) && node.includes(`height="${H}"`)) {
      continue;
    }
    const box =
      (await inkBox(`${header}${defs}${node}</svg>`, W)) ??
      (await inkBox(`${header}${defs}${paintBlack(node)}</svg>`, W));
    if (!box) throw new Error(`node paints nothing even in black: ${node.slice(0, 80)}`);
    const hit = Object.keys(REGIONS).filter((k) => inside(box, REGIONS[k]));
    if (hit.length !== 1) {
      throw new Error(
        `node at (${box.x.toFixed(1)}, ${box.y.toFixed(1)}) matched ${hit.length} regions ` +
          `[${hit}]: ${node.slice(0, 80)}`,
      );
    }
    assigned[hit[0]].push(node);
  }

  mkdirSync(outDir, { recursive: true });
  const parts = {};
  for (const [id, group] of Object.entries(assigned)) {
    if (!group.length) throw new Error(`region "${id}" caught no nodes — did the artwork move?`);
    const box = await inkBox(`${header}${group.join('\n')}${defs}</svg>`, W);
    if (!box) throw new Error(`region "${id}" renders nothing`);
    // Crop by moving the viewBox, never the geometry: the paths keep the
    // coordinates they were authored with, so any part can still be checked
    // against the full artwork.
    const part =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" fill="none">\n` +
      `${group.join('\n')}\n${defs}</svg>\n`;
    writeFileSync(`${outDir}/${id}.svg`, part);
    parts[id] = {
      x: +box.x.toFixed(2),
      y: +box.y.toFixed(2),
      w: +box.w.toFixed(2),
      h: +box.h.toFixed(2),
    };
    const p = parts[id];
    console.log(
      `  ${id.padEnd(12)} ${String(part.length).padStart(7)}b  x ${p.x} y ${p.y} w ${p.w} h ${p.h}`,
    );
  }

  writeFileSync(
    geometryFile,
    `${JSON.stringify(
      {
        note: 'Generated by npm run build:landing — do not edit by hand.',
        viewBox: { w: W, h: H },
        parts,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`wrote ${geometryFile}`);
  return parts;
}
