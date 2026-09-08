// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains and the red clouds rising to full opacity).
// The frames keep the original login box (the DOM box reveals top-down over it).
// Nothing decodes a GIF at runtime. `edge.webp` is the final pattern with the
// box reflected over — tiled beside the frame to continue the design to the
// screen edges.
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

// Regions we care about, as fractions of the 720×1600 source frame (measured
// off the baked last frame).
export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // frame 0: the seal panel — the press-and-hold target, centred.
  seal: { cx: 0.5, cy: 0.5, size: 0.34 }, // fraction of frame width
  // the login box's size (fractions of the frame), same as the baked box. The
  // frame is nudged down by BOX_DY when drawn so this lands dead-centre on the
  // page; the DOM box and its white backing are centred to match. #border in
  // loginbox-parts.svg draws at this edge.
  box: { x0: 0.332, x1: 0.668, y0: 0.4285, y1: 0.5715 },
  // vertical nudge (fraction of the drawn frame height) so the baked box, which
  // sits a hair high of the frame centre, renders at the page centre.
  boxDy: 0.0045,
  // per row, as fractions of the BOX (0..1 within it, = loginbox-parts.svg
  // viewBox fractions, printed by scripts/split-loginbox.mjs): the dashed line's
  // y and its left/right x. Typed text starts at lineX0, baseline above dashY.
  rows: {
    email:    { dashY: 0.156, lineX0: 0.069, endX: 0.976, yTop: 0.02, yBot: 0.28 },
    password: { dashY: 0.565, lineX0: 0.051, endX: 0.963, yTop: 0.42, yBot: 0.70 },
    submit:   { dashY: 0.956, lineX0: 0.058, endX: 0.974, yTop: 0.83, yBot: 1.0 },
  },
};

const src = (i: number) => `/splash/frames/f${String(i).padStart(3, '0')}.webp`;

let frames: HTMLImageElement[] | null = null;
let edge: HTMLImageElement | null = null;

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

/** The scaled backdrop pattern (box painted over), drawn behind the frame. */
export function edgeImage(): HTMLImageElement {
  if (!edge) {
    edge = new Image();
    edge.decoding = 'async';
    edge.src = '/splash/edge.webp';
  }
  return edge;
}

export function preloadSplashFrames(): Promise<void> {
  const imgs = splashFrames();
  imgs.forEach((img) => void img.decode().catch(() => {}));
  void edgeImage().decode().catch(() => {});
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
