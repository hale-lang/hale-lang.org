<!-- Claude Code auto-loads CLAUDE.md. These are the project's Hale rules. -->

# CLAUDE.md — writing Hale in this project

You are writing Hale (`.hl`). Hale is designed so you can write correct,
idiomatic code — and the compiler proves it. Follow this file before writing any
locus.

## Before you write

1. Read the **Hale context pack** (`hale-context.txt`, or the slim variant) if it
   isn't already in your context. It is the distilled language knowledge.
2. **The compiler is the oracle.** After every change, run
   `hale check <dir>` (or `$HALE_BIN check <dir>`). You are done only when it
   prints `ok: N file(s) typechecked`. Read each diagnostic — it names the rule
   and usually the fix — and iterate.

## First-step protocol

Before writing code, state in one line: *which of the six patterns* you're
writing (App locus / Namespace lotus / Service locus / Spawned child / Shape type
/ Free fn) and the locus's shape. If nothing fits, log friction (below) instead
of inventing a pattern.

## Load-bearing rules

1. **Everything is a locus.** Pure data → `type`; anything with flow → `locus`.
   No `class`/`module`/`namespace`. `params` is also the locus's mutable state.
2. **No exceptions, no `panic`, no `assert`.** Failure is two channels:
   - **Value:** `fallible(E)` + an `or` clause at every call site
     (`or raise` / `or <default>` / `or handler(err)` / `or fail E{}` /
     `or discard` for Unit). `fail E{}` exits a fallible body.
     `fallible(E)` is allowed on free fns, `@form` methods, **and user-declared
     `fn` member methods** — but NOT on lifecycle/mode/closure/bus-handler bodies.
   - **Structural:** a parent's `on_failure(c, err)` (`restart`/`quarantine`/
     `bubble`/absorb). Bridge a caught value error to structural with an
     error-check fn that calls `violate NAME;` on an `epoch inline` closure.
3. **Bus topics are file-local.** `bus { publish T; }` / `T <- v;` resolve a
   `topic T` only in the **same file** as the publishing locus. Co-locate the
   topic with a single publisher; use the literal-subject form
   (`publish "subj" of type T;` + `"subj" <- v;`) when ≥2 files publish it.
4. **No-locus-return (CQRS).** A locus `fn` member may not return a user locus
   type. Factories that return a locus are **free fns**. Use parent-child +
   contract, a bus topic, or delegation otherwise.
5. **Placement is `main`-only.** Thread placement / transport live in a
   `main locus`'s `placement {}` / `bindings {}` blocks, never as per-locus
   annotations. No `bindings` → one in-process binary; add one → cross-process.
6. **No generic collections.** Use `@form(vec | hashmap | ring_buffer)` on a
   locus, or the row-string / index-API idiom. `Bytes` ≠ `BytesBuilder`.
7. **Idioms:** PascalCase loci/types, snake_case fns/fields; lifecycle methods
   drop `fn`; `Decimal` for money / `Float` for math; ASCII-only source; a
   directory is one shared-scope seed; `import "path" as alias;` (alias required).

## Friction discipline

Maintain a `FRICTION.md` in this project. When you hit a wall (a rule you didn't
know, a workaround you found), append the cause and the working shape. Read it
before the next task. This is how Hale projects stay buildable across sessions.

## Don't

Reach for foreign patterns — TOML/JSON-in-a-locus, fluent builders that mutate
self, singletons, decorators. When code doesn't match the six patterns,
reconsider against them or log friction; don't code around the substrate.
