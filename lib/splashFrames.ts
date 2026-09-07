// Decodes the login GIF once, on the client, into an ordered list of flattened
// frame images we can scrub back and forth. The GIF's own frames are patches
// that composite on top of each other (disposal type 1), so we accumulate them
// onto an offscreen canvas and snapshot each step as a downscaled WebP.
//
// 101 frames, 40ms apart — 4.00s of animation, then the last frame is held.

import { parseGIF, decompressFrames } from 'gifuct-js';

export const SPLASH_FRAME_MS = 40;
export const SPLASH_DURATION_MS = 4000; // frame 0 → frame 100

const SRC = '/splash/login.gif';
const SCALE_W = 450; // downscale target; the animation is decorative and in motion

let cache: Promise<HTMLImageElement[]> | null = null;

/** Decode once per page load; callers share the same promise. */
export function loadSplashFrames(): Promise<HTMLImageElement[]> {
  if (!cache) cache = decode();
  return cache;
}

async function decode(): Promise<HTMLImageElement[]> {
  const buf = await fetch(SRC).then((r) => r.arrayBuffer());
  const gif = parseGIF(buf);
  const raw = decompressFrames(gif, true);
  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const scaleH = Math.round((SCALE_W / W) * H);

  const acc = document.createElement('canvas');
  acc.width = W;
  acc.height = H;
  const actx = acc.getContext('2d')!;
  actx.fillStyle = '#ffffff';
  actx.fillRect(0, 0, W, H);

  const patch = document.createElement('canvas');
  const pctx = patch.getContext('2d')!;

  const small = document.createElement('canvas');
  small.width = SCALE_W;
  small.height = scaleH;
  const sctx = small.getContext('2d')!;

  const out: HTMLImageElement[] = [];

  for (let i = 0; i < raw.length; i++) {
    const f = raw[i];
    const { width, height, left, top } = f.dims;
    patch.width = width;
    patch.height = height;
    const id = pctx.createImageData(width, height);
    id.data.set(f.patch);
    pctx.putImageData(id, 0, 0);
    actx.drawImage(patch, left, top); // composites, respecting the patch's alpha

    sctx.clearRect(0, 0, SCALE_W, scaleH);
    sctx.drawImage(acc, 0, 0, SCALE_W, scaleH);

    const img = new Image();
    img.src = small.toDataURL('image/webp', 0.86);
    out.push(img);

    // Yield every few frames so decoding never blocks a frame of input.
    if (i % 8 === 7) await new Promise((r) => setTimeout(r));
  }

  await Promise.allSettled(out.map((img) => img.decode().catch(() => {})));
  return out;
}

/** Frame index for a scrub position in ms. */
export function frameAt(ms: number, count: number): number {
  const i = Math.round(ms / SPLASH_FRAME_MS);
  return i < 0 ? 0 : i >= count ? count - 1 : i;
}
