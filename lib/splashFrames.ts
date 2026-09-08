// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains and the red clouds rising to full opacity).
// Nothing decodes a GIF at runtime. The login-box footprint is cleared to white
// on the canvas at paint time (not baked) so mirrored edge tiles stay clean.
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
  // the login box's footprint (fractions of the frame): cleared to white on the
  // canvas at paint time, and where loginbox-parts.svg is positioned. Near-square
  // (~240×250 of 720×1600) so the square-ish vector barely stretches.
  box: { x0: 0.331, x1: 0.667, y0: 0.423, y1: 0.569 },
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
