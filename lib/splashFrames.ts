// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains and the red clouds rising to full opacity).
// Nothing decodes a GIF at runtime.
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
  // last frame: the login box and its rows (fractions of the frame).
  box: { x0: 0.34, x1: 0.664, y0: 0.426, y1: 0.577 },
  // each row's dashed line: y, the tick where typing begins, and the end;
  // yTop/yBot bound the row for the focus dimming; labelX1 = end of label+cloud.
  rows: {
    email: { dashY: 0.458, tickX: 0.375, endX: 0.64, yTop: 0.44, yBot: 0.472, labelX1: 0.475 },
    password: { dashY: 0.5125, tickX: 0.375, endX: 0.64, yTop: 0.495, yBot: 0.527, labelX1: 0.53 },
    submit: { dashY: 0.5625, tickX: 0.375, endX: 0.64, yTop: 0.545, yBot: 0.578, labelX1: 0.58 },
  },
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

export function preloadSplashFrames(): Promise<void> {
  const imgs = splashFrames();
  imgs.forEach((img) => void img.decode().catch(() => {}));
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
