---
title: "Effects in Hale"
kind: article
date: 2026-07-31
updated: 2026-08-02
version: v0.12.0
summary: >-
  A function can declare what it is allowed to reach, and the compiler proves
  the claim over the entire call graph. Effect classes, quantitative budgets,
  per-phase contracts, causal tracking in both directions across the bus, and
  effect classes a program declares for itself.
---

Most concurrent systems languages give you tools to *write* correct code and then ask you to keep it that way. Hale takes a different stance on a narrow but high-leverage slice of that problem: a function can declare what it is allowed to reach, and the compiler proves the claim over the entire call graph.

The mechanism is deliberately lightweight. Annotations are opt-in. Once present, the proof is total and incompleteness fails closed. The vocabulary is systems-oriented rather than academic. The same surface also supports quantitative budgets, per-lifecycle-phase contracts, and causal tracking across the typed message bus.

## Why effects at all

In a long-running concurrent process the properties that actually matter on the hot path are usually negative:

- this handler allocates nothing
- this function never blocks
- this computation is a pure function of its inputs (no clock, no entropy, no environment)
- this publish cannot transitively cause filesystem I/O
- after startup, the steady-state phase performs no dynamic allocation

These are the properties that keep RSS flat, latency predictable, and behavior replayable. Hale’s effect system exists to make them checkable at compile time instead of discoverable under load.

## Effect classes

The checker works with a fixed set of classes:

| Class | Meaning | Typical source |
|-------|---------|----------------|
| `syscall` | Kernel entry: filesystem, sockets, processes, terminal, stdio | `read_file`, `println` |
| `block` | Waits that hold a thread or worker turn | `sleep`, blocking `recv`, HTTP client |
| `time` | Reading a clock | `monotonic_ns` |
| `entropy` | Reading randomness | `next_int` |
| `env` | Reading environment or argv | `env::var` |
| `ffi` | Crossing into an `@ffi` declaration | any foreign function |
| `publish` | Sending on the bus | `Orders <- o` |
| `spawn` | Instantiating a locus | `Worker { }` |
| `recursion` | Cycle in the call graph | self-recursive function |
| `alloc` | Arena allocation (primarily for phase contracts) | constructing a buffer |

Two distinctions matter in practice.

First, `println` is a `syscall`. Writing to a stream is `write(2)`; it can block. A certificate that permitted debug printing would not be certifying what it claimed.

Second, reading an effect source is different from operating on a supplied value. `std::time::time_from_unix(n)` is pure; `std::time::monotonic_ns()` is not. The same split applies to parsing versus fetching, and to formatting versus sampling entropy. This is what makes `@deterministic` useful rather than merely restrictive: a function that never reads a clock, randomness, or the environment is a function of its inputs, so replaying the inputs replays the behavior.

The standard library publishes every function’s classes alongside its signature (`hale doc --stdlib`). The catalogue and the checker share the same registry, so they cannot disagree.

## Declaring what a function may reach

The general form is:

```hale
@effects(none: {syscall, block})
fn decode(b: Bytes) -> Msg { ... }

@effects(none: {time})
fn backoff(n: Int) -> Int { ... }

@effects(publish: {OrderFill})
fn route(o: Order) { ... }
```

`none: {…}` forbids the listed classes. `publish: {…}` states exactly which topics the function may send on; Hale’s topic set is closed, so the check is precise.

Common contracts have short names that expand to the same thing:

| Shorthand | Expands to |
|-----------|------------|
| `@no_syscall` | `@effects(none: {syscall})` |
| `@no_block` | `@effects(none: {block})` |
| `@no_ffi` | `@effects(none: {ffi})` |
| `@no_publish` | `@effects(none: {publish})` |
| `@no_spawn` | `@effects(none: {spawn})` |
| `@no_recursion` | `@effects(none: {recursion})` |
| `@deterministic` | `@effects(none: {time, entropy, env})` |

They compose. A typical hot-path certificate is one line:

```hale
@no_block @no_syscall @deterministic @no_recursion @hot
@budget(alloc_per_call = 0)
fn on_tick(a: Int, b: Int) -> Int { ... }
```

When an assertion fails, the diagnostic names the path, not merely the verdict:

```
effect assertion violated: `on_tick` must not reach `block`,
but reaches on_tick -> helper -> nap [std::time::sleep — a blocking operation …].
```

The checker follows ordinary calls, `self` methods, and calls made through handles. Moving an effect behind a locus the function still calls does not hide it. The workable patterns are to pass the already-computed value in, or to publish to a locus the asserting function does not reach.

Incompleteness fails closed. A standard-library call the registry cannot classify is treated as “may do anything.” An assertion is a claim about everything reachable; anything unknown is exactly what it must not certify.

## Quantitative budgets

`@budget` counts concrete resources:

```hale
@budget(alloc_per_call = 0, stack_bytes = 4096, block_points = 0)
fn on_frame(x: Int) -> Int { ... }

@budget(publish = 1)
fn reply(o: Order) { ... }          // exactly-once reply

@budget(fanout = 8)
fn notify(e: Ev) { ... }            // bounded amplification
```

`alloc_per_call = N` is enforced as a hard error. It counts arena allocations the compiler can see—literals, `@form` inserts, transitive callees, and the known-allocating `recv` family. A loop-nested allocation is unbounded per call. `N = 0` is the zero-allocation certificate.

`stack_bytes` measures the deepest call *chain*, not the sum of everything reachable. Side-by-side helpers of 100 bytes each cost 100, not 200. Recursion makes the bound unbounded, which is why the annotation pairs naturally with `@no_recursion`.

`fanout` counts transitive subscriber deliveries. Publishing once to a subject with 200 subscribers is a fan-out of 200. That is the amplification a per-function publish count cannot see.

`@hot` is the complementary switch: inside a marked function the ordinary allocation advisories become hard errors, and two stricter patterns (builder snapshots in a loop, whole-struct self-field replaces) are also elevated.

## Effects by lifecycle phase

A locus can constrain each phase of its life:

```hale
@phase_effects(birth: {alloc}, run: {})
locus Engine { ... }
```

That single declaration is the “allocate at startup, never in the steady state” discipline. Phase names are the six lifecycle hooks (`birth`, `accept`, `release`, `run`, `drain`, `dissolve`) or any handler or method by name:

```hale
@phase_effects(on_order: {publish, alloc})
locus Router { ... }
```

The set is exact. Building a payload and publishing it requires both `publish` and `alloc`; `{publish}` alone is a stricter claim than most handlers can satisfy.

Empty braces and omission are opposites:

| Form | Meaning |
|------|---------|
| `run: {}` | run may perform no effect at all |
| `run: {alloc}` | run may allocate and nothing else |
| *(run not mentioned)* | run is unconstrained |

`@phase_effects(birth: {alloc})` alone leaves `run` free. The explicit `run: {}` is required to close the steady state. Violations are errors and the diagnostic is prefixed with the phase.

## Effects that travel over the bus

A call graph stops at a publish. Because Hale’s message graph is declared over a closed topic set, the compiler can continue:

```hale
@effects(causes: {publish, syscall})
fn handle(o: Order) { Orders <- o; }
```

`causes:` is a complete declaration of everything the publish can transitively set off. Omitting a class that a subscriber actually performs is an error; the diagnostic names the path through the subject:

```
declared causal set violated: `Api::handle` can transitively cause syscall
through the bus … Path: `Api::handle` -> subject `Orders` -> `Audit::on_order`.
```

Only effects reached *through* the bus are counted here; direct effects remain under the ordinary `none:` / shorthand rules.

## Effects that travel *toward* you

`causes:` walks the bus graph forward. Its dual walks it backward. `@effects(depends: {…})` is the complete set of subjects that can transitively reach any of a locus's handlers:

```hale
@effects(depends: {Recalled})
locus StatedCarry {
    bus { subscribe SumLookup as on_sum; }
}
```

Without it, an independence claim is unenforceable. A locus that subscribes only to `SumLookup` looks isolated from `Recalled` in every declaration it carries. But if some third locus subscribes to `Recalled` and republishes onto `SumLookup`, the influence arrives anyway — and nothing in the depending locus's source mentions it. That is precisely the shape that review misses, because reviewing the file in front of you is not enough to see it. The diagnostic names the laundering path:

```
type error: declared dependence set violated: `StatedCarry` can be
transitively influenced by subject `Recalled`, which its
`@effects(depends: …)` does not declare. Path: subject `Recalled` ->
`Launderer` -> subject `SumLookup` -> `StatedCarry`.
```

It sits on the locus rather than a function: dependence enters through subscriptions, and subscriptions are declared per-locus. A function-level `depends:` is a parse error rather than a silent no-op.

It is opt-in, and the reason is measured rather than aesthetic. Over a real application — 428 topics, 114 loci — transitivity added nothing beyond what the `bus {}` block already said for 87% of loci. A mandatory form would have been redundant far more often than it was informative. It earns its place where independence is load-bearing: a locus that must not see PII, a control plane that must not be influenced by user traffic.

One boundary is worth stating plainly, because it is the kind of thing a certificate can be misread as covering. The closure is over the *bus graph*. Influence that travels outside it — through a shared form, through a file — is not part of it.

## Effects you declare yourself

Everything above concerns ten classes the compiler ships. As of this update, a program can name its own.

```hale
effect money;

@effects(is: {money})
fn charge(cents: Int) -> Bool { return cents > 0; }

@effects(none: {money})
fn quote(cents: Int) -> Int { return cents * 2; }

fn main() { println(quote(100)); }
```

`effect money;` declares the class. `is:` classifies a function as a source of it. From there it is an ordinary effect in every respect: it propagates through the call graph, it travels over the bus under `causes:`, it can be forbidden with `none:`, and a violation produces the same witness path a built-in would.

```
type error: effect assertion violated: `quote` must not reach `money`,
but reaches quote [`charge` declares it carries this effect class].
```

The obvious objection is that a user-defined effect has no frontier. The built-in classes are grounded: `syscall` is anchored in a classified standard library, and a call the compiler cannot classify fails closed. `money` has no such anchor, so `none: {money}` would seem to mean only "no function anybody remembered to annotate" — a linting convention wearing a type system's clothes.

It is a fair objection, and worth answering rather than waving at.

The answer is that the effects worth checking are about interaction with the outside, and that *is* the frontier. Money moves when the payment processor is called, when the ledger row is written, when the settlement message is published. Those are frontier calls already — the compiler classifies them today as `syscall` and `publish`. What `is:` does is add a row to a classification that already exists, at a different level of description. It does not introduce a second, ungrounded kind of grounding.

So the split is: **the compiler owns propagation; the program owns classification.** That is exactly the arrangement the standard library registry already has. The registry is a table somebody maintains by hand, audited against the runtime; `is:` is the same table with a different owner.

That framing is also the honest statement of the guarantee's limits. If you annotate `charge` and forget its sibling, `none: {money}` will not catch the sibling — no analysis can, because nothing in the program distinguishes the sibling from arithmetic. What the compiler does guarantee is that *given* your classification, no path escapes it. That is the part which is tedious and error-prone to maintain by review, and the part that stops holding the moment a call graph is more than a few edges deep. Classification is a judgement made once per function, in one place, by someone who knows the domain. Propagation is a whole-program problem that grows with the codebase. Splitting them puts each half where it can actually be done.

Two limits at v1. Classes are single-seed: one declared in a given compilation seed does not resolve from another, because merging per-seed intern tables needs index remapping across the merged AST. And there are 22 of them, occupying the free bits above the built-ins in the effect bitmask — enough for a domain vocabulary, not for a per-module taxonomy.

## The assertion you do not have to write

Placement already declares intent. A locus placed on a shared `async_io` cooperative pool shares that pool’s single worker. A handler that blocks therefore stalls every other locus on the pool. The compiler warns. Writing `@no_block` on the handler upgrades the check to an enforced error. A locus that owns its own pool may block on purpose; the annotation is how the author states that the warning was considered and rejected.

## Never trapping

`@no_panic` asks a different question: can any path here fail?

```hale
@no_panic
fn parse_frame(b: Bytes) -> Frame {
    return decode(b) or Frame { };   // handled — fine
}
```

An explicit `violate`, an `or raise` that propagates, or a trapping index violates the assertion. `or discard`, a substitute value, and `or handler(err)` satisfy it. The check is about failure becoming visible, not about the effect classes a function reaches.

## What the compiler sees: the effects manifest

Annotations only describe the functions someone remembered to annotate. The manifest describes every function:

```bash
hale check app.hl --dump-effects-manifest > .hale.effects
```

Each line records the declared contract (if any) and a `does={…}` column—the transitive effects the compiler observes, for free functions, methods, and lifecycle hooks alike:

```
App::run       does={syscall,block,time}
Pusher::run    does={syscall,block,publish,time,alloc}
```

A later build can diff against the committed file:

```bash
hale check app.hl --check-effects-manifest .hale.effects
```

```
- Api::emit  none={block}  does={publish,alloc}
+ Api::emit  none={block}  does={syscall,publish,alloc}
```

`Api::emit` gained filesystem I/O; nothing in its own source changed—a helper three calls away did. No declared contract was violated. The behaviour simply drifted. As a CI gate the drift becomes a one-line review diff.

## Relevance to safety-critical and certified systems

Several of the properties the effect system makes checkable line up with evidence that certification regimes already ask for.

DO-178C (and related standards such as IEC 61508, ISO 26262, and EN 50128) places heavy weight on demonstrable control of resource use, absence of unintended control flow, and traceable restrictions on what software may do in each operational phase. A function annotated `@no_block @no_syscall @deterministic @budget(alloc_per_call = 0)` is making a precise, machine-checked claim: it performs no kernel entries, never waits, depends only on its inputs, and allocates nothing. A `@phase_effects(birth: {alloc, syscall}, run: {})` declaration encodes the common safety pattern that dynamic allocation and certain side effects are confined to initialization. The effects manifest turns the inferred behaviour of every reachable function into a reviewable artifact that can be diffed under configuration control—exactly the kind of stable, auditable output that certification processes prefer over informal review comments.

Bus causality adds a further axis: because the topic graph is closed and typed, the transitive effects of a publish can be stated and checked. That is closer to an explicit data- and control-coupling analysis than to the usual informal argument that “messages only go to the intended subscribers.”

None of this is a certification by itself. The effect system is one component of a larger set of static guarantees (data-race freedom by construction, supervised failure, region lifetimes, bus-topology checks). A formal audit of the Hale implementation, including the effect checker, the model-checked runtime substrate, and the interaction of these analyses, is on the roadmap before the official v1 release. The intent is that the same mechanisms useful for ordinary systems performance also produce evidence that is legible to the processes used in avionics, automotive, rail, and other safety-critical domains.

## What the system is, and is not

The effect system is a static analysis layered on top of ordinary type checking and the existing bus-graph and placement checks. It does not introduce effect handlers, effect polymorphism, or a separate dynamic interpretation layer. The design goal is certificates for the properties that matter on hot paths and in long-running processes, not a general framework for abstracting over different interpretations of an effect.

The quality of the proofs depends on accurate classification of the standard library and on conservative treatment of `@ffi`. Unknown calls fail closed; that is the soundness-preserving choice, at the cost of requiring the registry to stay complete.

The surface is intentionally local. A codebase can adopt effect certificates only on the paths that need them. The rest of the language’s guarantees—data-race freedom by construction, supervised failure, region lifetimes, bus topology checks—continue to apply whether or not any function carries an effect annotation.

## A concrete shape

Putting the pieces together, a latency-sensitive ingest handler might look like:

```hale
@phase_effects(birth: {alloc, syscall}, on_datagram: {publish})
locus Ingest {
    params { /* … */ }

    birth() { /* resolve indices, open sockets, pre-allocate */ }

    @no_block @no_syscall @deterministic @hot
    @budget(alloc_per_call = 0, fanout = 4)
    fn on_datagram(dg: Datagram) {
        let msg = decode(dg.view());   // pure, zero-alloc
        Events <- msg;                 // declared publish, bounded fan-out
    }
}
```

No payload is constructed in the handler — the decoded value is forwarded
— so `{publish}` alone is satisfiable here; a handler that built its own
message would need `alloc` as well.

Startup may allocate and touch the kernel. The per-message path may not block, may not perform syscalls, may not read time or entropy, may allocate nothing, and may amplify to at most four subscriber deliveries. The compiler enforces each of those claims over the reachable call graph and the bus topology.

That is the effects system: a small set of classes, opt-in assertions that become total proofs, quantitative budgets, phase contracts, and causal tracking across the message bus—aimed at the properties concurrent systems code actually needs to keep, and structured so the same claims can later serve as evidence under formal audit.
