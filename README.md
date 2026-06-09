# hale-lang.org

The website for the Hale programming language. Built with [Astro](https://astro.build).

Clean & opinionated (Zig/Go lineage): warm paper, near-black ink, one jade
“lotus” accent, dark code panels. Four co-equal pillars — one primitive,
memory-by-structure, reliability, and human+LLM authorship.

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
  components/               Hale.astro (code panel), Nav, Footer, Logo
  grammars/hale.tmLanguage.json   TextMate grammar → Shiki highlighting
  styles/global.css         the marketing design system
  styles/starlight.css      themes the Starlight docs chrome to match
  content.config.ts         Starlight docs content collection
  content/docs/docs/        the docs (served under /docs — generated)
    <book>                  the guide  ← hale/docs/src (the mdBook tour)
    spec/                   the reference ← hale/spec/*.md
  pages/                    index, why, agents, playground, packages (custom)
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
  (`src/grammars/hale.tmLanguage.json`) rendered by Shiki with `github-dark`.
  It maps Hale's lifecycle/closure/bus/fallible keywords onto standard scopes.
- `install.sh`, `hale-context.txt`, and `llms-full.txt` are referenced in copy
  but not yet generated.
