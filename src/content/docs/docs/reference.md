---
title: "Reference"
---


This guide is the tour. The **canonical contract** — what the
compiler actually enforces — lives in the `spec/` directory at
the repository root. When the guide and the spec disagree, the
spec wins; when you need the exact rule, an edge case, or a
diagnostic's meaning, go there.

## The spec, by topic

| You want | Read |
|---|---|
| The formal grammar | [`spec/grammar.ebnf`](https://github.com/hale-lang/hale/blob/main/spec/grammar.ebnf) |
| Lexical structure, literals, operators | [`spec/tokens.md`](/docs/spec/tokens) |
| Operator precedence & associativity | [`spec/precedence.md`](/docs/spec/precedence) |
| Operational semantics (lifecycle, bus, recovery, fallible) | [`spec/semantics.md`](/docs/spec/semantics) |
| The type system | [`spec/types.md`](/docs/spec/types) |
| Memory: regions, capacity slots, projection classes | [`spec/memory.md`](/docs/spec/memory) |
| The form library (`vec` / `hashmap` / `ring_buffer`) | [`spec/forms.md`](/docs/spec/forms) |
| The always-loaded runtime | [`spec/runtime.md`](/docs/spec/runtime) |
| The standard library surface | [`spec/stdlib.md`](/docs/spec/stdlib) |
| Idiomatic patterns & the six shapes | [`spec/styleguide.md`](/docs/spec/styleguide) |
| The C FFI contract | [`spec/ffi.md`](/docs/spec/ffi) |
| Dependencies & vendoring | [`spec/packages.md`](/docs/spec/packages) |
| Project layout & imports | [`spec/projects.md`](/docs/spec/projects) |
| How tests are written and run | [`spec/testing.md`](/docs/spec/testing) |
| Why every design choice was made | [`spec/design-rationale.md`](/docs/spec/design-rationale) |

## Two more anchors

- **[`AGENTS.md`](/agents)** — the load-bearing prompt for
  agents writing `.hl`. It condenses the six idiomatic patterns,
  the "what's not in the language" reflexes, and the formal
  design model into one file. Excellent for a human, too.
- **Working programs** — `crates/hale-codegen/tests/fixtures/examples/`
  holds ~70 small per-feature programs, numbered. Reading a few
  near your target shape is the fastest way to see real,
  compiling Hale.

## Toolchain commands

| Command | Does |
|---|---|
| `hale run <file/dir>` | compile + run (fast feedback) |
| `hale build <file/dir>` | compile to a native binary |
| `hale check` | parse + typecheck only |
| `hale test` | run `*_test.hl` |
| `hale fetch` | clone & pin git dependencies |
| `hale fmt` | canonical formatter |
