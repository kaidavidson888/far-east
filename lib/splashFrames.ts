// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured to true red and
// sharpened — nothing else changed, nothing decodes a GIF at runtime).
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

// The source frame is 720 x 1600; these are the regions we care about, as
// fractions of that frame (measured off the baked frames).
export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // frame 0: the seal panel — the press-and-hold target ("boxy sides of the
  // mountain continued into a square"), centred.
  seal: { cx: 0.5, cy: 0.5, size: 0.34 }, // size as a fraction of frame width
  // last frame: the login box and its rows.
  box: { x0: 0.341, x1: 0.664, y0: 0.425, y1: 0.571 },
  rows: {
    email: { yTop: 0.436, yBot: 0.469, typeX0: 0.475, typeX1: 0.652 },
    password: { yTop: 0.487, yBot: 0.52, typeX0: 0.475, typeX1: 0.652 },
    submit: { yTop: 0.53, yBot: 0.566, typeX0: 0.35, typeX1: 0.66 },
  },
  wordX1: 0.47, // labels end / dashed area begins, roughly
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
