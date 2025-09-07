import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  server: { port: 4321, host: true },
  integrations: [react(), tailwind()],
});
