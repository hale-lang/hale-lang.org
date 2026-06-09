# Hale essentials & gotchas — write correct, idiomatic Hale

This is the distilled, load-bearing knowledge for writing Hale that compiles
and is idiomatic on the first try. It is the preamble to the full context pack;
the rest of the pack is the complete language specification for depth. Read this
first, then **let the compiler be the oracle** — `hale check <dir>` accepts or
rejects with a precise diagnostic; iterate against it.

---

## 1. The axiom: everything is a locus

Hale has exactly two declaration primitives, on one gradient:

- **`type`** — pure data. Fields, layout, returnable by value. No lifecycle, no
  flow. A record.
- **`locus`** — anything with *flow*: lifecycle (`birth`/`run`/`drain`/`dissolve`),
  state, contracts, bus participation, supervision. An app is a locus; a service
  is a locus; a namespace of helpers is a locus; a bus subscriber is a locus.

If a thing has lifecycle or mutable flow, it's a `locus`. If it's pure shape,
it's a `type`. There is no third category. There is no `class`, `module`,
`package`, or `namespace` keyword — a locus does all of it.

```hale
type Point { x: Int; y: Int = 0; }      // data

locus Counter {                          // flow
    params { n: Int = 0; }               // params ARE the locus's mutable state
    fn inc() { self.n = self.n + 1; }
}
```

`params` is both the construction-time defaults *and* the locus's runtime state
(mutated via `self.x = ...`). There is no separate `state {}` block.

---

## 2. The six-pattern catalog

Every locus/fn in idiomatic Hale matches one of these. If your code doesn't, reconsider.

1. **App locus** — `main.hl` defines a top-level locus owning the run; `fn main()`
   reads argv, instantiates it. Lifecycle bodies can't `return`, so factor
   short-circuit logic into a free fn.
2. **Namespace lotus** — empty/config-only `params {}`, methods only. The
   replacement for "module of functions" / "static class".
3. **Service locus** — `birth`/`run`/`dissolve` (+ often `bus subscribe`) for
   long-lived work.
4. **Spawned child** — a `let`-bound locus literal that dissolves at scope exit.
5. **Shape type** — a `type` record, pure data.
6. **Free fn** — top-level fn with no flow. When ≥3 cohere into a vocabulary,
   promote to a namespace lotus.

---

## 3. Memory & lifetime — no GC, no borrow checker, no `free`

A locus owns a **region** (arena). When the locus dissolves, the region is freed
**wholesale**. The structure *is* the lifetime. There is no garbage collector,
no borrow checker, and no manual free.

Dissolve timing (the part people get wrong):

- **Statement-position literal** `Foo { };` — fire-and-forget; dissolves at the
  statement boundary. Use for one-shot runs.
- **Let-bound** `let h = Foo { };` — stays valid for method calls; dissolves at
  the enclosing fn's scope exit (deferred). Use when you need a usable handle.
- A locus with `bus subscribe` is long-lived regardless of binding shape.

Lifecycle methods: `birth` (setup) → `run` (steady-state) → `drain` (stop new
work) → `dissolve` (release). `accept(c: Child)` runs *before* a child's birth.
Parent/child: a parent that `accept`s children exposes `self.children`. Cross-locus
state goes over the **bus**, never lateral field reads (vertical-only flow).

---

## 4. Failure: two orthogonal channels

Hale has **no exceptions, no `panic`, no `assert`**. Failure is either:

**(a) Value channel — `fallible(E)`.** For recoverable, call-by-call errors.

```hale
fn parse_port(s: String) -> Int fallible(ParseError) {
    return std::str::parse_int(s) or raise;
}
```

Every fallible call MUST be addressed at the immediate caller with an `or` clause:

- `or raise` — propagate one frame up (the enclosing fn must be `fallible`).
- `or <value>` — substitute a default; `err` is bound to the payload in scope.
- `or handler(err)` — hand off to a fn that returns the success type.
- `or fail E { ... }` — translate to the enclosing fn's error type.
- `or discard` — swallow; only when the success type is `()` (Unit).

`fail E { ... };` inside a fallible body exits via the error path (mirror of `return`).

**Where `fallible(E)` is allowed (v0.8.1 narrowing — important):** free fns,
`@form(...)` container methods, **and user-declared `fn` member methods on a
locus**. It is REJECTED on *substrate-facing* surfaces: lifecycle methods
(`birth`/`run`/`accept`/`drain`/`dissolve`/`on_failure`), mode methods, closure
assertions, and bus-subscribed handlers — those have no caller frame. (Older docs
say "no fallible on locus methods" — that blanket rule was narrowed; member fns CAN
be fallible now.)

**(b) Structural channel — closures + supervision.** For "a locus's invariant
broke." A parent's `on_failure(c, err)` decides policy: `restart(c)` /
`quarantine(c)` / `bubble(err)` / absorb. To escalate a caught value error into a
structural failure from inside a locus method (e.g. a lifecycle body, which can't
be fallible), use the error-check-fn pattern:

```hale
closure fatal_io { captures: last_error; epoch inline; }

fn handle_io(e: IoError) -> Row {        // a member fn, returns the success type
    self.last_error = e.kind;
    if e.kind == "broken_pipe" { violate fatal_io; }   // → structural escalation
    return Row { data: "" };
}
// caller (e.g. in run()/birth()): let r = do_io() or self.handle_io(err);
```

`violate NAME;` is divergent (like `fail`/`bubble`). The parent reads frozen child
state in `on_failure` via the child handle (`c.last_error`).

---

## 5. The bus — and the one rule that trips everyone

Loci coordinate over a typed pub/sub bus. Declare a channel with `topic`, publish
with `<-`, subscribe in a `bus {}` block:

```hale
topic Tick { payload: TickData; subject: "ticks"; }

locus Producer {
    bus { publish Tick; }
    run() { Tick <- TickData { n: 1 }; }   // identifier subject, not "Tick"
}
locus Consumer {
    bus { subscribe Tick as on_tick; }
    fn on_tick(t: TickData) { /* ... */ }
}
```

**THE GOTCHA (codegen-v0):** `bus { publish T; }` and `T <- v;` only resolve a
`topic T` declared in the **SAME `.hl` FILE** as the publishing locus.
Cross-file topic references fail with `publish references unknown topic`
*regardless of file order*. Two fixes:

- **Single publisher:** put the `topic` decl in the same file as the publishing locus.
- **≥2 files publish the same topic:** use the literal-subject form, which works
  cross-file: `publish "wire.subject" of type T;` + `"wire.subject" <- v;`.

(Topic *payload-type* resolution IS seed-global/order-free — only the topic
*reference* in a bus block is file-local.)

**Placement & the deployment seam.** Thread placement and transport are
deployment seams, set ONLY in a `main locus`'s `placement {}` / `bindings {}`
blocks — never as per-locus annotations (the old `: schedule` annotation was
removed). With no `bindings`, loci run as one in-process binary; bind a topic to
a transport (`unix(...)`, etc.) and the same code runs cross-process.

```hale
main locus App {
    params { gw: Gateway = Gateway { }; api: Server = Server { }; }
    placement { gw: pinned(core = 1); api: cooperative(pool = io); }
    bindings { Ticks: unix("/run/ticks.sock"); }   // delete → monolith
}
```

A locus's methods may be invoked only on its placement pool's thread
(single-threaded-method invariant); cross-pool coordination goes over the bus.

---

## 6. Data: forms, not generics; Bytes vs BytesBuilder

Hale has **no parametric collection types** (`Vec<T>`, `Map<K,V>`). Use `@form`
annotations on a locus instead:

```hale
@form(vec)
locus Items { capacity { heap data of Int; } }     // push/get/set/pop/len/sort_*

@form(hashmap)
locus Reg { capacity { pool entries of Entry indexed_by name; } }  // get/set/has/remove
```

`@form(vec | hashmap | ring_buffer)`. Synthesized fallible methods (`get`/`pop`/
`remove`) return injected error types (`IndexError`/`KeyError`/`EmptyError`).

For "list of things" returns without a form, use the **row-string / index-API**
idiom (tab-separated columns, newline-separated rows), per stdlib precedent —
not an invented parametric collection.

**`Bytes` vs `BytesBuilder` are distinct types.** `Bytes` is an immutable
length-prefixed blob (`at`/`slice`/`len`/`concat`). `std::bytes::BytesBuilder` is
a growable accumulator locus (`append`/`len`/`shift_front`/`clear`/`snapshot`/
`view`). They don't coerce. The recv-loop idiom writes into a builder
(`recv_into`) and `snapshot()`/`view()` to hand off a `Bytes`. Prefer `Bytes` for
binary I/O, `String` for human-readable text.

**Structural interfaces** (Go-shaped): a locus satisfies an `interface` by having
the methods — no `impl`. Interface methods can't be `fallible`; carry errors in
result structs (`ok`/`err` fields), the Go `(result, error)` shape.

---

## 7. Numbers, strings, naming

- **`Decimal` for money, `Float` for math.** `Decimal` (suffix `d`: `1.50d`)
  never participates in implicit conversion. `Int → Float` widens implicitly
  (one-way); `Float → Int` needs explicit `Int(x)`.
- Strings are NUL-terminated (`String`); use `Bytes` for binary. f-strings:
  `f"hi {name}"`. ASCII-only source (names, not Greek: `sigma`, `phi`).
- **Naming:** PascalCase for loci/types/interfaces; snake_case for fns/fields/
  params; UPPER_SNAKE for consts; dot-lowercase bus subjects (`log.app.db`).
  Lifecycle methods drop `fn` (`run() { }`, not `fn run()`).

---

## 8. Projects: seeds, imports, vendoring

- **A directory is one seed** (F.19): every `.hl` file in a dir shares one
  top-level scope, order-free. No `pub`/visibility. Decompose by concern, not
  visibility. Subdirectories are *separate* seeds.
- **Cross-seed import** (F.25): `import "path" as alias;` (the alias is
  REQUIRED). References read `alias::Name`. The path resolves entry-relative
  then workspace-root.
- **Vendoring is the dependency model** (F.26): `hale fetch` clones git deps into
  `vendor/`; no registry, no transitive resolution — vendor everything you use.

---

## 9. Hard gotchas (codegen-v0 limitations — don't fight these)

- **CQRS / no-locus-return:** a `fn` member of a locus may NOT return a
  user-declared locus type (`fn get() -> SomeLocus` is rejected). Use
  parent-child + contract, a bus topic, or delegation. **Free fns CAN return
  loci** (constructors like `std::io::file::open`) — so factory functions are
  free fns, not methods. (This is why `@form(vec)` factories and matrix/metrics
  factories are free fns.)
- **Topic file-locality** (§5 above) — the most common first-try failure.
- **Strict field access:** a typo'd field (`self.greting`) is a hard error, not a
  silent `Unknown`. Good — fix the name.
- **No `panic`/`assert`** — failure is structural or `fallible` (§4).
- **Empty `if` bodies parse-fail** — put a `// note` comment inside or invert the
  condition.
- **Fn-pointer callbacks can't capture** surrounding state — route state through
  the bus, reconstruct it inside, or use a locus method with its own `self`.
- **`hale run` rejects qualified-name struct/locus literals** (`std::http::Request
  { }`) — use `hale build` + run the binary for programs using path-qualified
  stdlib types.
- **Two-hop `_util` import** (pond-specific): `_util/*` libs aren't importable from
  inside tier libs (a two-hop codegen break) — keep local copies there.

---

## 10. The workflow that makes this work

1. **Read this pack** (and the relevant spec section) before writing a locus.
2. **Write**, matching one of the six patterns.
3. **`hale check <dir>`** — the compiler is the oracle. Read the diagnostic; it
   names the rule and usually the fix.
4. **Fix and re-check** until `ok: N file(s) typechecked`.
5. **Maintain a `FRICTION.md`** in the project: when you hit a wall, append what
   you learned (the cause + the working shape). Read it before the next task.
   This "friction discipline" is how large Hale systems stay buildable by agents.

Don't reach for foreign patterns (TOML-in-a-locus, fluent builders, singletons,
decorators). When something doesn't fit the six patterns, log it as friction
rather than coding around it.
