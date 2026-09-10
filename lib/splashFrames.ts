// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains and the red clouds rising to full opacity).
// The frames keep the original login box's red outline; its black parts (labels,
// ☁, dashes) are drawn crisp on top from blackbox.webp once the form is up.
// Nothing decodes a GIF at runtime.
// `edge.webp` — the final red pattern with the box reflected over — tiles beside
// the frame to continue the design to the screen edges.
// `settle.webp` — the last frame with every black part at 0; drawn straight over
// the frame on latch so the baked black is gone at once (no white patch).
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

import {
  SPLASH_EDGE_BANDS, SPLASH_EDGE_B64, SPLASH_ASSET_V, SPLASH_EMAIL_LABEL_ASPECT,
} from './splashEdgeProfile';

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

// Per-frame edge-coverage profile: for each frame, SPLASH_EDGE_BANDS bands of
// red density in a strip just inside the LEFT frame edge, then the same for the
// RIGHT. paint() reveals the tiled margins through this so they finger outward
// in the frame's own organic shape — baked (in lib/splashEdgeProfile.ts, by
// build-splash-frames.mjs) so paint() never getImageData's (that stretched the
// animation on slower machines).
export { SPLASH_EDGE_BANDS };

let splashEdgeData: Uint8Array | null = null;
function splashEdge(): Uint8Array {
  if (!splashEdgeData) {
    const bin = atob(SPLASH_EDGE_B64);
    splashEdgeData = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) splashEdgeData[i] = bin.charCodeAt(i);
  }
  return splashEdgeData;
}

/**
 * Where the form sits inside the red outline box, and how heavy each part reads
 * when nothing is focused. Shared: SplashLoginFields positions its DOM windows
 * with these, and paint() draws the fading-in canvas copy with the same numbers,
 * so the two are the same pixels at the same weight and the handover is silent.
 */
export const SPLASH_FORM = {
  // Horizontal placement is not a tuned number any more: it is whatever centres
  // the whole overlay in the baked box. As DRAWN the widest thing in it is the
  // dashed line, and its window clips the sprite at both ends — the tick's
  // leftmost pixel (21 of 215) and the email row's rightmost dash pixel (193)
  // each straddle the window edge — so the overlay's ink spans exactly 0.100 to
  // 0.900 and is already symmetric about the box centre. ox = (1 - 0.100 - 0.900)
  // / 2 = 0. The old -0.070 left 0.028 of box on the left against 0.182 on the
  // right; the whole overlay was hanging off to one side.
  ox: 0, // fractions of the box
  oy: -0.0066,
  idle: { label: 0.5, cloud: 1, line: 0.5 },
  // the overlay fades up from nothing across this span of the run — it starts
  // where the frames' own black first branches into the box and finishes with
  // the animation, so the words arrive as the tendrils reach for them
  fadeFrom: 0.36,
  fadeTo: 1,
};

/** Edge-coverage profile at `ms` for one side (0 = left, 1 = right), 0..1 per band. */
export function edgeProfileAt(ms: number, side: 0 | 1): Float32Array {
  const data = splashEdge();
  const N = SPLASH_EDGE_BANDS;
  const rowLen = N * 2;
  const f = ms / SPLASH_FRAME_MS;
  const i = Math.max(0, Math.min(SPLASH_FRAME_COUNT - 1, Math.floor(f)));
  const j = Math.min(SPLASH_FRAME_COUNT - 1, i + 1);
  const t = f - i;
  const oi = i * rowLen + side * N;
  const oj = j * rowLen + side * N;
  const out = new Float32Array(N);
  for (let b = 0; b < N; b += 1) out[b] = (data[oi + b] * (1 - t) + data[oj + b] * t) / 255;
  return out;
}

// The EMAIL row's label is supplied artwork (scripts/assets/phone-label.svg →
// phone-label.webp), not a slice of the baked sprite. Its width follows the
// artwork's own aspect: SPLASH_GEOM.box is square in source pixels
// (0.336 × 720 = 0.1511 × 1600 = 242), so a height fraction times an aspect is
// a width fraction.
//
// h is set off the shared P. In the art the P is the tallest thing there is,
// rows 0-272 of 273, because its stem carries a tail below the baseline (the O
// reaches 0-255, the flat H/N/E/# only 5-249). Matching the art's full ink
// height to PASSWORD's letters therefore matches the two Ps, which is the
// comparison the eye makes — they are the first letter of both rows and sit
// side by side at the left edge. PASSWORD's letters are 0.0698 of the box, NOT
// the 0.0744 an earlier measurement gave: the label window's y1 (0.555) reaches
// past dY0 (0.552), so the bottom rows of that window are the dashed line
// rather than the word.
//
// y0 is set so the ink box still ENDS at 0.2186 where it did, keeping the P's
// tail tucked just above the dashes; the art shrinks upward from there.
//
// x0 is set from the dashed rule that opens the row, not from the other rows'
// first letter directly. The password row is the model: its rule's ink ends at
// 0.1093 and its P starts at 0.1116, a gap of 0.0023, and the submit row
// already matches. The email rule is a little wider — sprite columns 44-48
// against 43-46 — so its ink ends at 0.1140 and the artwork starts 0.0023 past
// that, at 0.1163.
//
// Note 0.1023, which this used to be: that is where the RULE starts, not the
// letter. Measuring "PASSWORD's ink" from x0 0.100 picked up the rule as the
// first thing it found, so the artwork was lined up against the wrong mark —
// and once the rule was actually being drawn the two overlapped.
const EMAIL_LABEL = { x0: 0.1163, y0: 0.1488, h: 0.0698 };

// Everything measured off the baked last frame (f100), as fractions.
export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // frame 0: the seal panel — the press-and-hold target, centred.
  seal: { cx: 0.5, cy: 0.5, size: 0.34 }, // fraction of frame width
  // the login box outline's exact footprint (its outer red border edges) — the
  // baked box is already dead-centre. loginbox-parts.svg is stretched into this.
  box: { x0: 0.3312, x1: 0.6672, y0: 0.4241, y1: 0.5752 },
  boxDy: 0, // vertical nudge of the drawn frame (fraction of height)
  // Per row, as fractions of the BOX — measured off the black baked into f100
  // (the reference the vector overlay must match 1:1). Three non-overlapping
  // sprite windows of blackbox.webp: label x[x0..mid], ☁ x[mid..cloudX1] (both
  // y[y0..y1]), dashed line x[x0..dashX1] y[dY0..dY1]. Typed text sits on the
  // dash: left x0, baseline just above dY0.
  //
  // Each row opens with a dashed vertical RULE, perpendicular to the dashed
  // line and as tall as the whole row. Mapped off the sprite it is x 44-48 on
  // email, 43-46 on password, 43-47 on submit, and it runs the full label band
  // before carrying on into the dash band.
  //
  // It is part of the dashes, not of the word, so it gets its own window at the
  // LINE opacity: x[x0..ruleX1] y[y0..dY0]. Two things were wrong before.
  // Sitting inside the label window it took the LABEL opacity, so it dimmed to
  // 0.1 with a field focused instead of rising to 1 with the rest of the
  // dashes. And on the email row it vanished altogether when the label became
  // artwork, because nothing draws the sprite in that x range any more.
  //
  // labelX0 starts the label window after the rule so the two do not overlap —
  // stacked windows composite, and 0.5 over 0.5 is 0.75.
  //
  // y1 == dY0 on every row, and it has to: the windows are drawn on top of each
  // other, so any row of the sprite that sits in both the ☁ window and the line
  // window gets painted twice — once at the ☁'s opacity 1 and once at the
  // line's 0.5 — and comes out at 0.75 instead of 0.5. That left a darker
  // stretch of dashes under each ☁. y1 used to overrun dY0 by 0.002-0.003 of
  // the box, which was under half a sprite pixel at 215 and easy to miss;
  // baking the sprite at 430 doubled it and made it obvious.
  emailLabel: { ...EMAIL_LABEL, w: EMAIL_LABEL.h * SPLASH_EMAIL_LABEL_ASPECT },
  parts: {
    // cloudDx moves where the email ☁ is DRAWN without moving what is sampled
    // for it — the sprite windows otherwise use one pair of fractions for both,
    // so shifting the window slides it onto blank sprite. It is the width the
    // artwork adds over the word it replaces, so the gap from label to ☁ stays
    // the 0.0139 it was (baked EMAIL ink ended at 0.3442, the ☁ ink starts at
    // 0.3581) and moves with the label rather than away from it. No y is
    // touched: the ☁ stays on the line it was on, and dashX1 is untouched so the
    // dashes and the tick at their left end are exactly as baked.
    email:    { x0: 0.100, labelX0: 0.1140, mid: 0.350, cloudX1: 0.495, cloudDx: 0.1653, dashX1: 0.900, ruleX1: 0.1140, y0: 0.146, y1: 0.218, dY0: 0.218, dY1: 0.238 },
    password: { x0: 0.100, labelX0: 0.1093, mid: 0.565, cloudX1: 0.702, dashX1: 0.892, ruleX1: 0.1093, y0: 0.480, y1: 0.552, dY0: 0.552, dY1: 0.573 },
    submit:   { x0: 0.100, labelX0: 0.1116, mid: 0.758, cloudX1: 0.900, dashX1: 0.900, ruleX1: 0.1116, y0: 0.800, y1: 0.887, dY0: 0.887, dY1: 0.908 },
  },
};

// Every baked asset carries the build's content hash. They all live at fixed
// paths and are rewritten in place by each rebuild, so without this a browser
// holding some of them in cache will mix old frames with new ones — which looks
// like a half-applied edit rather than a caching problem.
export const splashAsset = (name: string) => `/splash/${name}?v=${SPLASH_ASSET_V}`;

const src = (i: number) => splashAsset(`frames/f${String(i).padStart(3, '0')}.webp`);

let frames: HTMLImageElement[] | null = null;
let edge: HTMLImageElement | null = null;
let settle: HTMLImageElement | null = null;
let blackbox: HTMLImageElement | null = null;
let emailLabel: HTMLImageElement | null = null;

export function splashFrames(): HTMLImageElement[] {
  if (!frames) {
    frames = Array.from({ length: SPLASH_FRAME_COUNT }, (_, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src(i);
      return img;
    });
  }
  return frames;
}

/** The final red pattern, box reflected over — tiled into the screen margins. */
export function edgeImage(): HTMLImageElement {
  if (!edge) {
    edge = new Image();
    edge.decoding = 'async';
    edge.src = splashAsset('edge.webp');
  }
  return edge;
}

/** The last frame with every black part at 0 — cross-faded in once latched. */
export function settleImage(): HTMLImageElement {
  if (!settle) {
    settle = new Image();
    settle.decoding = 'async';
    settle.src = splashAsset('settle.webp');
  }
  return settle;
}

/** The box's black content, transparent bg — the 1:1 login-box overlay sprite. */
export function blackboxImage(): HTMLImageElement {
  if (!blackbox) {
    blackbox = new Image();
    blackbox.decoding = 'async';
    blackbox.src = splashAsset('blackbox.webp');
  }
  return blackbox;
}

/** The EMAIL row's label artwork, black on transparent, trimmed to its ink. */
export function emailLabelImage(): HTMLImageElement {
  if (!emailLabel) {
    emailLabel = new Image();
    emailLabel.decoding = 'async';
    emailLabel.src = splashAsset('phone-label.webp');
  }
  return emailLabel;
}

export function preloadSplashFrames(): Promise<void> {
  const imgs = splashFrames();
  imgs.forEach((img) => void img.decode().catch(() => {}));
  void edgeImage().decode().catch(() => {});
  void settleImage().decode().catch(() => {});
  void blackboxImage().decode().catch(() => {});
  void emailLabelImage().decode().catch(() => {});
  return imgs[0].decode().catch(() => {});
}

export function frameAt(ms: number): number {
  const imgs = splashFrames();
  let i = Math.round(ms / SPLASH_FRAME_MS);
  i = i < 0 ? 0 : i >= imgs.length ? imgs.length - 1 : i;
  while (i > 0 && !(imgs[i].complete && imgs[i].naturalWidth)) i--;
  return i;
}

/** The whole frame fit inside a w×h box (contain) and centred — source scale. */
export function coverRect(boxW: number, boxH: number) {
  const { w: iw, h: ih } = SPLASH_GEOM.frame;
  const scale = Math.min(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h, scale };
}
