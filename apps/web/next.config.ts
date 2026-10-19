import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  // Imagen de producción autocontenida (server.js + dependencias trazadas), sin node_modules completos.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
};

export default nextConfig;
