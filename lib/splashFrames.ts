// The login splash plays a set of pre-baked, recoloured WebP stills that we
// scrub back and forth. The frames are generated at build time by
// `npm run build:splash` from scripts/assets/login-source.gif — nothing decodes
// a GIF at runtime.
//
// 51 frames, 80ms apart — 4.00s of animation, then the last frame is held.
// (Every 2nd source frame; see scripts/build-splash-frames.mjs.)

export const SPLASH_FRAME_MS = 80;
export const SPLASH_FRAME_COUNT = 51;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

const src = (i: number) => `/splash/frames/f${String(i).padStart(3, '0')}.webp`;

let frames: HTMLImageElement[] | null = null;

/** The frame images, created (and beginning to load) on first call. */
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
  // Kick every decode; don't block on the tail.
  imgs.forEach((img) => void img.decode().catch(() => {}));
  return imgs[0].decode().catch(() => {});
}

/** Frame index for a scrub position in ms, clamped to what has loaded. */
export function frameAt(ms: number): number {
  const imgs = splashFrames();
  let i = Math.round(ms / SPLASH_FRAME_MS);
  i = i < 0 ? 0 : i >= imgs.length ? imgs.length - 1 : i;
  // If that frame hasn't decoded yet, fall back to the last one that has.
  while (i > 0 && !(imgs[i].complete && imgs[i].naturalWidth)) i--;
  return i;
}
