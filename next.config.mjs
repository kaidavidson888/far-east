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
};
export default nextConfig;
