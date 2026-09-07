import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project has its own lockfile; don't trace up to the home directory.
  outputFileTracingRoot: root,
};
export default nextConfig;
