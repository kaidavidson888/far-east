/**
 * Shrinks embedded raster images to the size they are actually drawn at.
 *
 * Figma exports every placed image at its original resolution regardless of
 * how small the frame is. On the About Us page the three footer icons are
 * drawn at about 44px wide from PNGs 1974 to 2308px wide — roughly 46 times
 * more pixels than any screen can show, and 640KB of a 2.5MB file.
 *
 * An image reaches the page through a pattern: a rect is filled with
 * `url(#pattern)`, the pattern holds a `<use>` of the image, and the use's
 * transform is in objectBoundingBox units — fractions of that rect. So the
 * width the image is drawn at is `a * imageWidth * rectWidth`, and dividing
 * the image's own width by that gives how far it is oversampled.
 *
 * Anything beyond OVERSAMPLE is re-encoded at exactly OVERSAMPLE, and the
 * pattern's transform is scaled by the same ratio so the image still lands in
 * the same place at the same size. The translate components are fractions of
 * the rect, not of the image, so they are left alone.
 */
import sharp from 'sharp';

/**
 * Device pixels to keep per CSS pixel.
 *
 * Measured in Chrome, which is the renderer that matters: on the About Us
 * footer icons, 4x is as sharp as leaving the export's bitmap alone or
 * sharper — terms-of-service goes from 11% solid ink to 12%, privacy-policy
 * from 17% to 24% — while turning a 267KB PNG into 7KB. Chrome downscales a
 * 2308px image into a 45px box badly; handing it something already near the
 * drawn size avoids that path entirely.
 *
 * Do not tune this against a headless rasteriser. resvg resamples far better
 * than a browser does, so it rates the untouched bitmap best and every
 * re-encode a loss — the opposite of what ships. That mistake is what made
 * these buttons soft in the first place.
 *
 * The re-encode is deliberately NOT palettised: these images are alpha
 * masks, and quantising a soft-edged mask to 256 entries would cost exactly
 * the detail being protected here.
 */
const OVERSAMPLE = 4;

/** Read `matrix(a b c d e f)` / `scale(sx sy)` / `scale(s)` as [a, d]. */
function readScale(transform) {
  const matrix = /matrix\(\s*([-\d.eE]+)[\s,]+[-\d.eE]+[\s,]+[-\d.eE]+[\s,]+([-\d.eE]+)/.exec(
    transform,
  );
  if (matrix) return [Number(matrix[1]), Number(matrix[2])];
  const scale = /scale\(\s*([-\d.eE]+)(?:[\s,]+([-\d.eE]+))?\s*\)/.exec(transform);
  if (scale) {
    const sx = Number(scale[1]);
    return [sx, scale[2] === undefined ? sx : Number(scale[2])];
  }
  return null;
}

/** The largest rect that paints itself with a given pattern. */
function rectFor(svg, patternId) {
  let best = null;
  const re = new RegExp(`<rect\\b[^>]*fill="url\\(#${patternId}\\)"[^>]*>`, 'g');
  for (const [tag] of svg.matchAll(re)) {
    const w = Number(/\bwidth="([\d.]+)"/.exec(tag)?.[1]);
    const h = Number(/\bheight="([\d.]+)"/.exec(tag)?.[1]);
    if (!w || !h) continue;
    if (!best || w * h > best.w * best.h) best = { w, h };
  }
  return best;
}

export async function resampleEmbedded(svg, { oversample = OVERSAMPLE } = {}) {
  let out = svg;
  const report = [];

  const patterns = [...svg.matchAll(/<pattern id="([^"]+)"[\s\S]*?<\/pattern>/g)];
  for (const [patternSrc, patternId] of patterns) {
    const use = /<use[^>]*xlink:href="#([^"]+)"[^>]*transform="([^"]+)"[^>]*\/>/.exec(patternSrc);
    if (!use) continue;
    const [, imageId, transform] = use;
    const scale = readScale(transform);
    const rect = rectFor(svg, patternId);
    if (!scale || !rect) continue;

    const imageRe = new RegExp(`<image id="${imageId}"[^>]*\\/>`);
    const imageSrc = imageRe.exec(out)?.[0];
    if (!imageSrc) continue;
    const iw = Number(/\bwidth="(\d+)"/.exec(imageSrc)?.[1]);
    const ih = Number(/\bheight="(\d+)"/.exec(imageSrc)?.[1]);
    const data = /xlink:href="data:image\/([a-z]+);base64,([^"]+)"/.exec(imageSrc);
    if (!iw || !ih || !data) continue;

    const drawnW = Math.abs(scale[0]) * iw * rect.w;
    const drawnH = Math.abs(scale[1]) * ih * rect.h;
    if (!drawnW || !drawnH) continue;

    const targetW = Math.max(1, Math.ceil(drawnW * oversample));
    const targetH = Math.max(1, Math.ceil(drawnH * oversample));
    if (targetW >= iw && targetH >= ih) continue; // already at or below what we keep

    const before = Buffer.from(data[2], 'base64');
    const after = await sharp(before)
      .resize({ width: targetW, height: targetH, fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (after.length >= before.length) continue; // no point making it bigger

    const nextImage = imageSrc
      .replace(/\bwidth="\d+"/, `width="${targetW}"`)
      .replace(/\bheight="\d+"/, `height="${targetH}"`)
      .replace(
        /xlink:href="data:image\/[a-z]+;base64,[^"]+"/,
        `xlink:href="data:image/png;base64,${after.toString('base64')}"`,
      );
    // hold the drawn size: a * imageWidth is what matters, so shrink a by the
    // same ratio the image shrank
    const nextTransform = `matrix(${(scale[0] * iw) / targetW} 0 0 ${
      (scale[1] * ih) / targetH
    } ${/matrix\([^)]*\)/.test(transform) ? readTranslate(transform) : '0 0'})`;
    const nextPattern = patternSrc.replace(
      /transform="[^"]+"/,
      `transform="${nextTransform}"`,
    );

    out = out.replace(imageSrc, nextImage).replace(patternSrc, nextPattern);
    report.push({
      imageId,
      from: `${iw}x${ih}`,
      to: `${targetW}x${targetH}`,
      drawnAt: `${drawnW.toFixed(1)}x${drawnH.toFixed(1)}`,
      wasOversampled: `${(iw / drawnW).toFixed(1)}x`,
      savedKB: Math.round((before.length - after.length) / 1024),
    });
  }

  return { svg: out, report };
}

/** The e,f of a matrix — fractions of the rect, so they survive a resample. */
function readTranslate(transform) {
  const m =
    /matrix\(\s*[-\d.eE]+[\s,]+[-\d.eE]+[\s,]+[-\d.eE]+[\s,]+[-\d.eE]+[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)/.exec(
      transform,
    );
  return m ? `${m[1]} ${m[2]}` : '0 0';
}
