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
  layouts/Base.astro        global shell (nav + footer + head)
  components/
    Hale.astro              code panel using the custom Hale grammar
    Nav.astro Footer.astro Logo.astro
  grammars/hale.tmLanguage.json   TextMate grammar → Shiki highlighting
  styles/global.css         the design system
  pages/                    index, why, agents, docs, tour, playground, packages
public/
  favicon.svg  llms.txt
```

## Status

Early build — homepage + the core nav pages. Next: wire the language spec into
the docs section (Astro Starlight), build the interactive Tour + Playground
(a WASM `hale` build), and ship the agents toolchain (context pack, MCP server,
`hale init --agent`). See the site plan in chat history.

## Notes

- **Syntax highlighting** is a hand-written Hale TextMate grammar
  (`src/grammars/hale.tmLanguage.json`) rendered by Shiki with `github-dark`.
  It maps Hale's lifecycle/closure/bus/fallible keywords onto standard scopes.
- `install.sh`, `hale-context.txt`, and `llms-full.txt` are referenced in copy
  but not yet generated.
