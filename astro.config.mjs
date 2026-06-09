import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://hale-lang.org',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
