import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// Articles & announcements — release notes worth reading as prose, and
// technical write-ups of a single feature. Deliberately NOT a blog:
// no tags, no authors page, no archive by month. Two kinds of post,
// distinguished by `kind`, both dated and both permanent.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    // `announcement` — a release, in prose.
    // `article` — a technical piece about one thing.
    kind: z.enum(['announcement', 'article']),
    date: z.coerce.date(),
    summary: z.string(),
    // Optional: the release this piece accompanies.
    version: z.string().optional(),
    // Optional: set when a published piece gains a section. The
    // original date stays — these are permanent, not rolling.
    updated: z.coerce.date().optional(),
  }),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  articles,
};
