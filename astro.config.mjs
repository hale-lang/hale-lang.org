import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://hale-lang.org',
  integrations: [
    starlight({
      title: 'Hale',
      description: 'The Hale programming language documentation.',
      logo: { src: './public/favicon.svg', alt: 'Hale' },
      customCss: ['./src/styles/starlight.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/hale-lang' },
      ],
      // Custom landing pages own the site root; Starlight serves /docs/*.
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Overview', slug: 'docs' },
            { label: 'Install', slug: 'docs/install' },
            { label: 'Why Hale', link: '/why' },
            { label: 'Playground', link: '/playground' },
          ],
        },
        {
          label: 'Specification',
          items: [{ autogenerate: { directory: 'docs/spec' } }],
        },
        {
          label: 'Ecosystem',
          items: [
            { label: 'Packages (pond)', link: '/packages' },
            { label: 'For agents / LLMs', link: '/agents' },
          ],
        },
      ],
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
});
