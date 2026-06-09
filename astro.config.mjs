import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Guard against a polluted BASE_URL in the shell environment. Some dev
// setups export e.g. `BASE_URL=http://localhost:3000`; at SSR Astro reads
// `import.meta.env.BASE_URL` from process.env, so an absolute value would
// prefix every Starlight nav / favicon / sitemap link with localhost. The
// site's base is always "/", so drop any absolute inherited BASE_URL.
if (process.env.BASE_URL && /^[a-z][a-z0-9+.-]*:\/\//i.test(process.env.BASE_URL)) {
  delete process.env.BASE_URL;
}

// Custom Hale TextMate grammar → registered with Starlight's code blocks
// (Expressive Code) so spec `hale` fences are highlighted like the rest
// of the site.
const haleGrammar = JSON.parse(
  readFileSync(new URL('./src/grammars/hale.tmLanguage.json', import.meta.url), 'utf8')
);

// https://astro.build/config
export default defineConfig({
  site: 'https://hale-lang.org',
  integrations: [
    starlight({
      title: 'Hale',
      description: 'The Hale programming language documentation.',
      logo: { src: './public/favicon.svg', alt: 'Hale' },
      customCss: ['./src/styles/starlight.css'],
      components: {
        Header: './src/components/StarlightHeader.astro',
      },
      expressiveCode: {
        themes: ['github-dark'],
        shiki: { langs: [haleGrammar] },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/hale-lang' },
      ],
      // Custom landing pages own the site root; Starlight serves /docs/*.
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Introduction', slug: 'docs' },
            'docs/getting-started/install',
            'docs/getting-started/first-run',
          ],
        },
        {
          label: 'The basics',
          items: [
            'docs/basics/values', 'docs/basics/math', 'docs/basics/functions',
            'docs/basics/control-flow', 'docs/basics/strings', 'docs/basics/fallible',
            'docs/basics/first-program',
          ],
        },
        {
          label: 'Everyday programs',
          items: [
            'docs/everyday/locus-gently', 'docs/everyday/collections', 'docs/everyday/records',
            'docs/everyday/files', 'docs/everyday/json', 'docs/everyday/http',
            'docs/everyday/cli-config', 'docs/everyday/logging',
          ],
        },
        {
          label: 'Concurrent services',
          items: [
            'docs/services/lifecycle', 'docs/services/bus', 'docs/services/concurrency',
            'docs/services/parents-children', 'docs/services/failure', 'docs/services/multi-binary',
          ],
        },
        {
          label: 'Systems control',
          items: [
            'docs/systems/memory', 'docs/systems/performance', 'docs/systems/forms',
            'docs/systems/zero-copy-bus', 'docs/systems/binding-c', 'docs/systems/cross-process',
            'docs/systems/modes',
          ],
        },
        {
          label: 'Reference',
          items: [
            'docs/reference', 'docs/libraries', 'docs/the-design',
            { label: 'Specification', collapsed: true, items: [{ autogenerate: { directory: 'docs/spec' } }] },
          ],
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
