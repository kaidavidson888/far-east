// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains and the red clouds rising to full opacity).
// The frames keep the original login box's red outline; its black parts (labels,
// ☁, dashes) are drawn crisp on top from loginbox-parts.svg once the form is up.
// Nothing decodes a GIF at runtime.
// `edge.webp` — the final red pattern with the box reflected over — tiles beside
// the frame to continue the design to the screen edges.
// `settle.webp` — the last frame with every black part at 0; cross-faded in on
// latch so the baked black goes to 0 without a white patch.
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

// How far down the frame the cloud pattern has spread, per frame (0..1). Printed
// by build-splash-frames.mjs. Used to reveal the edge tiles in step with it.
// prettier-ignore
export const SPLASH_SPREAD = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.279,0.279,0.313,0.314,0.315,0.316,0.341,0.341,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.368,0.368,0.369,0.369,0.369,0.369,0.369,0.433,0.434,0.434,0.436,0.454,0.464,0.504,0.54,0.586,0.629,0.637,0.649,0.672,0.707,0.729,0.753,0.775,0.779,0.814,0.831,0.831,0.831,0.849,0.884,0.886,0.886,0.908,0.943,0.961,0.992,1,1,1,1,1];

export function spreadAt(ms: number): number {
  const f = ms / SPLASH_FRAME_MS;
  const i = Math.max(0, Math.min(SPLASH_SPREAD.length - 1, Math.floor(f)));
  const j = Math.min(SPLASH_SPREAD.length - 1, i + 1);
  const t = f - i;
  return SPLASH_SPREAD[i] * (1 - t) + SPLASH_SPREAD[j] * t;
}

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
  parts: {
    email:    { x0: 0.100, mid: 0.350, cloudX1: 0.495, dashX1: 0.900, y0: 0.146, y1: 0.220, dY0: 0.218, dY1: 0.238 },
    password: { x0: 0.100, mid: 0.565, cloudX1: 0.702, dashX1: 0.892, y0: 0.480, y1: 0.555, dY0: 0.552, dY1: 0.573 },
    submit:   { x0: 0.100, mid: 0.758, cloudX1: 0.900, dashX1: 0.900, y0: 0.800, y1: 0.889, dY0: 0.887, dY1: 0.908 },
  },
};

const src = (i: number) => `/splash/frames/f${String(i).padStart(3, '0')}.webp`;

let frames: HTMLImageElement[] | null = null;
let edge: HTMLImageElement | null = null;
let settle: HTMLImageElement | null = null;
let blackbox: HTMLImageElement | null = null;

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
    edge.src = '/splash/edge.webp';
  }
  return edge;
}

/** The last frame with every black part at 0 — cross-faded in once latched. */
export function settleImage(): HTMLImageElement {
  if (!settle) {
    settle = new Image();
    settle.decoding = 'async';
    settle.src = '/splash/settle.webp';
  }
  return settle;
}

/** The box's black content, transparent bg — the 1:1 login-box overlay sprite. */
export function blackboxImage(): HTMLImageElement {
  if (!blackbox) {
    blackbox = new Image();
    blackbox.decoding = 'async';
    blackbox.src = '/splash/blackbox.webp';
  }
  return blackbox;
}

export function preloadSplashFrames(): Promise<void> {
  const imgs = splashFrames();
  imgs.forEach((img) => void img.decode().catch(() => {}));
  void edgeImage().decode().catch(() => {});
  void settleImage().decode().catch(() => {});
  void blackboxImage().decode().catch(() => {});
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
