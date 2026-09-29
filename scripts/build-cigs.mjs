/**
 * Turns the supplied pack photographs into page-ready marks.
 *
 *   npm run build:cigs
 *
 * The owner supplied 282 pack images of wildly mixed provenance: 1024 square
 * renders with alpha, phone-sized JPEGs on white, a handful of 300px
 * thumbnails. Many carry things that are not the pack — a catalogue number
 * printed underneath, a line of health-warning text, loose cigarettes lying
 * beside the box, a stroke clipped in from a neighbouring image. This levels
 * them into one set of just the boxes.
 *
 * HOW THE BOX IS FOUND. The backdrop is flood-filled in from the border —
 * connected, never a global colour key, because a pack's own white panels
 * are enclosed by its own edges and a global key eats them. What is left is
 * split into connected components; the box is far and away the largest, so
 * the crop is its bounding box plus any piece that genuinely overlaps it.
 * That last part cuts both ways, deliberately:
 *
 *   - it keeps a box whole when a pale band splits it in two — Panda's top
 *     edge comes back as its own 8px sliver and has to be welded back on;
 *   - and it refuses to grow for a piece that merely touches. Peel Pink has
 *     a stroke running down the left edge of the box and on into the caption
 *     below it; merging anything that touched pulled the crop down over the
 *     caption and the number came back. Requiring real overlap rather than
 *     contact is what separates the two cases.
 *
 * That alone is not enough. On several packs a soft drop shadow welds the
 * caption to the box, so they arrive as one component and no amount of
 * component logic will part them. A box is a solid object, though: nearly
 * every row through it spans its full width, where a line of text spans a
 * few percent. So each crop is also offered in a trimmed form, cut to the
 * longest run of solidly-filled rows and columns.
 *
 * Nor is that, on its own. Two dozen packs sit above a catalogue number with
 * the drop shadow running down into it, and the shadow is as wide as the
 * pack — so measured by coverage the rows below the box are as full as the
 * box's own, 0.87 to 0.97, and no threshold on width finds the bottom edge.
 * What separates them is opacity, not width: the pack is opaque, its shadow
 * is not. `squareOff` measures against that instead, which is what finally
 * took the numbers off. It is held to the same box-shape test as everything
 * else, because on Fiit Menthol it otherwise cut into the box and left it
 * at a ratio of 1.34.
 *
 * WHICH CROP WINS. A cigarette box is a known shape — this set's own ratios
 * sit between about 0.52 and 0.71, and the design draws them at 0.58 to
 * 0.69. So a crop that comes out box-shaped has almost certainly found the
 * box; one that does not has found the box plus something else, or a piece
 * of it. Of the box-shaped candidates the smallest wins, since that is the
 * one that shed the most that was not the box, with a floor so a bad trim
 * cannot eat a real box. Where nothing comes out box-shaped the plain crop
 * is kept untouched and the file is named in the build output — the
 * instruction was to keep the boxes as intact as possible, so where the two
 * aims pull against each other the box wins and I would rather report a
 * miss than damage one.
 *
 * THE GROUND IS THE PAGE'S WHITE. Not transparency: the backdrop is painted
 * #ffffff, exactly the landing page's own background. Several sources sit on
 * an off-white that reads as a faint panel against the page, and these are
 * only ever drawn on that white page.
 *
 * ONE HEIGHT. Every box is scaled to the same height so it sits in the
 * selection frame the same way; the width follows the box's own proportions,
 * which is what the design does (its packs are 90-94 high, 53-63 wide).
 *
 * WHY SVG. The owner asked for SVGs. These are photographs, so there is no
 * sensible vector to trace to — a trace of a pack render is both enormous
 * and worse-looking than the photograph. What an SVG buys here is the thing
 * the rest of the site's marks have: one self-contained file per pack, named
 * for its source, that scales and can be dropped anywhere.
 *
 * NAMES. The file keeps its source basename exactly — `101_Changbaishan-
 * Soft_Red` stays `101_Changbaishan-Soft_Red.svg` — because that is what the
 * buttons will be wired up by later. The display name comes from the
 * supplied menu list, matched on the leading number.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'C:/Users/Kai Davidson/Downloads/Far East/Cigs Images';
const MENU = 'scripts/assets/cigs/menu-list.txt';
const OUT_DIR = 'public/cigs';
const MANIFEST = 'lib/cigs.json';
/** Where each final crop box is recorded, for `npm run audit:cigs`. */
const CROPS = 'scripts/assets/cigs/crops.json';

/** Drawn height in design px, and the backing density. */
// the design's packs are 90, 92, 92, 92 and 94 high; 92 is the middle of that
const DRAWN_H = 92;
const SS = 3;
const QUALITY = 82;

/** The landing page's own background, which these are always drawn on. */
const GROUND = { r: 255, g: 255, b: 255 };

/** Specks below this share of the frame are never a box part. */
const SPECK = 1 / 20000;
/** How much of a piece must lie within the box's span to be part of it. */
const OVERLAP = 0.6;
/** Backdrop tolerances tried: plain paper, then a light grey card. */
const TOLERANCES = [232, 244];
/** A row counts as part of the solid box above this share of the width. */
const DENSE = 0.55;
/** ...and is still worth keeping as a soft edge above this. */
const LOOSE = 0.3;
/** What a cigarette box's width/height can plausibly be. */
const AR_MIN = 0.45;
const AR_MAX = 0.8;
/** No crop may keep less of the box than this share of the largest. */
const KEEP = 0.45;
/** At or above this alpha a pixel is the object, not its shadow. */
const SOLID_ALPHA = 200;
/** A row narrower than this share of the crop is not the pack. */
const SQUARE_FLOOR = 0.35;
/** ...and no more than this share may be squared off either end. */
const SQUARE_MAX = 0.18;
/**
 * A line this white, this consistently, at the edge of a crop is ground.
 *
 * Some of the supplied cut-outs are not tight: the alpha runs past the pack
 * into a margin of the photograph's own white paper, opaque and included, and
 * on the Lotus / Nanjing / Taishan block that margin is a tenth of the width
 * down the right-hand side. Nothing upstream removes it — the subject IS the
 * alpha when the source is a cut-out, so the crop is exactly as loose as the
 * cut-out was — and `squareOff` only ever looks at the top and bottom.
 *
 * 245 rather than pure white because the paper is photographed, not painted;
 * 0.995 rather than 1 for the same reason, so one stray speck of dust in a
 * column does not save a column of paper.
 */
const EDGE_WHITE = 245;
const EDGE_SHARE = 0.97;
/** ...and no more than this share may be peeled off any one side. */
const EDGE_MAX = 0.2;

/**
 * The two the reasoning above cannot reach, cropped by hand.
 *
 * Both are photographed on a light card with the catalogue number printed on
 * the card below the pack, and on both the number is drawn at partial alpha
 * — so it is neither a separate component (the card joins everything up) nor
 * distinguishable by opacity (the test that saved the other two dozen).
 * Fiit Menthol also has the clipped edge of the next photograph down its
 * left side, at x=190.
 *
 * Rectangles in source pixels, read off a grid render of each. Everything
 * else in this file is derived; these two are measured by eye, and they are
 * the only numbers here a re-export would invalidate. New source images of
 * those two packs on plain ground would make this table unnecessary.
 */
const HAND_CROP = {
  '281_THIS-Plus': { x0: 370, y0: 155, x1: 740, y1: 685 },
  '284_Fiit-Menthol': { x0: 332, y0: 227, x1: 790, y1: 618 },
  // These two for the opposite reason: the crop was cutting into them.
  // Mevius carries its "Smoking kills" panel as line art on transparency —
  // a black rule and black type over nothing — so by every measure here it
  // looks exactly like a caption, and the owner wants it kept. There is no
  // rule that keeps this and still drops Nanjing's number, because in the
  // source the two are drawn the same way. Its left edge is set past a
  // column of grey tabs that are not part of the photograph.
  '91_Mevius-Blue_6': { x0: 290, y0: 100, x1: 770, y1: 921 },
  // A soft pack, pale down its whole upper half, which the trim read as
  // empty and cut the silver top off.
  '128_Septwolves-Blue_Diamond': { x0: 258, y0: 102, x1: 764, y1: 921 },
  // Clipped down the left: the pack's purple edge and half the ESSE mark.
  '05_ESSE-Double_Shot_Red_White_Wine': { x0: 240, y0: 106, x1: 511, y1: 610 },
  // Half its face keyed away, so the widest box-shaped thing found stopped
  // inside the artwork. Stated to the pack's real edges, green side panel
  // included — see REPAIR above.
  '100_ESSE-Double_Shot_Green_Purple': { x0: 291, y0: 169, x1: 731, y1: 891 },
  // Its box has to be stated for the same reason: once the keyed-away dots are
  // filled back in, that white reads as BACKDROP to the crop's own reasoning,
  // which then trims two thirds of the pack away (drawn 50x92 -> 81x92 before
  // this line existed). A 'face' repair and a hand crop go together.
  '99_ESSE-Double_Shot_Black': { x0: 290, y0: 102, x1: 734, y1: 921 },
  // THE WHITE-FACE CLIPS, found by auditing every final crop against its
  // source (the owner saw packs cut in the row). Each of these has a white
  // face at an edge that the reasoning read as empty and cropped off — the
  // bottom warning lines on Hongtashan and Yunyan, the whole brand panel on
  // Ashima's top, the top of Raison's white face — or shaved by a rule's
  // width on Rothmans and Yuxi (file 219). Measured off the source: the box
  // is the pack's own extent on the cut side, and the build's on the others,
  // so the catalogue numbers and shadows below stay out.
  '52_Hongtashan-Classic_Hard_Pack': { x0: 250, y0: 102, x1: 772, y1: 921 },
  '110_Yunyan-Cloud_Dragon_Slim': { x0: 344, y0: 150, x1: 679, y1: 921 },
  '149_Ashima-Eternal_Love': { x0: 288, y0: 102, x1: 735, y1: 917 },
  '219_Liqun-Classic_Red_White': { x0: 303, y0: 111, x1: 731, y1: 857 },
  '255_Rothmans-King_Size': { x0: 220, y0: 141, x1: 678, y1: 851 },
  // A pale pack: its white top, emblem and all, read as paper and went.
  '144_Zhenlong-Ice_Pure': { x0: 291, y0: 102, x1: 732, y1: 921 },

  // THE PAPER DOWN THE RIGHT-HAND SIDE, at last (the owner's 2026-09-23:
  // "make sure theres no white between the pack and the black on user
  // hover"). These are the Lotus / Nanjing / Taishan / Huanghelou block this
  // file and CLAUDE.md already describe: the supplied cut-out's ALPHA runs
  // past the pack into a margin of the photograph's own paper, opaque, so it
  // came along, and `tighten()` declines to peel it because on a pale pack
  // the boundary between its own cream surface and the paper beside it is
  // exactly the thing not to guess at. Invisible on white paper; against the
  // black band that now fills the landing row's frame on hover it is a white
  // strip between the pack and the black.
  //
  // MEASURED, NOT GUESSED, and only on the side that is wrong. The paper is
  // FLAT — nine rows sampled down each column agree to within 4..16 levels —
  // and the pack arrives as a shadow ramp and then a jump, so the edge is
  // found by walking in until a column departs from the paper's own level and
  // STAYS departed. Every box below was then checked both ways: the column at
  // the new edge is still flat paper (so nothing is cut off the pack) and the
  // column twelve pixels inside is printed surface (so the pack really is
  // there). The other three sides keep the build's own answer, as the entries
  // above do — only the cut side is stated.
  //
  // `240_Nanjing-Black` was measured with them and LEFT ALONE: its proposed
  // edge read 192 where the others read 221..235, i.e. already on the pack's
  // own shading rather than on paper. A 5% tidier crop is not worth a risk of
  // eating a dark pack's edge.
  '222_Huanghelou-Fresh_Breeze': { x0: 238, y0: 130, x1: 747, y1: 921 },
  '223_Huanghelou-1916': { x0: 233, y0: 139, x1: 745, y1: 921 },
  '225_Huanghelou-Hongjing': { x0: 231, y0: 139, x1: 721, y1: 921 },
  '226_Huanghelou-Sakura': { x0: 231, y0: 132, x1: 733, y1: 921 },
  '227_Huanghelou-Galaxy': { x0: 231, y0: 138, x1: 724, y1: 921 },
  '228_Huanghelou-Heavenly_Fragrance': { x0: 229, y0: 143, x1: 720, y1: 921 },
  '229_Panda-Classic': { x0: 244, y0: 102, x1: 738, y1: 904 },
  '232_Lotus-Green': { x0: 242, y0: 119, x1: 729, y1: 904 },
  '234_Lotus-Silver': { x0: 242, y0: 128, x1: 730, y1: 904 },
  '236_Nanjing-Blue': { x0: 258, y0: 146, x1: 713, y1: 874 },
  '239_Nanjing-Pink': { x0: 256, y0: 105, x1: 701, y1: 874 },
  '241_Taishan-Baisha': { x0: 256, y0: 144, x1: 703, y1: 874 },
};

/**
 * A PANEL THE CUT-OUT KEYED AWAY, PUT BACK (the owner's 2026-09-29 "fix
 * mevius", then "fix the esse double shot pack iamge" and "fix the black one
 * too"). Three entries, and the bar for a fourth is high: everything else in
 * this file CHOOSES from the pixels it was given, and this one WRITES pixels
 * that were not there. What makes each of the three admissible is that the
 * missing thing is a FLAT panel whose printing survived — a white rectangle,
 * not a photograph being invented. Anything textured is out of scope, and the
 * four packs cut short in their own sources are left alone for that reason.
 *
 * THE WHITE IS ONE RULE, NOT A NUMBER PER PACK: the median luminance of the
 * pack's own fully-opaque pixels at 240 or above. Do not eyeball it — 225 was
 * guessed for the black ESSE and greyed it visibly against the landing page.
 *
 * `91_Mevius-Blue_6` is a blue pack over a white warning panel with black
 * lettering. Whatever made the cut-out keyed out white, so the panel went and
 * its lettering stayed — 41% of the pack's height, opaque only where the
 * letters are. The HAND_CROP note above records the earlier decision to KEEP
 * that region ("line art on transparency ... the owner wants it kept"), which
 * was right for the landing page: black type on nothing, over a white page,
 * reads as the panel. It stops being right on the shelf, whose page is black —
 * there the panel is black type on black and the pack has a hole in it.
 * Measured: 35.2% of that crop is transparent, and 92.3% of it is pure black
 * in RGB as well, so there is nothing under the mask to recover.
 *
 * WHAT MAKES THIS SAFE IS THAT THE REAL PANEL IS FLAT. It is not a photograph
 * being invented; it is a plain white rectangle whose lettering survived. The
 * white is not chosen either — 250 is the median of the white panel on
 * `64_Mevius-Island_Sunset`, the one Mevius in this same shoot that kept its
 * own (p10 246, p90 252).
 *
 * Everything else about the region is MEASURED at build time rather than
 * stated, so a re-supplied source cannot silently be mangled: the fill starts
 * below the last row that is still a solid pack, ends at the subject's own
 * foot, and spans the columns the pack occupies there. And if the holes are
 * gone — a fixed cut-out — the repair says so and does nothing.
 */
const REPAIR = {
  // BELOW the solid pack: the warning panel, and only that.
  '91_Mevius-Blue_6': { white: 250, fill: 'panel' },
  /*
   * THE WHOLE FACE, because on this one the key took the pack's white
   * wherever it found it rather than in one block (the owner's 2026-09-29
   * "fix the esse double shot pack image"). 48.3% of the crop is transparent
   * and 87.4% of that is pure black, so again there is nothing to recover —
   * but again the missing thing is FLAT WHITE, this pack being white with
   * purple and green splashes over it, and the splashes and the lettering
   * both survived.
   *
   * THE WHITE IS ONE MEASUREMENT FOR ALL THREE: the median of the pack's own
   * surviving TRUE white — every fully opaque pixel at luminance 240 or above,
   * in that photograph. It reads 251 here (29,179 samples) and 251 on the
   * black one, which is the reassuring part: the two were photographed in the
   * same shoot and the rule does not need a number per pack. (It was 247 for
   * a few minutes, off a looser sample that swept in mid-greys.)
   *
   * ITS CROP IS STATED TOO, and that is the other half of the fault: with
   * half the face keyed away the widest box-shaped thing the build could find
   * stopped at x=685, inside the artwork — it cut the second capsule dot in
   * half, ran "DOUBLE SHOT" off the edge and left the pack's GREEN SIDE PANEL
   * out altogether. `05_ESSE-Double_Shot_Red_White_Wine` is the same design
   * undamaged (0% transparent) and shows that side panel, which is what says
   * the green band at 697..731 is the pack and not a neighbour.
   *
   * WHAT THIS STILL DOES NOT FIX: the ESSE wordmark's last letter. It sat
   * further right than "DOUBLE SHOT" does — see the sibling — and the source
   * is cut clean through it where the side panel begins. Those pixels are not
   * in the file.
   */
  '100_ESSE-Double_Shot_Green_Purple': { white: 251, fill: 'face' },
  /*
   * THE SAME KEY, ON A BLACK PACK, AND IT TOOK THE DOTS (the owner's "fix the
   * black one too"). 23.4% of this crop is transparent, 79% of that pure
   * black. What is missing here is not a white FACE but the white dotted
   * spiral printed over a black one — which is why the holes are bordered by
   * DARK pixels, fringe median 52, where the green pack's are bordered by
   * pale ones at 188. Same fault, opposite surroundings.
   *
   * IT LOOKS RIGHT TODAY AND THAT IS THE TRAP. On the landing page's white
   * paper a hole shows the page through and reads as the white dot that
   * belongs there, so nothing was ever reported. On the shelf, whose page is
   * black, every one of those dots is a black hole and the spiral disappears.
   * The fill is what makes the mark say the same thing on both grounds.
   *
   * No hand crop: with the dots restored the build's own reasoning finds the
   * pack, and its answer is checked against the old one below.
   */
  '99_ESSE-Double_Shot_Black': { white: 251, fill: 'face' },
};

/**
 * Fill the keyed-away panel back in, in place, and say what it did.
 *
 * Returns null when there is nothing to repair, which is the answer a
 * corrected source should produce.
 */
function repairPanel(d, w, h, white, within, fill = 'panel') {
  // the subject is the alpha here; find its box, held to the pack's own
  // columns where a hand crop states them — this source carries a column of
  // grey tabs outside the pack that the crop discards, and the fill must not
  // wander out over them
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 128) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  x1 += 1; y1 += 1;
  if (within) {
    x0 = Math.max(x0, within.x0); x1 = Math.min(x1, within.x1);
    y0 = Math.max(y0, within.y0); y1 = Math.min(y1, within.y1);
    if (x1 - x0 < 10 || y1 - y0 < 10) return null;
  }
  const rowOpaque = (y) => {
    let n = 0;
    for (let x = x0; x < x1; x++) if (d[(y * w + x) * 4 + 3] >= 128) n++;
    return n / (x1 - x0);
  };
  // `face` fills the whole stated box: the key took this pack's white all
  // over rather than in one band, so there is no solid row to work down from.
  // It relies on the box being stated by hand, which is why REPAIR entries of
  // this kind carry a HAND_CROP beside them.
  if (fill === 'face') {
    // Stated box or nothing: see the note on 99_ESSE-Double_Shot_Black. Filling
    // a pack's white back in makes it look like paper to the crop, so a face
    // repair without a hand crop silently eats the pack.
    if (!within) return { needsBox: true };
    let filled = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] >= 128) continue;
        d[i] = white; d[i + 1] = white; d[i + 2] = white; d[i + 3] = 255;
        filled++;
      }
    }
    return filled ? { filled, from: y0, to: y1, x0, x1 } : null;
  }
  // the last row that is still a solid pack, and the first hollow one after it
  let solid = -1;
  for (let y = y0; y < y1; y++) if (rowOpaque(y) > 0.9) solid = y;
  if (solid < 0 || solid + 1 >= y1) return null;
  let hollow = 0;
  for (let y = solid + 1; y < y1; y++) hollow += 1 - rowOpaque(y);
  if (hollow < (y1 - solid - 1) * 0.5) return null; // not hollow enough to be this
  let filled = 0;
  for (let y = solid + 1; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] >= 128) continue;
      d[i] = white; d[i + 1] = white; d[i + 2] = white; d[i + 3] = 255;
      filled++;
    }
  }
  return { filled, from: solid + 1, to: y1, x0, x1 };
}

/**
 * Ten files whose names belong to the product before them.
 *
 * From 211 to 220 the numbering slips by one: the image in file N is the
 * product named at N+1, the whole way along. 217 is labelled Nanjing 12
 * Stars and is a black Baisha; 218 is labelled Baisha and is a Liqun; 219
 * is labelled Liqun and is a Yuxi. It runs cleanly from one end to the
 * other, which is what a single missing file does to a numbered list —
 * Huanghelou Celebration has no photograph, and everything after it
 * shuffled up into the gap.
 *
 * Keyed by the source file, valued by what it should be called. The whole
 * run has to move together, because each new name is the next file's old
 * one. `211_Huanghelou-Celebration` is free afterwards, and stays free
 * until someone supplies that photograph.
 *
 * Checked both sides of the run and two other brand boundaries; the slip is
 * confined to these ten. See `scripts/assets/cigs/naming-notes.md`.
 */
const RENUMBER = {
  '211_Huanghelou-Celebration': '212_Nanjing-Green',
  '212_Nanjing-Green': '213_Nanjing-Red',
  '213_Nanjing-Red': '214_Nanjing-Gold',
  '214_Nanjing-Gold': '215_Nanjing-Rainflower',
  '215_Nanjing-Rainflower': '216_Nanjing-Dream',
  '216_Nanjing-Dream': '217_Nanjing-12_Stars',
  '217_Nanjing-12_Stars': '218_Baisha-Harmony_of_the_World',
  '218_Baisha-Harmony_of_the_World': '219_Liqun-Classic_Red_White',
  '219_Liqun-Classic_Red_White': '220_Yuxi-Red_Gold',
  // 220 would become 221, which already exists — see DUPLICATES
};

/**
 * The same pack twice, under two catalogue numbers.
 *
 * The supplied set has 46 pairs of products sharing a name. Only 34 of them
 * are the same pack — the rest are genuinely different (More Menthol is a
 * green 120s in one and a white 20-class in the other; Nanjing Gold is a
 * pale floral pack and a navy one), so they stay, and their names will
 * collide when the buttons are wired. Every pair was compared by eye; a
 * perceptual hash could not be trusted to make the call, because the crop
 * differences between two shots of one pack outweigh the difference between
 * two similar packs.
 *
 * Of each duplicate the larger source is kept, except ESSE Change
 * Strawberry: the bigger file there is damaged, smeared through with white
 * streaks, so the smaller one wins.
 *
 * Listed by what is dropped, so the file that survives keeps its own name.
 */
const DUPLICATES = new Set([
  '01_Peel-Red_Wine', // keeping 68 (1254 vs 300)
  '02_Peel-Greek_Yogurt', // keeping 69
  '03_ESSE-Change_Mango', // keeping 70
  '98_ESSE-Change_Strawberry', // keeping 04 — this one is the damaged copy
  '09_Black_Jack_Supasawa-Mango', // keeping 184
  '10_Black_Jack_Supasawa-Lemon', // keeping 185
  '183_Black_Jack_Supasawa-Grapefruit', // keeping 06
  '158_555-Double_Ice', // keeping 11
  '157_555-Icy_Shine_Slim', // keeping 12
  '138_Alishan-Mango_Impression_Capsule', // keeping 13
  '150_Ashima-Platinum', // keeping 15
  '154_Baisha-Harmony_of_the_World_Dual_Mid-Size_Hard_Pack', // keeping 17
  '147_Double_Happiness-9mg_Nanyang', // keeping 22
  '87_Dragon_Phoenix-Deluxe_Hard_Pack', // keeping 26
  '107_Dragon_Phoenix-Golden_Encounter', // keeping 27
  '139_ESSE-Blue', // keeping 28
  '140_ESSE-Change', // keeping 29
  '141_ESSE-Menthol_5mg', // keeping 30
  '32_Furongwang-Bloom', // keeping 146 (1024 vs 314)
  '36_Furongwang-Hard_Pack_Mid-Size', // keeping 83
  '46_Guiyan-Essence', // keeping 104
  '47_Guiyan-Golden_Lily', // keeping 126
  '50_Haomao-Everjoy_Slim', // keeping 105
  '102_Hongtashan-Classic_Hard_Pack', // keeping 52
  '129_Hongtashan-Classic_Heritage', // keeping 53
  '153_Huanghelou-1916_Hard_Pack', // keeping 55
  '88_Huanghelou-8_Degrees_Hard_Pack', // keeping 57
  '116_Huanghelou-Blue_Hard_Pack', // keeping 58
  '84_Huanghelou-Gold_Elegant_Aroma', // keeping 71
  '108_Huanghelou-Gold_Ribbon_Hard_Pack', // keeping 72
  '85_Huanghelou-Soft_Blue', // keeping 76
  '112_Huanghelou-World_Famous_Tower', // keeping 78
  '103_Huangshan-New_No_1', // keeping 80
  '200_Alishan-Cherry_Blossom', // keeping 192
  // The far end of the slip above: this file holds a 中南海 EIGHT, which is
  // what 221 holds too. Only visible once the run is renumbered.
  '220_Yuxi-Red_Gold', // keeping 221_Zhongnanhai-8

  // NINE MORE, AND WHY THEY WERE NOT IN THE FIRST PASS (2026-09-29, the
  // owner's "remove all the duplicate packs").
  //
  // The pass above worked through the 46 pairs that SHARE A NAME, which is
  // the only place two files can obviously be one pack. Six of these nine do
  // not share a name — the same pack was filed twice under two spellings
  // ("Gold Classic" and "Golden Classic", "Fresh Cool Slim" and "Refreshing
  // Slim", "Soft Pack Nanyang" and "Soft Nanyang", "Vibrant Colors" and
  // "Grand Color") or with an A/B suffix — so nothing was ever going to put
  // them side by side. They were found by comparing every mark against every
  // other as a picture, and then, exactly as the note above insists, EACH
  // PAIR WAS LOOKED AT rather than taken on the score: the same sweep rates
  // two unrelated red packs at 0.95 and rates Peony A against Peony B, which
  // are plainly one pack, below its own threshold.
  //
  // The larger crop is kept, per the rule above. Four of these drop a 312px
  // thumbnail in favour of a 1024px photograph of the same pack, which is
  // the whole difference between 0.05 and 0.47 megapixels of cigarette.
  '41_Golden_Leaf-Golden_Mid-Size', // keeping 114 (0.05MP against 0.47)
  '42_Golden_Leaf-Love_Style', // keeping 111 (0.04MP against 0.41)
  '49_Hadmen-Gold_Classic', // keeping 121_Hadmen-Golden_Classic (0.05 / 0.42)
  '34_Furongwang-Fresh_Cool_Slim', // keeping 133_Furongwang-Refreshing_Slim
  '149_Ashima-Eternal_Love', // keeping 14 — same photograph, this one washed out
  '148_Double_Happiness-Soft_Nanyang', // keeping 24_..._Soft_Pack_Nanyang, ditto
  '95_Diamond-Lotus_Green_B', // keeping 94_..._A
  '152_Huanghelou-Grand_Color_Hard_Pack', // keeping 77_..._Vibrant_Colors_Hard_Pack
  '96_Peony-The_Great_Peony_A', // keeping 97_..._B (0.45MP against 0.40)
]);

/** Near-white, and flat enough to be a backdrop rather than a pack panel. */
const isPaper = (d, p, tol) =>
  d[p] > tol &&
  d[p + 1] > tol &&
  d[p + 2] > tol &&
  Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]) < 16;

const isClear = (d, p) => d[p + 3] < 24;

/**
 * Mark the backdrop, flooding in from the border.
 *
 * Connectivity is the whole point: a pack's white panel is enclosed by its
 * own edges, so the flood never reaches it. The flood crosses transparent
 * and near-white alike, so it copes with a cut-out and a photograph on paper
 * without being told which it has.
 */
function backdrop(d, w, h, tol) {
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (bg[i]) return;
    const p = i * 4;
    if (!(isClear(d, p) || isPaper(d, p, tol))) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return bg;
}

/** Everything that is not backdrop, grouped into connected pieces. */
function components(bg, w, h) {
  const seen = new Int32Array(w * h).fill(-1);
  const out = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (bg[s] || seen[s] >= 0) continue;
    const id = out.length;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    let n = 0;
    seen[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (bg[j] || seen[j] >= 0) continue;
          seen[j] = id;
          stack.push(j);
        }
      }
    }
    out.push({ x0, y0, x1, y1, n });
  }
  return out;
}

/** The share of `c` that lies within `box`, per axis. */
function overlaps(c, box) {
  const ox = Math.min(c.x1, box.x1) - Math.max(c.x0, box.x0) + 1;
  const oy = Math.min(c.y1, box.y1) - Math.max(c.y0, box.y0) + 1;
  if (ox <= 0 || oy <= 0) return false;
  return ox / (c.x1 - c.x0 + 1) >= OVERLAP && oy / (c.y1 - c.y0 + 1) >= OVERLAP;
}

/** The longest run of solidly-filled rows (or columns), plus soft edges. */
function solidRun(dens, lo, hi) {
  let bestStart = -1;
  let bestEnd = -2;
  let start = -1;
  for (let i = lo; i <= hi + 1; i++) {
    const on = i <= hi && dens[i] >= DENSE;
    if (on && start < 0) start = i;
    else if (!on && start >= 0) {
      if (i - 1 - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = i - 1;
      }
      start = -1;
    }
  }
  if (bestStart < 0) return null;
  // give back the softer edges — a rounded lid, a shadowed foot
  while (bestStart > lo && dens[bestStart - 1] >= LOOSE) bestStart--;
  while (bestEnd < hi && dens[bestEnd + 1] >= LOOSE) bestEnd++;
  return [bestStart, bestEnd];
}

/** The largest piece, welded to whatever genuinely overlaps it. */
function pieceBox(bg, w, h) {
  const comps = components(bg, w, h).filter((c) => c.n > w * h * SPECK);
  if (!comps.length) return null;
  comps.sort((a, b) => b.n - a.n);
  const main = comps[0];
  const box = { x0: main.x0, y0: main.y0, x1: main.x1, y1: main.y1 };
  for (const c of comps.slice(1)) {
    // measured against the main piece, never against the growing box: one
    // touching stroke must not walk the crop down onto a caption
    if (!overlaps(c, main)) continue;
    box.x0 = Math.min(box.x0, c.x0);
    box.y0 = Math.min(box.y0, c.y0);
    box.x1 = Math.max(box.x1, c.x1);
    box.y1 = Math.max(box.y1, c.y1);
  }
  return box;
}

/**
 * Which pixels are the object itself, as opposed to its shadow.
 *
 * This is the distinction the coverage mask cannot make. Most of these
 * sources are cut-outs with a soft drop shadow under the pack, and on a
 * couple of dozen of them the catalogue number sits just below that shadow.
 * The shadow is as wide as the pack, so by coverage the rows beneath the box
 * are every bit as full as the box's own — 0.87 to 0.97 — and no threshold
 * on width can find the bottom edge.
 *
 * Opacity can. The pack is opaque, the shadow is not, and the number is
 * opaque but narrow. Where the source has a real alpha channel that is what
 * gets used; where it does not (the thirty photographed on paper) there is
 * no shadow to confuse anything and the coverage mask is right already.
 */
function solidity(d, w, h, bg, hasAlpha) {
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) continue;
    solid[i] = hasAlpha ? (d[i * 4 + 3] >= SOLID_ALPHA ? 1 : 0) : 1;
  }
  return solid;
}

/**
 * The subject, judged without reference to any flood.
 *
 * `solidity` is derived from a backdrop mask, which makes it useless for
 * checking whether that same mask went wrong — and it does go wrong. Both
 * ESSE Change packs have a pale bevel down the left edge that the flood
 * reaches from the border and eats; the columns it took then look empty, so
 * the trimmed candidate cuts them off, and because the result is still
 * pack-shaped (0.55) nothing downstream objects. The ESSE logo ended up
 * flush against the cut edge.
 *
 * Alpha does not have that problem: where the source is a cut-out, the pack
 * is opaque whatever colour it happens to be. Where it is not a cut-out
 * there is no alpha to use and the plain flood is the best available.
 */
function subjectMask(d, w, h, hasAlpha) {
  if (!hasAlpha) {
    const bg = backdrop(d, w, h, TOLERANCES[0]);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = bg[i] ? 0 : 1;
    return out;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4 + 3] >= SOLID_ALPHA ? 1 : 0;
  return out;
}

/**
 * Does this crop end in the middle of the subject rather than at its edge?
 *
 * Sideways only, deliberately. What goes wrong horizontally is the flood
 * eating a pale bevel off the side of a pack — there is nothing but pack to
 * the left of a pack, so a filled column just outside the crop always means
 * the crop is too narrow. Vertically it is ambiguous: below a pack there
 * may be a catalogue number, which is exactly what the earlier passes work
 * to remove, and testing that edge too made three packs pull their captions
 * back in to avoid "cutting" them.
 */
function cutsThrough(subject, w, h, box) {
  const colAt = (x) => {
    let n = 0;
    for (let y = box.y0; y <= box.y1; y++) if (subject[y * w + x]) n++;
    return n / (box.y1 - box.y0 + 1);
  };
  if (box.x0 > 0 && colAt(box.x0 - 1) >= SQUARE_FLOOR) return true;
  if (box.x1 < w - 1 && colAt(box.x1 + 1) >= SQUARE_FLOOR) return true;
  return false;
}

/** Does this source carry a real cut-out, or is it flat on a backdrop? */
function hasCutout(d, w, h) {
  let clear = 0;
  for (let p = 3; p < d.length; p += 4) if (d[p] < 24) clear++;
  return clear / (w * h) >= 0.02;
}

/** Every crop worth considering: two tolerances, each with and without trim. */
function candidates(d, w, h) {
  const out = [];
  for (const tol of TOLERANCES) {
    const flood = { how: `paper>${tol}` };
    const bg = backdrop(d, w, h, tol);
    const box = pieceBox(bg, w, h);
    if (!box) continue;
    out.push({ how: flood.how, bg, box });

    const bw = box.x1 - box.x0 + 1;
    const rows = new Float32Array(h);
    for (let y = box.y0; y <= box.y1; y++) {
      let n = 0;
      for (let x = box.x0; x <= box.x1; x++) if (!bg[y * w + x]) n++;
      rows[y] = n / bw;
    }
    const ry = solidRun(rows, box.y0, box.y1);
    if (!ry) continue;
    const bh = ry[1] - ry[0] + 1;
    const cols = new Float32Array(w);
    for (let x = box.x0; x <= box.x1; x++) {
      let n = 0;
      for (let y = ry[0]; y <= ry[1]; y++) if (!bg[y * w + x]) n++;
      cols[x] = n / bh;
    }
    const rx = solidRun(cols, box.x0, box.x1);
    if (!rx) continue;
    out.push({
      how: `${flood.how}+solid`,
      bg,
      box: { x0: rx[0], y0: ry[0], x1: rx[1], y1: ry[1] },
    });
  }
  return out;
}

const area = (b) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
const ratio = (b) => (b.x1 - b.x0 + 1) / (b.y1 - b.y0 + 1);

/**
 * Square the crop off against the box's own edges.
 *
 * The last thing to come off is the clipped top of a catalogue number. On
 * a couple of dozen packs the number sits directly under the box with the
 * drop shadow running into it, so there is no clean gap to find and no
 * separate component to drop — the density just tapers from the box, through
 * the shadow, into the digits, and the earlier passes keep the lot.
 *
 * A box is a rectangle, though. Every row through it spans essentially the
 * same width, so the box's own median row is the reference, and the first
 * row at either end that falls short of it is where the box stops. Rows
 * beyond that are shadow, or a number, or the top of one.
 *
 * The measurement has to be made against the backdrop mask, never against
 * the finished picture: the ground is painted the page's white, so a white
 * pack read by colour looks like no pack at all. Measured this way the
 * reference sits at 1.0 for almost every pack; measured by colour it fell to
 * 0.39 for ESSE Blue and the trim ate a third of it.
 *
 * The cap is the safety line. Nothing here may take more than SQUARE_MAX off
 * an end, so a pack this reasoning does not suit loses a sliver rather than
 * a third of itself.
 */
function squareOff(solid, w, h, box) {
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const dens = new Float32Array(bh);
  for (let y = box.y0; y <= box.y1; y++) {
    let n = 0;
    for (let x = box.x0; x <= box.x1; x++) if (solid[y * w + x]) n++;
    dens[y - box.y0] = n / bw;
  }
  // Measured against the box's own middle. These boxes are photographed with
  // a little perspective, so the rows run about 0.99 across the middle and
  // 0.85 at the foot, and the number's sliver below that is 0.3 or less. The
  // cut has to sit between those, and the cap decides how far it may run.
  // An absolute floor, not a share of the box's own middle. A catalogue
  // number is a narrow mark — 0.2 or 0.3 of the width — while anything that
  // is really the pack spans nearly all of it, including the white warning
  // panel that Mevius and the Chinese packs carry along their foot. Judged
  // against the median instead, those panels came out short of it and got
  // cut: Mevius lost "Smoking kills" and Septwolves lost its silver top.
  const cap = Math.floor(bh * SQUARE_MAX);

  let top = 0;
  while (top < cap && dens[top] < SQUARE_FLOOR) top++;
  let bottom = 0;
  while (bottom < cap && dens[bh - 1 - bottom] < SQUARE_FLOOR) bottom++;
  if (!top && !bottom) return { box, trimmed: 0 };
  return {
    box: { x0: box.x0, y0: box.y0 + top, x1: box.x1, y1: box.y1 - bottom },
    trimmed: top + bottom,
  };
}

/**
 * Peel the photograph's own paper off the edges of a crop.
 *
 * WHY THIS IS NOT A COLOUR KEY, which the header rightly forbids. It only ever
 * eats INWARD FROM AN EDGE and it stops at the first line that is not paper, so
 * a pack's own white panel — which is enclosed by the pack, and so is always
 * behind at least one line of print, bevel or shadow — can never be reached. A
 * pack whose outermost column really is unbroken paper for a fifth of its width
 * does not exist in this set: checked against all 247, and the most any of them
 * gives up is the Taishan Qingxiu's 55px of margin.
 *
 * It is held to the same standard as squareOff: if peeling takes a crop that
 * was box-shaped and leaves something that is not, it has eaten the pack and is
 * thrown away whole.
 *
 * The share is measured over the crop's own opaque pixels, not over its full
 * height, so a line that is half transparent and half paper still counts as
 * paper rather than being diluted into looking like content.
 */
function tighten(data, w, h, box) {
  const paper = (i) => {
    const p = i * 4;
    return data[p + 3] <= SOLID_ALPHA
      || (data[p] >= EDGE_WHITE && data[p + 1] >= EDGE_WHITE && data[p + 2] >= EDGE_WHITE);
  };
  // a handful of pixels in a line may disagree — dust, a compression artefact
  const colShare = (x) => {
    let n = 0;
    for (let y = box.y0; y <= box.y1; y++) if (paper(y * w + x)) n++;
    return n / (box.y1 - box.y0 + 1);
  };
  const rowShare = (y) => {
    let n = 0;
    for (let x = box.x0; x <= box.x1; x++) if (paper(y * w + x)) n++;
    return n / (box.x1 - box.x0 + 1);
  };
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const capX = Math.floor(bw * EDGE_MAX);
  const capY = Math.floor(bh * EDGE_MAX);

  let left = 0;
  while (left < capX && colShare(box.x0 + left) >= EDGE_SHARE) left++;
  let right = 0;
  while (right < capX && colShare(box.x1 - right) >= EDGE_SHARE) right++;
  let top = 0;
  while (top < capY && rowShare(box.y0 + top) >= EDGE_SHARE) top++;
  let bottom = 0;
  while (bottom < capY && rowShare(box.y1 - bottom) >= EDGE_SHARE) bottom++;

  const peeled = left + right + top + bottom;
  if (!peeled) return { box, peeled: 0 };
  return {
    box: {
      x0: box.x0 + left,
      y0: box.y0 + top,
      x1: box.x1 - right,
      y1: box.y1 - bottom,
    },
    peeled,
    sides: { left, right, top, bottom },
  };
}

/** Of the box-shaped crops, the smallest — with a floor. See the header. */
function chooseBox(cands, subject, w, h) {
  const plain = cands[0];
  const fits = cands.filter((c) => ratio(c.box) >= AR_MIN && ratio(c.box) <= AR_MAX);
  if (!fits.length) return { ...plain, boxShaped: false };
  const floor = Math.max(...fits.map((c) => area(c.box))) * KEEP;
  const kept = fits.filter((c) => area(c.box) >= floor);
  kept.sort((a, b) => area(a.box) - area(b.box));
  // Smallest wins, but only among crops that stop at the subject's edge
  // rather than through it. Without this the ESSE packs took the crop that
  // had lost their pale left bevel to the flood, because it was the
  // smallest and it was still pack-shaped.
  const clean = kept.filter((c) => !cutsThrough(subject, w, h, c.box));
  if (clean.length) return { ...clean[0], boxShaped: true };
  return { ...kept[kept.length - 1], boxShaped: true };
}

/**
 * Give back anything the crop cut through.
 *
 * The trimmed candidates cut to the longest run of solidly-filled rows, and
 * on a pack whose lower third is a pale warning panel that run can stop
 * short of the pack's own foot. Mevius lost "Smoking kills" that way and
 * Septwolves lost its silver top — the crop ended in the middle of the
 * pack, not at the end of it.
 *
 * So after a box is chosen, each edge is pushed back out for as long as the
 * next row or column along is still substantially filled. A caption stops it
 * immediately, being narrow; the rest of a pack does not. It can never grow
 * past the plain crop, which is the whole of the subject.
 */
function unclip(solid, w, h, box, limit) {
  const rowAt = (y, x0, x1) => {
    let n = 0;
    for (let x = x0; x <= x1; x++) if (solid[y * w + x]) n++;
    return n / (x1 - x0 + 1);
  };
  const colAt = (x, y0, y1) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (solid[y * w + x]) n++;
    return n / (y1 - y0 + 1);
  };
  const out = { ...box };
  let moved = 0;
  // sideways only, for the reason given on cutsThrough
  while (out.x0 > limit.x0 && colAt(out.x0 - 1, out.y0, out.y1) >= SQUARE_FLOOR) {
    out.x0--;
    moved++;
  }
  while (out.x1 < limit.x1 && colAt(out.x1 + 1, out.y0, out.y1) >= SQUARE_FLOOR) {
    out.x1++;
    moved++;
  }
  return { box: out, moved };
}

/** "12. 555 — Icy Shine Slim" -> [12, "555 — Icy Shine Slim"] */
function readMenu() {
  const byNumber = new Map();
  for (const line of readFileSync(MENU, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(\d+)\.\s*(.+?)\s*$/.exec(line);
    if (m) byNumber.set(Number(m[1]), m[2]);
  }
  return byNumber;
}

/**
 * CIGS_ONLY=<substring> rebuilds just the sources whose filename contains it,
 * and prints what the reasoning decided for each instead of the usual tally.
 *
 * A full run takes minutes and wipes the output folder, which makes looking
 * at one pack's crop a slow way to spend an afternoon. In this mode nothing
 * is wiped and the manifest is left alone — it would otherwise be rewritten
 * with one entry in it — so the marks it writes land beside the existing set
 * and the manifest still describes all of them. Re-run the full build before
 * committing anything that changes a crop.
 */
const ONLY = process.env.CIGS_ONLY ?? '';

const menu = readMenu();
const files = readdirSync(SRC)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .filter((f) => !ONLY || f.includes(ONLY))
  .filter((f) => !DUPLICATES.has(f.replace(/\.(png|jpe?g)$/i, '')))
  .sort(
    (a, b) =>
      Number(a.match(/^\d+/)?.[0] ?? 0) - Number(b.match(/^\d+/)?.[0] ?? 0) ||
      a.localeCompare(b),
  );

if (!ONLY) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];
let bytes = 0;
let trimmed = 0;
let squared = 0;
let peeledCount = 0;
/** Every crop that gave up paper, so an outlier is visible rather than silent. */
const peels = [];
let handed = 0;
/** Every final crop in source pixels, written beside the manifest for the audit. */
const crops = [];
let unclipped = 0;
const unresolved = [];

for (const file of files) {
  const source = file.replace(/\.(png|jpe?g)$/i, '');
  // hand crops are keyed by the source file, since that is what they were
  // measured against; everything downstream uses the corrected name
  const id = RENUMBER[source] ?? source;
  const number = Number(id.match(/^\d+/)?.[0] ?? NaN);

  const { data, info } = await sharp(`${SRC}/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Put back a panel the cut-out keyed away, BEFORE anything measures this
  // source — the crop, the squaring off and the peel all have to see the pack
  // the repair leaves behind, not the hole.
  const toRepair = REPAIR[source];
  if (toRepair) {
    const r = repairPanel(data, w, h, toRepair.white, HAND_CROP[source], toRepair.fill);
    if (r) {
      if (r.needsBox) {
        throw new Error(`${source}: a 'face' repair needs a HAND_CROP to fill inside`);
      }
      console.log(
        `  ${source}: filled ${r.filled}px of keyed-away panel`
        + ` (y ${r.from}..${r.to}, x ${r.x0}..${r.x1}) at white ${toRepair.white}`,
      );
    } else {
      console.log(`  ${source}: nothing to repair — the source has its panel back`);
    }
  }

  const cands = candidates(data, w, h);
  if (!cands.length) throw new Error(`${file}: nothing left after clearing the backdrop`);
  const cutout = hasCutout(data, w, h);
  const subject = subjectMask(data, w, h, cutout);
  const chosen = chooseBox(cands, subject, w, h);
  const { bg, how, boxShaped } = chosen;
  const byHand = HAND_CROP[source];
  const solid = solidity(data, w, h, bg, cutout);
  const squaredResult = squareOff(solid, w, h, byHand ?? chosen.box);
  // Squaring off is held to the same standard as the crop itself: if it
  // takes a box-shaped crop and leaves something that is not box-shaped, it
  // has cut into the box and is thrown away. Fiit Menthol went to 1.34
  // without this.
  const base = byHand ?? chosen.box;
  const keepSquared =
    !byHand &&
    squaredResult.trimmed > 0 &&
    (ratio(squaredResult.box) >= AR_MIN && ratio(squaredResult.box) <= AR_MAX ||
      !(ratio(base) >= AR_MIN && ratio(base) <= AR_MAX));
  const afterSquare = keepSquared ? squaredResult.box : base;
  // Take the photograph's paper off the edges. Held to the same standard as
  // squaring off: a peel that leaves something no longer box-shaped has eaten
  // the pack, and is dropped whole. Hand crops are measured by eye and are the
  // answer already.
  const tightened = byHand ? { box: afterSquare, peeled: 0 } : tighten(data, w, h, afterSquare);
  const keepTight =
    tightened.peeled > 0 &&
    (ratio(tightened.box) >= AR_MIN && ratio(tightened.box) <= AR_MAX ||
      !(ratio(afterSquare) >= AR_MIN && ratio(afterSquare) <= AR_MAX));
  const squaredBox = keepTight ? tightened.box : afterSquare;
  if (keepTight) {
    peeledCount++;
    const side = tightened.sides;
    const bw = afterSquare.x1 - afterSquare.x0 + 1;
    const bh = afterSquare.y1 - afterSquare.y0 + 1;
    peels.push({
      id,
      deepest: Math.max(side.left / bw, side.right / bw, side.top / bh, side.bottom / bh),
      text: `${id} — L${side.left} R${side.right} T${side.top} B${side.bottom} of ${bw}x${bh}`,
    });
  }
  if (keepSquared) squared++;
  if (byHand) handed++;
  // a hand-measured rectangle is the answer; nothing grows it back
  const repaired = byHand
    ? { box: squaredBox, moved: 0 }
    : unclip(subject, w, h, squaredBox, cands[0].box);
  const box = repaired.box;
  if (repaired.moved) unclipped++;

  // paint the backdrop the page's own white, so nothing reads as a panel
  for (let i = 0; i < bg.length; i++) {
    if (!bg[i]) continue;
    const p = i * 4;
    data[p] = GROUND.r;
    data[p + 1] = GROUND.g;
    data[p + 2] = GROUND.b;
    data[p + 3] = 255;
  }

  const region = {
    left: box.x0,
    top: box.y0,
    width: box.x1 - box.x0 + 1,
    height: box.y1 - box.y0 + 1,
  };
  if (byHand) {
    // measured by eye; the automatic reasoning does not apply
  } else if (!boxShaped) {
    unresolved.push(
      `${id} — ${region.width}x${region.height}, ratio ${ratio(box).toFixed(2)}; left alone`,
    );
  } else if (how !== cands[0].how) {
    trimmed++;
  }

  // one height for every box; the width follows the box's own proportions,
  // rounded so the drawn box lands on whole pixels
  const drawnW = Math.max(1, Math.round((region.width / region.height) * DRAWN_H));

  if (ONLY) {
    const solid = { x0: w, x1: -1, y0: h, y1: -1 };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > SOLID_ALPHA) {
          if (x < solid.x0) solid.x0 = x;
          if (x > solid.x1) solid.x1 = x;
          if (y < solid.y0) solid.y0 = y;
          if (y > solid.y1) solid.y1 = y;
        }
      }
    }
    const sw = solid.x1 - solid.x0 + 1;
    const sh = solid.y1 - solid.y0 + 1;
    const fmt = (b) => `${b.x0},${b.y0} ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1} r=${ratio(b).toFixed(3)}`;
    console.log(`\n${id}`);
    console.log(`  cutout            ${cutout}`);
    console.log(`  solid alpha bbox  ${solid.x0},${solid.y0} ${sw}x${sh} r=${(sw / sh).toFixed(3)}`);
    console.log(`  widest candidate  ${fmt(cands[0].box)}  (${cands[0].how})`);
    console.log(`  chosen            ${fmt(chosen.box)}  (${chosen.how}, boxShaped=${boxShaped})`);
    console.log(`  squareOff         ${fmt(squaredResult.box)}  trimmed=${squaredResult.trimmed} kept=${keepSquared}`);
    console.log(`  tighten           ${fmt(tightened.box)}  peeled=${JSON.stringify(tightened.sides ?? {})} kept=${keepTight}`);
    console.log(`  unclip moved      ${repaired.moved}`);
    console.log(`  REGION            ${region.left},${region.top} ${region.width}x${region.height} r=${(region.width / region.height).toFixed(3)}`);
    console.log(`  drawn             ${drawnW}x${DRAWN_H}`);
    const slackR = region.left + region.width - 1 - solid.x1;
    const slackL = solid.x0 - region.left;
    console.log(`  slack around pack L=${slackL} R=${slackR} T=${solid.y0 - region.top} B=${region.top + region.height - 1 - solid.y1}`);
  }

  const webp = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract(region)
    .resize({ width: drawnW * SS, height: DRAWN_H * SS, fit: 'fill' })
    // opaque: the ground is the page's white, so there is no alpha to keep
    .flatten({ background: GROUND })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();

  const title = (menu.get(number) ?? id).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${drawnW}" height="${DRAWN_H}" viewBox="0 0 ${drawnW} ${DRAWN_H}">` +
    `<title>${title}</title>` +
    `<image x="0" y="0" width="${drawnW}" height="${DRAWN_H}" ` +
    `xlink:href="data:image/webp;base64,${webp.toString('base64')}"/>` +
    `</svg>\n`;

  writeFileSync(`${OUT_DIR}/${id}.svg`, svg);
  bytes += svg.length;

  manifest.push({
    id,
    name: menu.get(number) ?? id.replace(/^\d+_/, '').replace(/[-_]/g, ' '),
    w: drawnW,
    h: DRAWN_H,
  });
  // the crop itself, for `npm run audit:cigs` — kept out of the manifest,
  // which the landing row loads in the browser and has no use for it
  crops.push({
    id,
    source,
    box: { x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 },
    src: { w, h },
    hand: !!byHand,
  });
}

if (ONLY) {
  console.log('\nCIGS_ONLY: manifest and the rest of public/cigs left untouched.');
  process.exit(0);
}

writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:cigs — do not edit by hand.',
      drawnHeight: DRAWN_H,
      scale: SS,
      count: manifest.length,
      packs: manifest,
    },
    null,
    2,
  )}\n`,
);

const widths = manifest.map((m) => m.w).sort((a, b) => a - b);
console.log(`  ${DUPLICATES.size} dropped as duplicates of another entry`);
console.log(`${manifest.length} packs -> ${OUT_DIR} (${Math.round(bytes / 1024)}KB)`);
console.log(`  ${trimmed} needed more than the plain crop; ${squared} squared off at an edge; ${handed} cropped by hand; ${unclipped} grown back to the pack's own edge`);
console.log(`  ${peeledCount} had the photograph's own paper peeled off an edge`);
if (peels.length) {
  // deepest first: a peel much bigger than the rest is the one to look at, and
  // the cap means a crop sitting exactly at 20% probably wanted to go further
  peels.sort((a, b) => b.deepest - a.deepest);
  for (const p of peels.slice(0, 12)) {
    console.log(`    ${(p.deepest * 100).toFixed(1)}%  ${p.text}`);
  }
  if (peels.length > 12) console.log(`    ... and ${peels.length - 12} smaller`);
}
console.log(`  widths ${widths[0]}..${widths[widths.length - 1]} at height ${DRAWN_H}`);
if (unresolved.length) {
  console.log(`  ${unresolved.length} found no box-shaped crop and were left alone:`);
  for (const u of unresolved) console.log(`    ${u}`);
}
console.log(`wrote ${MANIFEST}`);
writeFileSync(
  CROPS,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:cigs — do not edit by hand. Read by scripts/audit-cigs.mjs.',
      source: SRC,
      crops,
    },
    null,
    1,
  )}\n`,
);
console.log(`wrote ${CROPS}`);
