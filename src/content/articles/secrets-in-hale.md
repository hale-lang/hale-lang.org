---
title: "Secrets"
kind: article
authorship: ai
series: "Hale as a general model checker"
part: 5
date: 2026-08-08
updated: 2026-08-09
version: v0.16.0
summary: >-
  A signing key the rest of the program cannot reach, using the ownership
  model that was already there. One annotation closes the gap in it, one
  built-in effect class marks the privileged operation, and the law is
  written with the claim forms the language already has.
---

A signing key belongs to one component. Everything else should be able to *ask* for a signature and unable to obtain the key.

That is a confinement problem, and Hale answers it with the ownership model it already had, plus one word.

## The gap in the ownership model

Hale programs are made of **loci**. A locus owns its state, its region, and its children; the typed bus is how loci talk. Put the key in a locus, give that locus one method, and everyone else has a phone number rather than the key.

Almost. Loci are not encapsulated at the field level, so this typechecks:

```hale
locus Gateway {
    params { signer: Signer = Signer { }; }
    fn go() {
        let key = self.signer.key;      // reads the child's state
        Audit <- Event { v: key };      // and publishes it
    }
}
```

For ordinary configuration that is convenient. For a key it means "the key never leaves the locus that owns it" is a property you verify by reading rather than one the compiler knows.

`@sealed` closes it:

```hale
@sealed locus Signer {
    params { key: Bytes; }

    @effects(is: { secret_use })
    fn sign(m: Bytes) -> Signature { … }
}
```

A sealed locus's `params` are reachable only from inside its own methods, reads and writes both. Others may still **call** it, which is the entire point.

```text
`Signer` is `@sealed`: its `params` are readable only from inside its own
methods, and `Signer.key` reads one from outside — call one of its methods
instead (sign)
```

Reads and writes matter equally. A locus whose state can be replaced from outside doesn't merely leak the key: it lets a caller *choose* it.

The annotation is opt-in, and `hale check --sealable` reports what taking it would cost:

```text
sealability: 4 of 5 loci can be `@sealed` today

  free to seal (nothing outside touches their params):
    Already, App, Holder, Private

  would break callers:
    Exposed — 1 external access(es): Exposed.k
```

Most loci already qualify: across Hale's own corpus, 148 of 151. The ones that don't share a shape: a parent reading a child's *result* field instead of calling a method, which the language's Law-of-Demeter rule already discourages.

## Name the source, not the value

Sealing protects reads and writes. It deliberately leaves **construction** alone: a parent writing `Signer { key: … }` already holds what it passes, so restricting the initializer would cost ordinary configuration and buy nothing.

Which means a key arriving as a constructor argument is a key some line of your application held. So the standard library's holders take the *name of a source*:

```hale
locus Gateway {
    params {
        s: std::secret::Signer =
            std::secret::Signer { env_var: "SIGNING_KEY" };
    }
    fn go(m: Bytes) -> Bytes { return self.s.sign(m); }
}
```

The material is read during `birth`. It exists inside a sealed locus from the moment it enters the program, and there is no line anywhere in your code where you hold it. `self.s.key` is a compile error.

Two details make that hold. `birth` is the only writer, including the case where no source is configured, otherwise a caller seeds `key:` directly and the discipline evaporates. Every privileged method consults `ready()`: a signer that computes under an empty key returns a MAC anyone can forge, and a credential that compares against an empty value accepts the empty candidate.

`std::secret::Credential` is the same discipline for a token or password, with a `fingerprint()`, the first eight bytes of SHA-256, hex, for correlation in logs.

## One classified operation

The privileged method carries `secret_use`, a compiler-owned effect class. Every built-in effect name is reserved, so you use it without declaring it.

That single annotation is what makes the key's reachability a graph property. Effect classes propagate transitively through the call graph with no further annotation, so every path that can touch the key is visible to the checker.

## The law is ordinary

Nothing above needed a new claim form. The application states its rule with sentences that already existed:

```hale
claims {
    no_plugin_secrets:  forbid reaches(plugins, effects(secret_use));
    one_op_per_request: bound secret_use <= 1 on paths from handlers;
}
```

Wire a signer into a plugin, and the build stops with the crossing call named:

```text
claim `no_plugin_secrets` violated: `plugins` reaches `effects(secret_use)`
  — witness: `PluginHost::sneak` -> `std::secret::Signer::sign`
```

Two verbs do quantify differently from the rest, over the whole closed world rather than over a path:

```hale
claims {
    vault_confined: require sealed(all vaults);
    io_attributed:  require attributed(all syscall);
}
```

`require sealed(all G)` demands confinement across a group. Sealing is otherwise per-locus discipline, and one unsealed member of a vault group is the whole hole.

`require attributed(all C)` demands that every function directly performing built-in class `C` names a user-declared purpose: every place the program touches the OS says what for.

That second one is easy to mistake for a weaker version of routing all I/O through a vetted component, which is already expressible:

```hale
all_io_is_gated: forbid reaches(app, effects(syscall)) avoiding safe_io;
```

They are independent. Interposition constrains **where** a boundary is crossed and says nothing about **what for**: all I/O can funnel through one `write(path, bytes)` that everyone calls for everything: perfectly gated, and you have no idea why any particular write happened. Attribution constrains what for and says nothing about where. A real system usually wants both.

Because both universals quantify over the program rather than a named group, they also cover code nobody has written yet. A locus added next month is inside the law without anyone editing it.

## In the artifact

`sealed` is a hashed row in the topology model. A locus gaining or losing it moves `shape_hash`, so a `--check-topology` gate in CI sees the change. Confinement is a structural property of the program, not only an input to a claim, a seal changing with no topology diff would be the invisible security change the artifact exists to surface.

`require sealed` replays from the artifact. `require attributed` does not: it turns on *direct* effect sites, and the artifact exports inferred per-function effect sets, so that form is compiler-certified: the artifact carries its verdict, not the facts to recompute it.

## What it guarantees

> The secret lives in a locus that owns it, the domain cannot obtain it, the only operations on it are compiler-classified, and the domain's claims constrain who may reach them and how often.

This is **confinement, not information flow**. A signature derived from the key is not tracked. A constant-time comparison still lets the *verdict* be published. The sealed locus's own body is trusted, which is why the standard library ships this shape small enough to review rather than leaving everyone to write their own.

Those limits are in the specification, not a footnote. A checker's value is not that it says yes; it is that when it says yes, you know exactly what it said yes *to*.

## What secrets are

The other parts of this series each close a wider world: a function's effects, an application's claims, a shared constitution, a deployed fleet. Each closure emits evidence the next composes.

Confinement adds no closure of its own. It is those same mechanisms, ownership, classification, claims, pointed at a problem that looks like it needs a subsystem.

> **The secret is confined by ownership, marked by classification, and governed by law you already know how to write.**
