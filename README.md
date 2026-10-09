# hale-lang.org

The website for the Hale programming language. Built with [Astro](https://astro.build).

Light and dark, chosen by the reader's system or the header toggle. One set
of tokens (`src/styles/tokens.css`) colours the site's own pages and the
docs: warm paper or plum-black ground, rose for the accent, gold, jade and
violet for labels, types and keywords. Prose is set in Literata and everything
the compiler says in JetBrains Mono. The lotus field behind the opening and
the page bands draws one large lotus out of small ones, each a locus and each
route a declared edge.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output → dist/
npm run preview  # serve the build
```

## Structure

```
src/
  layouts/Base.astro        marketing-page shell (custom nav + footer)
  components/               Hale.astro (code listing), Terminal, Nav, Footer, Logo,
                            LotusField, ThemeToggle
  code/                     the light and dark code themes, and their loader
  grammars/hale.tmLanguage.json   TextMate grammar → Shiki highlighting
  data/glossary.mjs         every Hale term: the familiar idea, then the difference
  integrations/gloss.mjs    underlines a term's first use on each page, with its gloss
  styles/tokens.css         palette, type and spacing, shared by the site and the docs
  styles/global.css         the site's own pages
  styles/starlight.css      maps Starlight's palette onto the tokens
  content.config.ts         Starlight docs content collection
  content/docs/docs/        the docs (served under /docs — generated)
    <book>                  the guide  ← hale/docs/src (the mdBook tour)
    spec/                   the reference ← hale/spec/*.md
  pages/                    index, features, model, proof, examples, dna, glossary, …
scripts/sync-docs.mjs       syncs the Book + spec into the docs collection
scripts/build-agent-assets.sh   builds the context packs + rules files
public/                     favicon.svg, llms.txt, generated agent assets
```

The marketing pages use a hand-built layout; **the `/docs/*` section is
[Starlight](https://starlight.astro.build)** (sidebar, search, ToC), themed to
match, with a custom header that shares the marketing nav. The docs content is
**synced from the compiler repo, not authored here**: the curated guide comes
from `hale/docs/src` (the "level-by-level tour" mdBook) and the canonical
reference from `hale/spec/*.md`. Run `node scripts/sync-docs.mjs` to refresh
both (it injects Starlight frontmatter and rewrites in-repo links to site
paths). The Hale grammar is registered with both the custom code panels and
Starlight's Expressive Code, so `hale` fences are highlighted everywhere.

## Status

Homepage + core nav pages + the docs section (Starlight) with the full language
spec wired in and searchable.

**Next:**
- The interactive Playground (a WASM `hale` build) — also unlocks guided
  in-playground lessons.
- `install.sh` (the real hosted installer) and a `hale init --agent` that
  scaffolds the rules files locally.
- A docs sync in CI (or committed-with-a-staleness-check) so the guide/spec
  don't drift from the compiler repo.

## Notes

- **Syntax highlighting** is a hand-written Hale TextMate grammar
  (`src/grammars/hale.tmLanguage.json`) rendered by Shiki with the site's own
  light and dark themes (`src/code/`), in the code listings, the articles and
  the docs alike. It maps Hale's keywords and attributes onto standard scopes,
  following tree-sitter-hale's highlight queries.
- `install.sh`, `hale-context.txt`, and `llms-full.txt` are referenced in copy
  but not yet generated.
