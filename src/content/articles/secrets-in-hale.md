---
title: "Secrets"
kind: article
authorship: ai
series: "Hale as a general model checker"
part: 5
date: 2026-08-08
version: v0.16.0
summary: >-
  Four rounds of design converged on almost nothing: one annotation, one
  built-in effect class, and claim forms that already existed. The story of
  a feature that kept getting smaller, what the ownership model was already
  doing, and why the interesting test of a checker is not what it proves but
  whether the next problem needs new machinery.
---

The request was ordinary enough: a signing key that the rest of the program cannot get at.

The first design answered it with information-flow analysis. Labels on values, a lattice, propagation through a semantic-event IR, declassification with named authority, program-counter labels for control dependence. It was a coherent design and a well-known one. It was also six phases of new compiler machinery, and it would have been the largest subsystem in the language.

What shipped was one annotation, one built-in effect class, and claim forms that already existed.

This is the story of the shrinking, because the shrinking is the point. The first four articles in this series argued that Hale is a model checker over its own structure. The interesting test of that claim is not another proof — it is what happens when a genuinely new problem arrives. If the answer requires a new subsystem every time, the structure was never doing the work.

## What the ownership model was already doing

Hale's programs are made of **loci**: a locus owns its state, its region, and its children, and the typed bus is how loci talk. That is not a security feature. It is the ordinary way you write anything.

But read it as a confinement primitive and it is almost exactly what a secret wants. Put the key inside a locus. Give that locus one method. Nobody else has the key; they have a phone number.

The word "almost" was carrying real weight, and it took building the thing to find out where.

## The one word that was missing

Loci turn out not to be encapsulated at the field level. This typechecks:

```hale
locus Gateway {
    params { signer: Signer = Signer { }; }
    fn go() {
        let key = self.signer.key;      // reads the child's state
        Audit <- Event { v: key };      // and publishes it
    }
}
```

A parent reads its child's params directly. For ordinary configuration that is convenient and harmless. For a key it is the whole ballgame: "the key never leaves the locus that owns it" was something you could check by reading, not something the compiler knew.

So: `@sealed`.

```hale
@sealed locus Signer {
    params { key: Bytes; }

    @effects(is: { secret_use })
    fn sign(m: Bytes) -> Signature { … }
}
```

A sealed locus's `params` are reachable only from inside its own methods. Others may still **call** it — that is the entire point — they may not touch its state.

```text
`Signer` is `@sealed`: its `params` are readable only from inside its own
methods, and `Signer.key` reads one from outside — call one of its methods
instead (sign)
```

One word, opt-in, breaking nothing. It follows `@supervised`, which has the same shape: a structural property a locus opts into.

The interesting question was whether anyone could actually adopt it, and that turned out to be measurable rather than arguable. `hale check --sealable` reports, per locus, the sites outside it that touch its params. Across this repository's own corpus — 151 loci in 94 programs — **148 seal with no changes at all**. The three that do not are the same shape: a parent reading a child's *result* field instead of calling a method, which the language's Law-of-Demeter rule already discourages.

## Where the design kept collapsing

Between the first proposal and the last, three intermediate designs were built far enough to be evaluated and then discarded. Each collapsed for the same reason.

**Value labels and a lattice.** Hale's model is declaration-grained: claims match declarations, effects belong to functions, the bus graph belongs to loci and topics. Values are not nodes in it. A label lattice needs them to be, which is why the design needed a semantic-event IR underneath — a second, finer model, invented to support the first.

**Declaration ports.** The next design kept the labels but made them travel between *ports*: a function's parameters, its return, a locus field, a topic payload field. That composes. It is also, as a reviewer pointed out, mostly a hand-built version of something the typechecker already does — propagate a type through every binding. If the secret *is* a type, tracking it is free.

**Type-ops.** Then: forget values, track which *operations* are applied to which *types*. That one is genuinely elegant, and it exposed something worth keeping. A call site is already a triple — `(function, callee, argument types)` — and the effect system walks exactly those sites, unions the callee's effect set, and **throws the argument types away**. Effects are that relation projected onto functions. Project it the other way and you get operations-per-type. Flow is the join.

Correct, and still more machinery than the problem needed.

## The distinction that ended it

Hale is an application kernel: the domain expresses the business, the library and runtime provide mechanism, the compiler assembles and asserts. "The domain should say as little as possible" sounds like a design rule until you notice that `claims { }` is domain text and we want *more* of it, not less.

The distinction that resolves it:

> **Tax** is what the domain must write *about mechanism* — wrappers, per-site releases, ownership modifiers, parameter markings.
>
> **Law** is what the domain must write *about itself* — "plugins never touch secrets", "one signing operation per request". No library and no compiler can supply it, because it is business knowledge.

Minimize tax. Law is not tax; law is the point.

And the corollary does most of the work: **the same feature is tax or machinery depending on who declares it.** An opaque wrapper type written by an application is tax. Shipped by `std::crypto`, it is machinery the domain merely uses. `only ops T { … }` written by an application is tax; shipped by the type's owner, it is machinery.

Sorted that way, every proposal on the table was tax. What was left was the ownership model, one word to close its gap, and sentences the domain was going to write anyway.

## The shape that shipped

```hale
@sealed locus Signer {
    params { env_var: String = "SIGNING_KEY"; key: Bytes = b""; }

    birth() { self.key = load(self.env_var); }

    fn ready() -> Bool { return len(self.key) > 0; }

    @effects(is: { secret_use })
    fn sign(m: Bytes) -> Bytes {
        if !self.ready() { return b""; }
        return crypto::hmac_sha256(self.key, m);
    }
}
```

Four rules, each earned by something going wrong first.

**Take the name of a source, not the bytes.** Sealing protects reads and writes; it deliberately does not restrict *initialization*, because a parent writing `Signer { key: … }` already holds what it passes. Which means if the material arrives as a constructor argument, some line of the application held it. So these take `env_var:` or `key_file:` and load in `birth`. There is no line anywhere in your code where the key exists as a value you could name.

That rule needed a second half. `birth` has to be the *only* writer, including the no-source case — otherwise a caller writes `Signer { key: b"…" }`, `birth` does not overwrite it, and the discipline evaporates. That was found by trying it.

**Refuse when unavailable.** `ready()` is not enough on its own if nothing consults it. An early version returned a perfectly valid HMAC under the empty key when no key had loaded, and `verify` accepted the matching forgery — which anyone can compute. The credential half was sharper: `matches(b"")` against an unloaded credential took a zero-iteration loop and returned `true`. An authentication bypass on any misconfigured deployment.

**Classify the one privileged method.** `secret_use` is a compiler-owned effect class, so the law can find every path that reaches it.

**Then state the law**, in forms that already existed:

```hale
claims {
    no_plugin_secrets:  forbid reaches(plugins, effects(secret_use));
    one_op_per_request: bound secret_use <= 1 on paths from handlers;
    vault_confined:     require sealed(all vaults);
}
```

Wire a signer into a plugin and the build stops with the crossing call named:

```text
claim `no_plugin_secrets` violated: `plugins` reaches `effects(secret_use)`
  — witness: `PluginHost::sneak` -> `std::secret::Signer::sign`
```

Two of those verbs are new, and both quantify over the whole closed world rather than over a path — so code written next month is covered without anyone editing the claim. `require sealed(all G)` demands confinement across a group, which matters because sealing is otherwise per-locus discipline and one unsealed member of a vault group is the whole hole. `require attributed(all syscall)` demands that every place the program touches the OS names a purpose.

That second one is worth a moment, because it is easy to think it is subsumed. Routing all I/O through a vetted component is expressible today — `forbid reaches(app, effects(syscall)) avoiding gate` — and it is a good rule. But it constrains **where** a boundary is crossed and says nothing about **what for**. All I/O can funnel through one `write(path, bytes)` that everyone calls for everything: perfectly gated, and you have no idea why any particular write happened. The two are independent, and a real system usually wants both.

## What it guarantees, stated exactly

> The secret lives in a locus that owns it, the domain cannot obtain it, the only operations on it are compiler-classified, and the domain's claims constrain who may reach them and how often.

This is **confinement, not information flow**. A signature derived from the key is not tracked. A constant-time comparison still lets the *verdict* be published. And the sealed locus's own body is trusted — which is why the standard library ships this shape, small enough to review, rather than leaving everyone to write their own.

Those sentences are in the specification, not in a footnote, because the alternative is letting a green result imply more than it earned. A checker's value is not that it says yes; it is that when it says yes, you know precisely what it said yes *to*.

## Three reviews, and what they were all about

The implementation went through three rounds of external review. Every round found real defects. It is worth being specific about their shape, because it was the same shape every time.

The first round found that `@sealed` stopped **reads** and permitted **writes**. The check was hooked to expression field access; an assignment target resolves through a different path in the compiler, and nobody had hooked it. Confinement that stops a read and permits a write does not merely fall short — it lets outside code *choose* the key, which is worse than reading it.

The second found that the stdlib's `secret_use` had no identity an application's claims could name. User-declared effect classes are interned per compilation unit, so the standard library's class and the application's were different bits. `forbid reaches(plugins, effects(secret_use))` silently missed the standard signer — the law over the recommended path was unenforceable, and it aliased differently depending on declaration order. It became a compiler built-in, which has one identity by construction.

The third found that adding that built-in had missed two lists. `@effects(only: { … })` is computed as the *complement* of a hardcoded class vector, and per-phase contracts iterate another. A class absent from either is one those contracts can never forbid — so `only: {}` certified a function reaching `secret_use`. Contracts whose entire purpose is rejecting unlisted effects were weaker than they read.

Not one of these was a flaw in the design. Every one was an **integration seam**: a rule enforced on one path and not its sibling, a class added to an enum but not to the lists that enumerate it, a syntactic form taught to one walker and not the one that reports. The individual judgements held up. What did not hold was the assumption that a new thing reaches every place enumerating its kind.

That is a more useful lesson than any of the individual bugs, and it points somewhere specific: conformance over the *enumerations* — every effect class appearing in every closed universe, every expression form in every walker — rather than another round of per-feature tests.

## Why this closes the series

The first four articles built upward: a function's effects, an application's claims, a shared constitution, a deployed fleet. Four closures, each emitting evidence the next composes.

This one built nothing. A new problem arrived — one with a large, well-established, entirely reasonable body of theory attached — and the answer was the ownership model that was already there, one word to close a gap in it, and sentences the domain was going to write regardless.

That is the actual test of a model checker over program structure. Not whether it can prove the properties it was designed to prove. Whether the next property needs a new machine.

> **The structure was already the answer. The work was noticing.**

The information-flow design is not wrong, and it is not gone. It is written down, with the ordering it would need and the theorem each stage would earn, waiting on a question that can only be answered by real programs: how often must a secret actually leave the locus that owns it? If the answer is "rarely", the largest subsystem we nearly built stays unbuilt — and that is the outcome worth wanting.
