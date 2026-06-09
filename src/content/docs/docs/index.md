---
title: Documentation
description: The Hale language documentation — install, the spec, the standard library, and the design rationale.
---

Welcome to the Hale docs. Hale already ships an exhaustive language
specification; these pages present it directly.

## Start here

- **[Install](/docs/install)** — get the toolchain and build your first program.
- **[Why Hale](/why)** — the case for the language.
- **[Playground](/playground)** — edit, check, and run in the browser.

## The specification

The left sidebar lists the full language spec — operational semantics, the
memory model, the type system, the runtime, forms, the style guide, and the
design rationale. These are synced from the compiler repo and are the
authoritative reference.

A good reading order if you're new:

1. **[Style guide](/docs/spec/styleguide)** — the pattern catalog and idioms.
2. **[Operational semantics](/docs/spec/semantics)** — what programs *do*.
3. **[Memory model](/docs/spec/memory)** — regions, dissolution, no GC.
4. **[Type system](/docs/spec/types)** — loci, interfaces, fallible typing.
5. **[Design rationale](/docs/spec/design-rationale)** — the locked commitments.

## Building with Hale

- **[Packages (pond)](/packages)** — the "non-std stdlib" you vendor.
- **[For agents / LLMs](/agents)** — the rules-doc + friction-log + compiler-oracle workflow.

:::note
This docs section is an early build. Cross-references inside the spec that point
at `spec/*`, `notes/*`, or `crates/*` refer to the compiler repository and are
not yet rewritten into site links.
:::
