import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dinakartumu.com',
  integrations: [sitemap()],
});
