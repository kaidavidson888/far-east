// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured to true red and
// sharpened — nothing else changed, nothing decodes a GIF at runtime).
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

// The source frame is 720 x 1600; these are the regions we care about, as
// fractions of that frame (measured off the baked last frame).
export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // frame 0: the seal panel — the press-and-hold target ("boxy sides of the
  // mountain continued into a square"), centred.
  seal: { cx: 0.5, cy: 0.5, size: 0.34 }, // fraction of frame width
  // last frame: the login box.
  box: { x0: 0.34, x1: 0.666, y0: 0.425, y1: 0.577 },
  // Each row's dashed line: y, the "tick" where it starts (= where typed text
  // begins), and where it ends. yTop/yBot bound the row for the focus dimming.
  rows: {
    email: { dashY: 0.456, tickX: 0.369, endX: 0.64, yTop: 0.437, yBot: 0.475 },
    password: { dashY: 0.511, tickX: 0.369, endX: 0.64, yTop: 0.492, yBot: 0.53 },
    submit: { dashY: 0.5625, tickX: 0.369, endX: 0.64, yTop: 0.543, yBot: 0.58 },
  },
  labelX1: 0.52, // label + cloud occupy tickX..labelX1
  designWeight: 0.0032, // stroke weight of the red cloud line-work, as a frac of frame width
};

const src = (i: number) => `/splash/frames/f${String(i).padStart(3, '0')}.webp`;

let frames: HTMLImageElement[] | null = null;

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

/** Decode the frames in order; resolves once frame 0 is paintable. */
export function preloadSplashFrames(): Promise<void> {
  const imgs = splashFrames();
  imgs.forEach((img) => void img.decode().catch(() => {}));
  return imgs[0].decode().catch(() => {});
}

/** Frame index for a scrub position in ms, clamped to what has decoded. */
export function frameAt(ms: number): number {
  const imgs = splashFrames();
  let i = Math.round(ms / SPLASH_FRAME_MS);
  i = i < 0 ? 0 : i >= imgs.length ? imgs.length - 1 : i;
  while (i > 0 && !(imgs[i].complete && imgs[i].naturalWidth)) i--;
  return i;
}

/** Where the frame is actually drawn inside a w×h box under object-fit: cover. */
export function coverRect(boxW: number, boxH: number) {
  const { w: iw, h: ih } = SPLASH_GEOM.frame;
  const scale = Math.max(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}
