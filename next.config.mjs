import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project has its own lockfile; don't trace up to the home directory.
  outputFileTracingRoot: root,
  // `next build` and `next dev` both write to .next, so running one while the
  // other is up corrupts the dev server. NEXT_DIST_DIR lets a build go
  // somewhere else — `NEXT_DIST_DIR=.next-build npm run build` — so the
  // pre-commit build can run without stopping anyone's dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // No "N" badge in the corner of the dev server's pages: the owner checks the
  // design in the preview (2026-09-19, "make the dev accurate to the appearance
  // of the website on desktop"), and the live site has no such badge. Build
  // and runtime errors still show their overlay.
  devIndicators: false,
  // Next serves everything in public/ with max-age=0, so every page load
  // pays a revalidation round trip for a file that never changes. The font's
  // version is in its filename — bump it when the file is replaced, and the
  // old URL simply stops being asked for.
  async headers() {
    return [
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};
export default nextConfig;
