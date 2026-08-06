---
title: "Claim-Driven Development in Hale"
kind: article
authorship: ai
series: "Hale as a general model checker"
part: 2
date: 2026-08-04
version: v0.14.0
summary: >-
  Write the system's laws before finishing its implementation, then let the
  compiler drive the program toward them. Named claims over Hale's call,
  message, effect, and topology graphs turn isolation, required wiring,
  single-writer rules, capability boundaries, and quantitative limits into
  ordinary development feedback.
---

The effects system lets one function make a promise: never blocks, never
reads the clock, nothing arriving through the bus may transitively cause a
payment. The compiler follows calls and message edges and either proves the
assertion or returns the path that violates it.

Some requirements do not belong to one function:

- the Delta side of an organization must never enter the Gamma side
- exactly one component may publish settlement commands
- every task vocabulary must have a handler
- every path to the ledger must pass through authorization
- processing one task may invoke the model at most once

Those are laws of the assembled system. Spreading them across function
annotations would make completeness depend on remembering every entry point —
and the requirement itself would have no name, no location, no source line a
reviewer could point to as the place where the law changed.

A claim is a **named sentence over the program graph**. It is evaluated by
`hale check` and lowers to no runtime code. If it is false, the compiler
returns a counterexample: a path, an ungranted boundary edge, an uncovered
topic, a set of competing writers, an excessive capability count.

That enables a development style with a deliberately literal name:

> **Claim-driven development writes the system's law first, then changes the
> program until the compiler can prove it.**

```text
state the claim → hale check → countermodel → edit → hale check
```

Effects say what a piece of code may do. Claims say what must remain true of
the whole.

## Write the law before the wiring

Most architecture work is implementation-first: create components, wire
topics, and eventually inspect the result to see whether the intended
boundaries survived. Claim-driven development reverses a narrow but important
part of that order — name the domains and state the law while the system is
still a skeleton.

Consider an application shared by two semi-independent organizations. Delta
receives work and performs triage. Gamma performs research. Each side has its
own store. Gamma may send one research digest to Delta, but Delta must never
enter Gamma's domain or read Gamma's knowledge.

Before the implementation is complete, `main.hl` can already say so:

```hale
group delta_wing = { delta::* };
group gamma_wing = { gamma::* };

main locus Org {
    params {
        github:   GithubGateway        = GithubGateway { };
        triage:   delta::DeltaTriage   = delta::DeltaTriage { };
        research: gamma::Research      = gamma::Research { };
    }

    claims {
        delta_does_not_enter_gamma:
            forbid reaches(delta_wing, gamma_wing);

        tasks_are_consumed:
            require subscribes(some delta_wing, topic t::Tasks);

        one_task_ingress:
            count publishers(topic t::Tasks) == 1;
    }
}
```

Suppose the gateway publishes `Tasks` but `DeltaTriage` does not yet
subscribe. The program is incomplete, and the claim says exactly how:

```text
claim `tasks_are_consumed` violated:
no member of `delta_wing` subscribes `t::Tasks`
```

Add the subscription and the obligation is satisfied — while the negative
boundary claim stays in force as the handler is filled in. Later, if a helper
call or message route crosses into Gamma, the same check turns red again.

The mix matters. A claims system with only prohibitions would reward the
empty graph: nothing calls anything, therefore every isolation property
holds. `require`, `cover`, and exact `count` forms state that the system must
actually do something. The useful target is not an isolated system; it is a
connected system whose connections satisfy its law.

## Why Hale can check a system sentence

A conventional compiler sees syntax, types, and calls. Hale sees more because
more of the system is written in the language: subscriptions and publishes
are declarations, ownership lives in `params`, placement and transport
boundaries are blocks, topics are a closed vocabulary, effects attach to
declared frontiers. Together those form a finite model — sorts, relations,
labels, weights — and a claim is a sentence evaluated over it.

The claim language is intentionally fixed. There is no user-defined inference
and no embedded theorem prover — reachability, existence, coverage,
cardinality, interposition, and bounded cost have compiler-defined semantics.
That restriction is what keeps claims predictable, decidable, and capable of
returning small counterexamples.

## Groups are the nouns of the law

Claims quantify over named sets of declared program elements:

```hale
group delta_wing = { delta::* };
group ledger = { LedgerWriter };
```

Groups are checked vocabulary, not text. A misspelled alias (`gama::*`) is an
error, not an empty set that happens to satisfy every prohibition. An empty
group is rejected unless it says `may_be_empty`, and a group that names real
declarations but projects to no executable vertices is refused too:

> A sentence that quantifies over nothing is not a successful sentence.

## The law belongs in `main`

A library seed is not a closed world — another program can import it, add
subscribers, bind its topics outward. `main locus` is the closing point: it
owns the assembled application and is unique within it. Its blocks are four
projections of one object:

```text
params       the organization
placement    its machine arrangement
bindings     its external boundary
claims       its law
```

Claims gate `hale check` as **errors**, never advisories — a warning that
says "tenant isolation is false" reads like a law while behaving like a
suggestion. Weakening a claim requires a source diff: remove a prohibition,
widen a grant, raise a bound. That diff is the review event.

## The verbs

**`forbid reaches(A, B)`** — no path from A to B, composing calls with
message dispatch by default. Restrict with `via { calls }` or `via { bus }`
when the distinction is the requirement; omitting `via` is the conservative
default. When it fails, the countermodel is the next task:

```text
claim `delta_does_not_enter_gamma` violated:
`delta_wing` reaches `gamma_wing`

witness:
`delta::DeltaTriage::on_task`
  -(publishes "org.metrics")->
`gamma::Research::on_metric`
```

Remove the publish, move the subscriber, route through a gateway — or change
the law, which is a categorically different kind of edit.

**`only edges A -> B { … }`** — the boundary form. Gamma may intentionally
send one digest to Delta while everything else stays forbidden:

```hale
gamma_to_delta_boundary:
    only edges gamma_wing -> delta_wing {
        publish t::ResearchDigest;
    };
```

Every direct edge must match a granted line; an unlisted topic is an error,
and call edges are never grantable — a permitted cross-domain dependency
should be a named bus edge, not an invisible method call. Widening the grant
list is a one-line diff that visibly widens the system's authority.

**`forbid reaches(A, effects(C))`** — data-plane isolation. Two domains with
no direct route can still share authority through a common helper that reads
the wrong store. Declare the vocabulary once —

```hale
domain wing = { delta, gamma };
effect knowledge(wing);
```

— classify each store read where the domain fact enters the program
(`@effects(is: {knowledge(delta)})`), and state the rule:

```hale
delta_cannot_read_gamma:
    forbid reaches(delta_wing, effects(knowledge(gamma)));
```

Control-plane and data-plane isolation are separate obligations; a serious
boundary often wants both.

**`require` / `cover` / `count`** — the positive forms:

```hale
task_worker_exists:
    require subscribes(some delta_wing, topic t::Tasks);

shared_topics_are_handled:
    cover topic in seed(t): subscribed_by(some positions);

one_task_ingress:
    count publishers(topic t::Tasks) == 1;
```

`require` demands the declared bus end exists. `cover` quantifies over an
imported vocabulary — every topic the seed declares must have a handler, and
an empty coverage domain is a vacuity error, not a trivial pass. `count` is
the cardinality family; `== 1` is the invariant behind every single-writer
pattern, and a failure names the competing loci.

**`bound C <= N on paths from G`** — a capability budget over a named part
of the system:

```hale
one_model_call_per_position:
    bound llm <= 1 on paths from positions;
```

The count is a per-invocation aggregate: one handler calling two helpers
that each invoke the model counts two. A loop-nested or recursion-reachable
carrier is unbounded; an unresolved operation that may hide one refuses
certification rather than counting as zero. The claim makes a domain
statement possible: a position may use the model, but one task may not fan
out into an unbounded agent tree.

**`avoiding G`** — interposition. Sometimes the law is not "A cannot reach
B" but "A may reach B only through G":

```hale
authorization_interposes:
    forbid reaches(public_api, ledger) avoiding authorization_gate;
```

Remove the gate from the walk and ask whether a path remains. If every real
route passes through authorization, the graph disconnects and the claim
holds; a bypass returns the path that avoids the gate. The same pattern
covers validation, redaction, audit, and admission control.

**`during P`** — a lifecycle slice. `forbid reaches(positions, effects(llm))
during birth` is the quiet-boot claim: model use is fine in steady state,
forbidden during startup. A phase that names nothing in the group is an
error, not a vacuous pass.

## Claim names are the contract of record

Every entry is `name: form;`, and the name is what a diagnostic, a CI check,
a review policy, a compliance control, or an incident report cites:

```text
claim `authorization_interposes` violated
```

is a statement about a declared contract, not a compiler warning whose
identity is an implementation detail. Renaming or weakening it is itself a
reviewable change.

## Keep the model in version control

A claim only has meaning relative to the model that was evaluated, so the
compiler can emit it:

```bash
hale check app --dump-topology > .hale.topology
hale check app --check-topology .hale.topology
```

The artifact carries the sorts, relations, groups, labels, and unknowns in
author spelling, plus every claim's result, under a `shape_hash` that
identifies the model half. A helper that adds a call, a new subscription, or
a newly unresolvable edge changes the report even when no claim fails — which
separates two review questions: *does the program still satisfy the law?*
and *did the graph change in a way reviewers should see?*

That yields three visibly different kinds of pull request: implementation
under the same law (claims and topology stable), topology change under the
same law (the artifact diff is the review surface), and law change (the
claims block itself moved). Those categories always existed; making the law
a block gives review a structural distinction it can enforce.

## What claims are not

**Not tests.** A test executes one case; a claim quantifies over every
represented path. Tests remain necessary for runtime values, algorithms, and
everything the static model cannot determine. A useful project writes both
first: the test drives behavior, the claim constrains the architecture the
behavior lives in.

**Not design by contract.** A precondition surrounds one operation; a
claim's witness may cross files, seeds, and message boundaries. The function
annotation and the claim are complementary grains of the same machinery —
one attaches a law to a declaration, the other quantifies over the world.

**Not a runtime policy engine.** Claims lower to no code, inspect no
traffic, authorize no requests. What is not knowable statically — a computed
subject, an un-elaborated deployment — is exposed as a boundary, never
silently approximated in the unsafe direction.

## The proof depends on derivation

Evaluating reachability is the easy half; deriving the graph is the trust
root. A negative claim can appear to hold for three bad reasons: the name
resolved to nothing, the quantified domain was empty, or an executable edge
was missing from the model. The first two are errors by construction. The
third is the compiler's soundness boundary, and the direction is fixed:

> Uncertainty may add possible edges. It may never delete an edge and report
> success.

An indirect call, an untypeable receiver, or a computed publish subject on a
forbidden path refuses certification rather than counting as nothing. Each
judgment form ships with a canary (a program where the claim must fail) and
a control (one where it must hold) — a checker that cannot fail proves
nothing.

## Looking ahead

The countermodel already answers a practical version of "what should I do
next": the missing subscriber, the uncovered topics, the competing
publishers, the path that crossed the boundary. An idea being explored —
`hale next` — would rank candidate repairs against the same objects the
workflow already produces, distinguishing law-preserving edits from
authority-increasing and law-changing ones. It is an idea, not a
prerequisite: the law, the model, and the countermodel come first, and they
exist today.

Likewise, a more dynamic `main` adds an elaboration stage — configuration
in, concrete deployment out, claims evaluated per elaborated deployment, so
a configuration matrix becomes a proof matrix. The static source states the
law either way.

## What claim-driven development is

The compiler does not invent the domains. It does not decide that Gamma
knowledge is confidential, that one model call is affordable, or that a
topic requires a single writer. The program states those judgments. What the
compiler contributes is the part people are bad at maintaining by
inspection: every transitive path, calls composed with message dispatch,
classifications carried across seed boundaries, vacuous quantifications
caught, participants counted, topology drift exposed, and a concrete
countermodel returned when the law is broken.

> **The program owns the law. The compiler owns the proof.**

Write the claim. Build toward it. Commit the resulting model. Keep both the
implementation and the architecture green.

That is claim-driven development in Hale.
