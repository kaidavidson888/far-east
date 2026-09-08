// The splash: recoloured, sharpened cloud frames from the source animation with
// their centre knocked out, plus vector overlays (logo, outline squares, login
// box) drawn on top at the source scale. `npm run build:splash` bakes the
// frames — nothing decodes a GIF at runtime.
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // The centred square the vector elements occupy, as a fraction of the frame.
  stage: 0.335,
  // Rows inside the login box, as fractions of the stage (loginbox.svg viewBox).
  // labelX1 = right end of that row's label + cloud (where typing may begin).
  rows: {
    email: { dashY: 0.135, tickX: 0.04, endX: 0.95, yTop: 0.04, yBot: 0.2, labelX1: 0.45 },
    password: { dashY: 0.515, tickX: 0.04, endX: 0.95, yTop: 0.42, yBot: 0.58, labelX1: 0.7 },
    submit: { dashY: 0.895, tickX: 0.04, endX: 0.95, yTop: 0.8, yBot: 0.96, labelX1: 0.82 },
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

/** The frame contained (whole frame visible) inside a w×h box, centred. */
export function coverRect(boxW: number, boxH: number) {
  const { w: iw, h: ih } = SPLASH_GEOM.frame;
  const scale = Math.min(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h, scale };
}
