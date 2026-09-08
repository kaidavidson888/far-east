// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains, the red clouds rising to full opacity, and
// the original login box painted over with cloud near the end). Nothing decodes
// a GIF at runtime. `edge.webp` is the final pattern with the box painted over —
// scaled up beside the frame to continue the design out to the screen edges.
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

// Regions we care about, as fractions of the 720×1600 source frame (measured
// off the baked last frame).
export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // frame 0: the seal panel — the press-and-hold target, centred.
  seal: { cx: 0.5, cy: 0.5, size: 0.34 }, // fraction of frame width
  // the login box's size (fractions of the frame). Positioned dead-centre on the
  // page (measure() / paint()), not at the frame fraction — the original box
  // sits a few px high. The frames erase the baked box; a tight white rect fills
  // just inside this, and loginbox-parts.svg #border draws at its edge.
  box: { x0: 0.332, x1: 0.668, y0: 0.4285, y1: 0.5715 },
  // per row, as fractions of the BOX (0..1 within it, = loginbox-parts.svg
  // viewBox fractions): the dashed line's y and its left/right x. Typed text
  // starts at lineX0 with its baseline just above dashY.
  rows: {
    email:    { dashY: 0.180, lineX0: 0.076, endX: 0.96, yTop: 0.03, yBot: 0.24 },
    password: { dashY: 0.572, lineX0: 0.076, endX: 0.96, yTop: 0.42, yBot: 0.63 },
    submit:   { dashY: 0.961, lineX0: 0.076, endX: 0.96, yTop: 0.82, yBot: 1.0 },
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
