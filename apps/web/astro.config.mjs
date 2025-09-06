import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server', // ensure SSR so request headers are always available
  server: {
    port: 4321,
    host: true,
  },
});
