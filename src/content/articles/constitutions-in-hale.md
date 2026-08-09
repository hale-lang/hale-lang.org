---
title: "Constitutions"
kind: article
authorship: ai
series: "Hale as a general model checker"
part: 3
date: 2026-08-05
version: v0.15.0
summary: >-
  Claims stay closed-world, but their source no longer has to be copied into
  every main locus. Constitutions share one claimset across entrypoints and
  environments, compose only by addition, and make missing coverage an error.
---

The [effects system](/articles/effects-in-hale/) lets one function make a promise. [Claims](/articles/claims-in-hale/) let one `main locus` state a law over one assembled application.

That application-wide law still had to be authored in each main: correct for evaluation, awkward for a repository with several entrypoints. Constitutions separate the two concerns: write the law once, then prove it independently in every closed world that adopts it.

## One text, many worlds

Application-wide claims are evaluated in `main locus` because they are closed-world statements. A sentence such as “exactly one component publishes `Settled`” has no stable truth value while another importer can still add a publisher.

That rule created a mundane problem: one product may have an API binary, a worker, an admin tool, and several environment-specific entrypoints, all expected to obey the same law.

Copying the same `claims { }` block into every main is not enforcement. The copy somebody forgets fails open.

A constitution separates authoring from evaluation:

```hale
group billing = { Billing };
group research = { Research };
group payment_provider = { PaymentProvider };

constitution Core {
    tenant_isolation:
        forbid reaches(billing, research);

    one_settlement_writer:
        count publishers(topic Settled) == 1;
}
```

An entrypoint adopts it inside its ordinary claims block:

```hale
main locus Api {
    params {
        billing: Billing = Billing { };
        research: Research = Research { };
    }

    claims {
        adopt Core;

        local_rule:
            require publishes(some billing, topic Settled);
    }
}
```

`Core` is not checked once where it is declared. Its clauses are expanded into `Api` and evaluated against `Api`'s closed program graph. Another main can adopt the same constitution and receive a different verdict from a different graph.

The rule is:

```text
one authored claimset
N adopting entrypoints
N independent evaluations
```

Authoring is shared. Evaluation is not.

The vocabulary still has to exist in each world. If a constitution names `billing`, every adopting entrypoint must declare that group. An entrypoint that genuinely has no billing component says so explicitly:

```hale
group billing = { } may_be_empty;
```

An undeclared group is an error, not an empty set that happens to satisfy every prohibition.

## Composition only adds law

Constitutions compose with `extends`:

```hale
constitution Dev extends Core {
    no_real_payments:
        forbid reaches(billing, payment_provider);
}
```

Adopting `Dev` also adopts every clause in `Core`.

Composition is union, and nothing else. A derived constitution may add a clause; it may not replace one:

```hale
constitution Core {
    one_writer:
        count publishers(topic Commands) == 1;
}

constitution Relaxed extends Core {
    one_writer:
        count publishers(topic Commands) <= 3;
}
```

```text
claim `one_writer` is declared by two constitutions, `Core` and `Relaxed`.
Composition is union, so a name must mean one thing across the whole adopted set
```

Allowing the replacement would make weakening look like ordinary composition. Deciding whether one arbitrary claim strengthens another would require proving implication between the two sentences. Constitutions avoid that problem rather than pretending to solve it.

A stricter rule is a second named claim. Both remain active. A weaker rule can also be added under another name, but it cannot erase the inherited stronger one.

Weakening is not rejected after the fact. It is unexpressible through composition.

The same rule settles the mechanics. Two different constitutions contributing one claim name are an error. A local claim cannot shadow an adopted one. `extends` cycles are errors. A diamond contributes its shared base once, deduplicated by origin rather than by claim name, so a real collision is never swallowed as duplicate inheritance.

## Product law and environment rails

A source-level adoption means what it says:

```hale
claims {
    adopt Core;
}
```

This entrypoint always carries `Core`.

Some law belongs to a deployment target instead. Development may forbid the real payment provider. A restricted installation may forbid network egress. One source entrypoint may need to be checked under several such environments. In that case the common baseline and the environment additions can be bound in `hale.toml` instead of hard-coded into the entrypoint:

```toml
[claims]
base = "Core"

[environments.dev]
constitution = "Dev"
entrypoints = ["apps/api", "apps/worker"]

[environments.prod]
source_only = true
entrypoints = ["apps/api", "apps/worker"]
```

The base is carried by every environment. An environment may add law; it cannot drop the base.

Both absences are explicit. A workspace with environments must say either `base = "..."` or `no_base = true`. An environment adding no constitution says `source_only = true`. A missing field and a misspelled field look the same to a verifier, so unknown manifest keys are rejected rather than ignored.

One pair can be checked directly:

```bash
hale check apps/api --env dev
```

The full matrix checks every declared entrypoint in every environment where it may run:

```bash
hale check --matrix
```

Each pair is still its own closed-world compilation. The matrix repeats the check; it does not widen the world being checked.

Completeness is part of the check. An entrypoint listed in no environment is an error, not a skip. A malformed seed is unknown rather than silently treated as “not an entrypoint.” The command runs every pair and reports the complete set of failures.

That closes the remaining copy-and-paste hole. It is no longer enough for a constitution to exist; every deployable entrypoint must be accounted for under the law of every destination that names it.

## A name is not an identity

Constitution names are kept flat and readable in source and diagnostics. That means two imported seeds can each declare something called `Core` while meaning different things.

The matrix therefore does not compare names alone. A constitution's identity is a digest of its normalized closure: its own sorted clauses plus the identities of the constitutions it extends. A pure composition such as:

```hale
constitution Dev extends Core { }
```

still has an identity even though it contributes no clause of its own.

For every evaluation, the topology artifact records:

- the environment being checked;
- the root constitutions selected directly: the workspace base and
  the environment's own addition, since both are named rather than
  inherited;
- the complete closure those roots reach, with a digest for each;
- the source constitution for each resulting claim.

That is enough to distinguish “this clause came from `Core`” from “this run certified the development deployment under this exact `Core`.” The evaluation record is covered by the artifact integrity digest, so it cannot be edited independently of the certificate it describes.

## The boundary stays put

A constitution does not change what a claim quantifies over. It is not checked at its declaration site, and `--matrix` does not create a workspace-wide program graph. Every clause is still evaluated in one `main locus` against one assembled application.

That keeps the existing claims model intact. Constitutions do one thing: move repeated law into one declaration without moving proof out of the closed world. The union rule, environment matrix, and closure identity are there to keep that sentence true as the repository grows.
