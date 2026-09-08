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
  box: { x0: 0.332, x1: 0.662, y0: 0.42, y1: 0.578 },
  // per row: dashY = the dotted line; lineX0..endX = the line's extent (typed
  // text starts at lineX0); wordX1 = end of the label; cloudX1 = end of the ☁.
  rows: {
    email:    { dashY: 0.4585, lineX0: 0.367, endX: 0.636, wordX1: 0.45, cloudX1: 0.502, yTop: 0.432, yBot: 0.478 },
    password: { dashY: 0.5090, lineX0: 0.367, endX: 0.636, wordX1: 0.52, cloudX1: 0.573, yTop: 0.483, yBot: 0.529 },
    submit:   { dashY: 0.5610, lineX0: 0.367, endX: 0.636, wordX1: 0.59, cloudX1: 0.636, yTop: 0.535, yBot: 0.581 },
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
