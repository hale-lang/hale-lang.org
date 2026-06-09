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
  content/docs/docs/        the docs (served under /docs)
    index.md install.md
    spec/                   the language spec (synced — see below)
  pages/                    index, why, agents, playground, packages (custom)
scripts/sync-spec.sh        copies hale/spec/*.md → content with frontmatter
public/                     favicon.svg, llms.txt
```

The marketing pages use a hand-built layout; **the `/docs/*` section is
[Starlight](https://starlight.astro.build)** (sidebar, search, ToC), themed to
match. Run `./scripts/sync-spec.sh` to refresh the spec from the compiler repo.

## Status

Homepage + core nav pages + the docs section (Starlight) with the full language
spec wired in and searchable.

**Next:**
- Share the custom site header across the docs (override Starlight's `Header`).
- Register the Hale grammar with Starlight's code blocks so spec snippets get
  Hale highlighting (currently plain).
- Rewrite the spec's `spec/*` / `notes/*` cross-links into site links.
- The interactive Playground (a WASM `hale` build) — also unlocks guided
  in-playground lessons (the former “tour”).
- The agents toolchain: generate `hale-context.txt`, `llms-full.txt`,
  `install.sh`, the `hale init --agent` templates, and the MCP server.

## Notes

- **Syntax highlighting** is a hand-written Hale TextMate grammar
  (`src/grammars/hale.tmLanguage.json`) rendered by Shiki with `github-dark`.
  It maps Hale's lifecycle/closure/bus/fallible keywords onto standard scopes.
- `install.sh`, `hale-context.txt`, and `llms-full.txt` are referenced in copy
  but not yet generated.
