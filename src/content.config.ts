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
    // Who actually wrote the prose. REQUIRED, and deliberately so:
    // a default would silently attribute, and the whole point of the
    // field is that a reader should never have to guess. `ai` means
    // heavily machine-written, whatever the review process after.
    authorship: z.enum(['ai', 'human']),
    date: z.coerce.date(),
    summary: z.string(),
    // Optional: the release this piece accompanies.
    version: z.string().optional(),
    // Optional: set when a published piece gains a section. The
    // original date stays — these are permanent, not rolling.
    updated: z.coerce.date().optional(),
    // Optional: pieces that are chapters of one argument rather than
    // standalone. `series` is the shared title; `part` is READING
    // order, which is not always publication order — a later piece
    // can belong earlier in the sequence.
    series: z.string().optional(),
    part: z.number().int().positive().optional(),
  })
    // Half a series is a navigation bug: the sidebar would show a
    // heading with an unordered member, or an ordered member under no
    // heading. Catch it at build rather than in the rendered page.
    .refine(
      (d) => (d.series === undefined) === (d.part === undefined),
      { message: '`series` and `part` must be set together' },
    ),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  articles,
};
