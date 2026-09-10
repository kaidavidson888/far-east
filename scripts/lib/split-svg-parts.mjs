/**
 * Cuts a flattened page artwork into one SVG per element.
 *
 * Every page on this site built from a supplied design holds that design's
 * edge margins in real pixels at any viewport width, which means each mark has
 * to be positioned on its own — and that cannot be done while the page is a
 * single flat image.
 *
 * The caller supplies `regions`: a box per element, in artwork coordinates.
 * Nodes are assigned by where they sit rather than by their index, so a
 * re-export that reorders the document still lands each piece in the right
 * group. A node falling outside every region, a node matching two, or a region
 * catching nothing is a hard error — a silently missing mark on a page is
 * worse than a failed build.
 *
 * `background` is the page's own colour. Ink is anything that differs from it,
 * so this works on the landing page's white ground and the about page's red
 * one alike. A shape painted in the background colour is invisible and has no
 * ink box; those are located by repainting them and measuring that instead.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SS = 4; // supersample, for a sub-pixel ink box

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  if (!m) throw new Error(`background must be a #rrggbb colour, got ${c}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

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

async function inkBox(svg, W, bg) {
  const [br, bgr, bb] = bg;
  const { data, info } = await sharp(Buffer.from(svg), { density: 72 * SS })
    .resize({ width: W * SS })
    .flatten({ background: { r: br, g: bgr, b: bb } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < info.width * info.height; p++) {
    const o = p * info.channels;
    const d =
      Math.abs(data[o] - br) + Math.abs(data[o + 1] - bgr) + Math.abs(data[o + 2] - bb);
    if (d <= 24) continue; // within a hair of the page colour: not a mark
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
 * Where a shape sits when it paints the page's own colour and so leaves no
 * ink. Repaint it and measure that — the same renderer either way, so the
 * answer agrees with every other box by construction. Parsing path data
 * instead would drift: H and V take one number each, so pairing the numbers
 * off as x,y goes wrong at the first horizontal line.
 */
const repaint = (node, colour) =>
  node
    .replace(/fill="(?!none)[^"]*"/gi, `fill="${colour}"`)
    .replace(/stroke="(?!none)[^"]*"/gi, `stroke="${colour}"`);

const inside = (b, r) => {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1;
};

/** The top-level children of <defs>, keyed by id. */
function parseDefs(defs) {
  const inner = /<defs>([\s\S]*)<\/defs>/.exec(defs)?.[1] ?? '';
  const byId = new Map();
  let i = 0;
  while (i < inner.length) {
    const lt = inner.indexOf('<', i);
    if (lt < 0) break;
    const name = /^<([\w:-]+)/.exec(inner.slice(lt, lt + 24))?.[1];
    if (!name) break;
    const gt = inner.indexOf('>', lt);
    if (gt < 0) break;
    let end;
    if (inner[gt - 1] === '/') {
      end = gt + 1;
    } else {
      const close = `</${name}>`;
      const at = inner.indexOf(close, gt);
      end = at < 0 ? gt + 1 : at + close.length;
    }
    const src = inner.slice(lt, end);
    const id = /\bid="([^"]+)"/.exec(src)?.[1];
    if (id) byId.set(id, src);
    i = end;
  }
  return byId;
}

const refsIn = (s) => [...s.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map((m) => m[1]);

/**
 * Just the defs a set of nodes actually needs, followed transitively.
 *
 * Without this every part carries the whole <defs>. On a page whose defs hold
 * a couple of megabytes of embedded images — as the about page's do — that
 * would copy all of them into all of the parts.
 */
function defsFor(nodes, byId) {
  const want = new Set();
  const queue = nodes.flatMap((n) => refsIn(n));
  while (queue.length) {
    const id = queue.pop();
    if (want.has(id) || !byId.has(id)) continue;
    want.add(id);
    queue.push(...refsIn(byId.get(id)));
  }
  if (!want.size) return '';
  // keep the document's own order, so nothing depends on discovery order
  const kept = [...byId.keys()].filter((id) => want.has(id)).map((id) => byId.get(id));
  return `<defs>\n${kept.join('\n')}\n</defs>`;
}

export async function splitIntoParts(
  svgText,
  { outDir, geometryFile, regions, background = '#ffffff', contrast = '#000000' },
) {
  if (!regions) throw new Error('splitIntoParts needs a regions map');
  const bg = hex(background);

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

  const defsById = parseDefs(defs);
  const assigned = Object.fromEntries(Object.keys(regions).map((k) => [k, []]));
  for (const node of topLevelNodes(body)) {
    // a full-canvas rect is the page's own ground, not a part
    if (/^<rect/.test(node) && node.includes(`width="${W}"`) && node.includes(`height="${H}"`)) {
      continue;
    }
    const box =
      (await inkBox(`${header}${defs}${node}</svg>`, W, bg)) ??
      (await inkBox(`${header}${defs}${repaint(node, contrast)}</svg>`, W, bg));
    if (!box) throw new Error(`node paints nothing even repainted: ${node.slice(0, 80)}`);
    const hit = Object.keys(regions).filter((k) => inside(box, regions[k]));
    if (hit.length !== 1) {
      throw new Error(
        `node at (${box.x.toFixed(1)}, ${box.y.toFixed(1)}) ${box.w.toFixed(1)}x${box.h.toFixed(1)} ` +
          `matched ${hit.length} regions [${hit}]: ${node.slice(0, 80)}`,
      );
    }
    assigned[hit[0]].push(node);
  }

  mkdirSync(outDir, { recursive: true });
  const parts = {};
  for (const [id, group] of Object.entries(assigned)) {
    if (!group.length) throw new Error(`region "${id}" caught no nodes — did the artwork move?`);
    const box = await inkBox(`${header}${group.join('\n')}${defs}</svg>`, W, bg);
    if (!box) throw new Error(`region "${id}" renders nothing`);
    // Crop by moving the viewBox, never the geometry: the paths keep the
    // coordinates they were authored with, so any part can still be checked
    // against the full artwork.
    const part =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" fill="none">\n` +
      `${group.join('\n')}\n${defsFor(group, defsById)}</svg>\n`;
    writeFileSync(`${outDir}/${id}.svg`, part);
    parts[id] = {
      x: +box.x.toFixed(2),
      y: +box.y.toFixed(2),
      w: +box.w.toFixed(2),
      h: +box.h.toFixed(2),
    };
    const p = parts[id];
    console.log(
      `  ${id.padEnd(14)} ${String(part.length).padStart(8)}b  x ${p.x} y ${p.y} w ${p.w} h ${p.h}`,
    );
  }

  writeFileSync(
    geometryFile,
    `${JSON.stringify(
      {
        note: 'Generated by the page build script — do not edit by hand.',
        viewBox: { w: W, h: H },
        background,
        parts,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`wrote ${geometryFile}`);
  return parts;
}
