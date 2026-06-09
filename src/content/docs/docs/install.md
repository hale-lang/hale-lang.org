---
title: Install
description: Install the Hale toolchain and build your first program.
---

Hale ships as a single CLI, `hale`, built from the compiler repository.

## Install

```sh
curl -fsSL https://hale-lang.org/install.sh | sh
```

:::caution
The hosted installer is a placeholder in this early build. For now, build the
toolchain from the [compiler repo](https://github.com/hale-lang) and put `hale`
on your `PATH` (or point `$HALE_BIN` at the binary).
:::

## Your first program

Create `hello.hl`:

```hale
locus Greeter {
    params { name: String = "world"; }
    run() { println(f"hello, {self.name}"); }
}

fn main() { Greeter { name: "hale" }; }
```

Build and run it:

```sh
hale build hello.hl
./hello
```

## The CLI

| Command | What it does |
|---|---|
| `hale build <file \| dir>` | parse + typecheck + emit a native binary |
| `hale check <file \| dir>` | parse + typecheck (no binary) |
| `hale run <file \| dir>` | parse + typecheck + interpret |
| `hale test` | run `*_test.hl` files |
| `hale fetch` | fetch git dependencies into `vendor/` |
| `hale fmt` | format source |

A directory is a program: every `.hl` file in one directory compiles as a single
**seed** with one shared top-level scope. See the
[style guide](/docs/spec/styleguide) for the idioms, then take it from there.

## Next

- The [style guide](/docs/spec/styleguide) — the pattern catalog.
- [Packages (pond)](/packages) — vendor batteries.
- [For agents](/agents) — set your AI assistant up to write Hale.
