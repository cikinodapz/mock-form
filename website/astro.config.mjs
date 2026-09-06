import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  outDir: '../docs',
  site: 'https://cikinodapz.github.io',
  base: '/mock-form/',
  build: {
    format: 'file'
  }
});
