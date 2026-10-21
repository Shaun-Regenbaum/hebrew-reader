import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests do not load the Cloudflare plugin.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
