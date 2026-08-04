---
title: "Claim-Driven Development in Hale"
kind: article
date: 2026-08-04
version: v0.14.0
summary: >-
  Write the system's laws before finishing its implementation, then let the
  compiler drive the program toward them. Named claims over Hale's call,
  message, effect, and topology graphs turn isolation, required wiring,
  single-writer rules, capability boundaries, and quantitative limits into
  ordinary development feedback.
---

The effects system lets one function make a promise.

A handler can say that it never blocks. A computation can say that it never
reads the clock. A locus can say that nothing arriving through the bus may
transitively cause a payment. The compiler follows calls and message edges and
either proves the assertion or returns the path that violates it.

Some requirements do not belong to one function.

- the Delta side of an organization must never enter the Gamma side
- nothing in one tenant may reach another tenant's knowledge
- exactly one component may publish settlement commands
- every task vocabulary must have a handler
- every path to the ledger must pass through authorization
- processing one task may invoke the model at most once

Those are laws of the assembled system.

Spreading them across function annotations would make completeness depend on
remembering every entry point. The requirement itself would still have no
single name, no single location, and no source line a reviewer could identify
as the place where the law changed.

Hale's claims system gives those requirements a place to live.

A claim is a **named sentence over the program graph**. It is evaluated by
`hale check` and lowers to no runtime code. If it is false, the compiler returns
a counterexample: a path, an ungranted boundary edge, an uncovered topic, a set
of competing writers, or an excessive capability count.

That enables a development style with a deliberately literal name:

> **Claim-driven development writes the system's law first, then changes the
> program until the compiler can prove it.**

The loop works today without a synthesizer:

```text
state the claim
      ↓
hale check
      ↓
countermodel or missing obligation
      ↓
edit the program
      ↓
hale check
```

An idea being explored for later is `hale next`: ask the compiler to propose
the next legal construction or smallest repair. But that command is not what
makes the workflow claim-driven. The essential loop already exists whenever a
failed claim identifies what the program must do—or stop doing—next.

Effects say what a piece of code may do.

Claims say what must remain true of the whole.

## Write the law before the wiring

Most architecture work is implementation-first.

You create components, add calls, wire topics, choose placement, and eventually
inspect the resulting system to see whether the intended boundaries survived.
Tests and review then try to reconstruct the architecture from the completed
program.

Claim-driven development reverses a narrow but important part of that order.

Start with a skeleton whose important declarations exist. Name the domains.
Write what must be absent, what must be present, and what must be unique. Then
let the compiler reject incomplete and malformed arrangements while the system
is being assembled.

Consider an application shared by two semi-independent organizations.

Delta receives work and performs triage. Gamma performs research. Each side has
its own store. Both may call an external model. Gamma is allowed to send one
research digest to Delta, but Delta must never enter Gamma's executable domain
or read Gamma's knowledge.

The project might be organized as:

```text
lib/topics/     shared topics and effect vocabulary
delta/          Delta positions and store
gamma/          Gamma positions and store
app/main.hl     the assembled organization and its law
```

Before the implementation is complete, `main.hl` can already name the domains:

```hale
group delta_wing = { delta::* };
group gamma_wing = { gamma::* };

group positions = {
    delta::DeltaTriage,
    gamma::Research
};

group gateways = {
    GithubGateway
};
```

And the main locus can state the first version of the law:

```hale
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
            require subscribes(
                some delta_wing,
                topic t::Tasks
            );

        one_task_ingress:
            count publishers(topic t::Tasks) == 1;
    }
}
```

Suppose the gateway publishes `Tasks`, but `DeltaTriage` does not yet subscribe.

The program is incomplete, and the claim says exactly how:

```text
claim `tasks_are_consumed` violated:
no member of `delta_wing` subscribes `t::Tasks`
```

Add the missing declaration:

```hale
locus DeltaTriage {
    bus {
        subscribe t::Tasks as on_task;
    }

    fn on_task(task: t::Task) {
        // implementation still in progress
    }
}
```

Run `hale check` again.

The missing obligation is satisfied. The negative boundary claim remains in
force while the handler is filled in. Later, if a helper call or message route
crosses into Gamma, the same check becomes red again.

This is the basic development loop:

```text
positive claims prevent an empty system from appearing complete
negative claims prevent implementation from escaping its boundaries
exact claims prevent accidental multiplicity
quantitative claims prevent permitted behavior from growing without limit
```

A claims system with only prohibitions would reward the empty graph. Nothing
calls anything; therefore every isolation property holds. `require`, `cover`,
and lower-bound or exact `count` forms matter because they state that the system
must actually do something.

The useful target is not an isolated system.

It is a connected system whose connections satisfy its law.

## Why Hale can check a system sentence

A conventional compiler sees syntax, types, calls, and control flow. Hale sees
more because more of the system is written in the language.

A subscription is not an arbitrary runtime call. It is a declaration:

```hale
bus {
    subscribe Tasks as on_task;
    publish Done;
}
```

Ownership is declared in `params`. Placement is declared in `placement`.
Transport boundaries are declared in `bindings`. Effects are attached to
compiler-known or program-classified frontiers. Topics are a closed
vocabulary.

Together those declarations form a finite program model:

```text
sorts:
    functions
    loci
    topics
    phases
    pools
    seeds

relations:
    calls
    publishes
    subscribes
    owns
    placed-on
    imported-from

labels:
    effect classes
    groups

weights:
    allocations
    publishes
    calls to classified carriers
```

The compiler was already querying parts of this model.

Effect assertions walk the call graph. `causes:` continues through publish and
subscribe edges. Quantitative budgets put weights on reachable operations.
Bus-cycle checks inspect the message graph. Placement checks compare calls with
execution pools.

Claims make the common judgment visible:

```text
Hale source
     ↓ derive
finite program model
     ↓ evaluate
named sentence
     ↓
holds, violated, or invalid
```

The claim language is intentionally fixed. Hale does not expose user-defined
recursive inference rules or an embedded theorem prover. Reachability,
existence, coverage, cardinality, interposition, and bounded cost have
compiler-defined semantics.

The restriction is what keeps claims predictable, decidable, and capable of
returning small counterexamples.

## Groups are the nouns of the law

Claims quantify over named sets:

```hale
group delta_wing = { delta::* };
group gamma_wing = { gamma::* };

group public_api = {
    HttpGateway,
    WebsocketGateway
};

group authorization_gate = {
    Authorizer
};

group ledger = {
    LedgerWriter
};
```

A group names declared program elements: loci, free functions, and imported
declarations. When a reachability claim is evaluated, a locus projects to its
executable surface—methods, handlers, lifecycle hooks, and modes.

Groups are checked vocabulary, not unchecked text.

A misspelled import alias:

```hale
group gamma_wing = { gama::* };
```

is an error. It does not resolve to an empty group that happens to satisfy every
prohibition.

An empty group is also rejected by default:

```hale
group probes = { };
```

The sentence “nothing in `probes` reaches the ledger” is trivially true if
`probes` contains nothing. That is not evidence about the system; it is a
vacuous proof.

A group that may legitimately be empty must state that explicitly:

```hale
group probes = { } may_be_empty;
```

There is a second kind of vacuity. A group may name real declarations but
project to no executable vertices—for example, a pure-data locus with no
functions. A function-grained reachability claim over that group still proves
nothing. The checker refuses that shape rather than quietly returning success.

The rule is simple:

> A sentence that quantifies over nothing is not a successful sentence.

## The law belongs in `main`

Groups define vocabulary at the top level. World-level claims belong to the
main locus:

```hale
main locus Org {
    params {
        // who exists
    }

    placement {
        // where they run
    }

    bindings {
        // where the process boundary is
    }

    claims {
        // what must remain true
    }
}
```

This is a semantic placement rather than a stylistic one.

A library seed is not a closed world. Another program can import it, instantiate
additional loci, add subscribers, or bind its topics to an external transport.
The closing build is where the whole application graph becomes available.

`main locus` is already that closing point. It owns the assembled application
and is unique within it.

The blocks form four projections of the same object:

```text
params       the organization
placement    its machine arrangement
bindings     its external boundary
claims       its law
```

The first three construct a system. Claims refuse constructions that do not
satisfy the declared requirements.

Claims gate `hale check` as errors, not advisories. A warning that said “tenant
isolation is false” would read like a law while behaving like a suggestion.

To weaken a claim, the source must change:

- remove a prohibition
- widen a group
- add a granted edge
- increase a bound
- relax a cardinality

That diff is the review event.

## Forbid an entire path

The basic negative claim is reachability:

```hale
claims {
    delta_does_not_enter_gamma:
        forbid reaches(delta_wing, gamma_wing);
}
```

By default, `reaches` composes ordinary calls with message dispatch.

The forbidden route might be direct:

```text
DeltaTriage::on_task
    → shared_helper
    → GammaResearch::read
```

It might cross the bus:

```text
DeltaTriage::on_task
    → publishes "org.metrics"
    → GammaResearch::on_metric
```

Or it might alternate between calls and message edges several times.

The claim does not ask whether the files look separate. It asks whether an
executable path in the assembled program connects the two declared domains.

A relation can be restricted when that distinction is itself the requirement:

```hale
claims {
    no_direct_dependency:
        forbid reaches(delta_wing, gamma_wing)
        via { calls };

    no_message_route:
        forbid reaches(delta_wing, gamma_wing)
        via { bus };
}
```

Omitting `via` selects the full composition. That is the conservative default:
more possible edges make a prohibition harder, not easier, to prove.

## A countermodel becomes the next task

Suppose someone adds “shared metrics” while implementing the Delta handler:

```hale
locus DeltaTriage {
    bus {
        subscribe t::Tasks as on_task;
        publish Metrics;
    }

    fn on_task(task: t::Task) {
        Metrics <- Metric { n: 1 };
    }
}
```

Gamma already subscribes:

```hale
locus Research {
    bus {
        subscribe Metrics as on_metric;
    }

    fn on_metric(m: Metric) {
        // ...
    }
}
```

The claim fails:

```text
claim `delta_does_not_enter_gamma` violated:
`delta_wing` reaches `gamma_wing`

witness:
`delta::DeltaTriage::on_task`
  -(publishes "org.metrics")->
`gamma::Research::on_metric`
```

The compiler has not merely said “architecture test failed.” It has returned
the concrete route that makes the sentence false.

That route is now the next development task.

The author can:

- remove the publish
- move the subscriber outside Gamma's protected group
- publish a sanitized topic to a different sink
- route through a declared gateway
- deliberately change the law

The last option is categorically different. A claim-driven workflow treats
“make the code satisfy the claim” and “weaken the claim” as separate classes of
change.

The witness is the countermodel, and the countermodel drives the repair.

## Direct boundary grants

Not every pair of domains is completely isolated.

Gamma may intentionally send one research digest to Delta while every other
direct Gamma-to-Delta edge remains forbidden.

That is an exhaustive boundary claim:

```hale
claims {
    gamma_to_delta_boundary:
        only edges gamma_wing -> delta_wing {
            publish t::ResearchDigest;
        };
}
```

Every direct edge from the source group into the destination group must match a
line in the block. An unlisted topic is an error.

A direct call across the boundary is also an error. This form deliberately does
not grant call edges: a permitted cross-domain dependency should be represented
as a named bus edge rather than an invisible method call.

The grant is a reviewable line:

```diff
 gamma_to_delta_boundary:
     only edges gamma_wing -> delta_wing {
         publish t::ResearchDigest;
+        publish t::SharedMetrics;
     };
```

That diff does not resemble an implementation detail. It visibly widens the
system's authority.

`only edges` and `forbid reaches` answer different questions:

```text
forbid reaches(A, B)
    no path from A to B exists

only edges A -> B { ... }
    every direct A-to-B boundary edge is named
```

`only edges` is not an exception clause attached to `forbid`. An allowed direct
edge still creates a path, so a blanket prohibition over the same direction
would reject it. Conversely, a direct-boundary enumeration does not by itself
exclude a transitive route through a third group.

Claim-driven development requires writing the sentence the architecture really
means, not treating “direct boundary” and “any path” as synonyms.

## Control-plane isolation is not data isolation

Two domains may have no direct call or message route and still share authority.

Delta might call a common helper that reads Gamma's store. That does not look
like a Delta-to-Gamma bus edge. It is still a breach of the domain rule.

User-defined effects supply the data-plane vocabulary.

The shared seed declares a closed domain and an indexed effect family:

```hale
domain wing = { delta, gamma };

effect knowledge(wing);
effect llm;
```

This produces:

```text
knowledge(delta)
knowledge(gamma)
knowledge(*)
```

A store read is classified where the domain fact enters the program:

```hale
locus DeltaStore {
    @effects(is: {knowledge(delta)})
    fn read(key: String) -> Idea {
        return self.ideas.get(key)
            or Idea { key: key, text: "" };
    }
}
```

Gamma's store carries `knowledge(gamma)`.

Now `main` can state the data rule independently of the control-plane rule:

```hale
claims {
    delta_cannot_read_gamma:
        forbid reaches(
            delta_wing,
            effects(knowledge(gamma))
        );

    gamma_cannot_read_delta:
        forbid reaches(
            gamma_wing,
            effects(knowledge(delta))
        );
}
```

`effects(C)` in target position denotes the declared carriers of that effect
class.

The program owns the classification: the compiler cannot infer that a
particular database row is Gamma knowledge. It can, however, own the propagation
once that classification exists.

That is the same division established by the effects system:

> The program classifies the domain frontier. The compiler follows every path
> from it.

Indexed families keep the vocabulary structured. A two-wing system could define
`delta_knowledge` and `gamma_knowledge` separately. A larger multi-tenant system
would repeat that pattern by hand. A closed index domain makes the family
explicit and provides `knowledge(*)` for claims that apply to all wings.

Control-plane and data-plane isolation are separate obligations:

```text
forbid reaches(delta_wing, gamma_wing)
    Delta cannot enter Gamma's executable domain

forbid reaches(delta_wing, effects(knowledge(gamma)))
    Delta cannot reach a source of Gamma's information authority
```

A serious isolation boundary often wants both.

## Required wiring keeps the graph useful

Prohibitions alone make the empty system look excellent.

Positive claims state the wiring that must exist:

```hale
claims {
    task_worker_exists:
        require subscribes(
            some delta_wing,
            topic t::Tasks
        );

    completion_source_exists:
        require publishes(
            some delta_wing,
            topic t::Done
        );
}
```

These claims inspect the declared bus ends. At least one member of the group
must declare the required subscription or publication.

Coverage quantifies over an imported vocabulary:

```hale
claims {
    shared_topics_are_handled:
        cover topic in seed(t):
            subscribed_by(some positions);
}
```

Every topic declared by the seed imported as `t` must have a subscriber in
`positions`. A violation names the uncovered topics.

The coverage domain itself must exist. If `seed(t)` resolves to no imported
topic vocabulary, the universal is not accepted as trivially true.

Cardinality handles exact structural requirements:

```hale
claims {
    one_task_ingress:
        count publishers(topic t::Tasks) == 1;

    done_has_a_consumer:
        count subscribers(topic t::Done) >= 1;

    at_most_two_audit_sinks:
        count subscribers(topic t::Audit) <= 2;
}
```

A failed count reports the actual cardinality and participating loci.

In the initial static form, these are counts over distinct declared locus
participants. They are not yet a runtime census of dynamically replicated
instances. Once deployment cardinality is elaborated from configuration or
machine state, exact instance claims must be evaluated against that concrete
elaboration.

That is not a special problem for claims. It identifies the stage at which the
sentence becomes meaningful.

## Bound a domain capability

The effects article introduced quantitative budgets attached to a function.
Claims lift the same idea to a named part of the system:

```hale
claims {
    one_model_call_per_position:
        bound llm <= 1 on paths from positions;
}
```

A model invocation is classified once:

```hale
@effects(is: {llm})
fn model_call(prompt: String) -> String {
    // local or remote model operation
}
```

The claim projects `positions` onto its executable roots and counts reachable
calls to `llm` carriers.

The quantity is a per-invocation aggregate. If one handler calls two helpers and
each helper invokes the model once, the count is two. It does not become one
merely because each individual root-to-leaf chain contains one call.

A loop-nested carrier is unbounded per invocation. A carrier under recursion is
unbounded. An indirect or unresolved operation that may hide a carrier must
prevent certification rather than count as zero.

This makes a domain statement possible:

> A position may use the model, but one task may not fan out into an
> unbounded agent tree.

The useful witness is quantitative rather than merely boolean: the measured
count and the contributors that produced it.

## Require interposition

Sometimes the law is not “A cannot reach B.”

It is “A may reach B only through G.”

Remove the gate from the walk and ask whether a path remains:

```hale
group public_api = {
    HttpGateway
};

group authorization_gate = {
    Authorizer
};

group ledger = {
    LedgerWriter
};

main locus App {
    claims {
        authorization_interposes:
            forbid reaches(
                public_api,
                ledger
            ) avoiding authorization_gate;
    }
}
```

Read literally:

> No path from `public_api` to `ledger` exists while
> `authorization_gate` is excluded.

If every real route passes through authorization, removing the gate disconnects
the graph and the claim holds. A newly introduced bypass returns the path that
avoids it.

The gate must be disjoint from the endpoints. Masking the destination would make
the claim vacuously true. Masking the source would silently remove roots. Both
are rejected.

The same pattern applies beyond authorization:

- every write reaches storage through validation
- every secret leaves through redaction
- every administrative action passes through audit
- every external command reaches the domain through admission control

Interposition is an architectural law, not merely a preferred call sequence.

## Slice a law by lifecycle phase

Some requirements hold only during one phase.

The organization may permit model use while processing tasks but forbid it
during startup:

```hale
claims {
    quiet_boot:
        forbid reaches(
            positions,
            effects(llm)
        ) during birth;
}
```

`during birth` restricts the source roots to the `birth` function of each source
locus. If no source member declares that phase, the slice is empty and the
claim is rejected as vacuous.

The first implementation also accepts a method or handler name:

```hale
during on_task
```

That is a source slice over methods with the given name, not a general temporal
logic. A richer phase relation can later live in the normalized program model
if the language needs state-dependent claims.

The important development property is already present: a phase-specific
violation identifies the path that made initialization, steady state, or
teardown exceed its declared authority.

## The first red build is useful

Claim-driven development is not “write a large block of assertions after the
system works.”

The claims are most useful before the implementation is finished.

A first pass can intentionally contain:

```hale
claims {
    tasks_are_consumed:
        require subscribes(
            some delta_wing,
            topic t::Tasks
        );

    one_task_ingress:
        count publishers(topic t::Tasks) == 1;

    delta_does_not_enter_gamma:
        forbid reaches(delta_wing, gamma_wing);

    delta_cannot_read_gamma:
        forbid reaches(
            delta_wing,
            effects(knowledge(gamma))
        );

    one_model_call:
        bound llm <= 1 on paths from positions;
}
```

At that point:

- missing subscriptions make `require` red
- missing or duplicate publishers make `count` red
- accidental cross-domain routes make `forbid` red
- a helper reaching the wrong store makes the indexed effect claim red
- duplicated model calls make the bound red

Each failure is a development obligation derived from the declared law.

A green build means more than “the code typechecks.” It means the currently
assembled graph satisfies the named requirements the program has chosen to
state.

## Claim names are the contract of record

Each entry is named:

```hale
claims {
    delta_does_not_enter_gamma:
        forbid reaches(delta_wing, gamma_wing);

    one_task_ingress:
        count publishers(topic t::Tasks) == 1;

    authorization_interposes:
        forbid reaches(
            public_api,
            ledger
        ) avoiding authorization_gate;
}
```

The name is what a diagnostic, CI check, review policy, or external artifact
can refer to.

That is different from a compiler warning whose identity is an implementation
detail:

```text
claim `authorization_interposes` violated
```

is a statement about a declared system contract.

The name can appear in:

- a pull-request check
- a design document
- a compliance control
- an incident report
- an exception process
- a topology artifact

Renaming or weakening it is itself a reviewable change.

## Keep the model in version control

A claim only has meaning relative to the model that was evaluated.

The compiler can emit a topology report:

```bash
hale check app --dump-topology > .hale.topology
```

The artifact contains the program's structural vocabulary in author spelling:

```json
{
  "schema": "1.0",
  "shape_hash": "9f3ac...",
  "sorts": {
    "loci": ["GithubGateway", "delta::DeltaTriage", "gamma::Research"],
    "fns": ["GithubGateway::intake", "delta::DeltaTriage::on_task"],
    "topics": ["t::Tasks", "t::Done", "t::ResearchDigest"]
  },
  "relations": {
    "calls": [],
    "publishes": [],
    "subscribes": []
  },
  "groups": {
    "delta_wing": ["delta::*"],
    "gamma_wing": ["gamma::*"]
  },
  "labels": {
    "delta::DeltaStore::read": ["knowledge(delta)"]
  },
  "unknowns": [],
  "claims": [
    {
      "name": "delta_does_not_enter_gamma",
      "form": "forbid reaches(delta_wing, gamma_wing)",
      "result": "holds"
    }
  ]
}
```

A later build compares the program against the committed baseline:

```bash
hale check app --check-topology .hale.topology
```

A helper that adds a call, a new subscription, an expanded group, a new effect
carrier, or a newly unresolved edge can change the report even when no current
claim fails.

That separates two review questions:

```text
Does the new program still satisfy the law?

Did the graph itself change in a way reviewers should see?
```

The `shape_hash` identifies the model half. Claim results are separate: the same
topology under a different law remains one shape, while a topology change
receives a new identity.

The first artifact is intentionally narrower than the eventual normalized
verification model. It records enough structure for the reachability-class
surface and for auditing where static certification stopped. Per-edge source
provenance, quantitative weights, the full phase relation, and concrete
deployment instances belong in the next model layer.

That limitation is worth stating because the schema, not the surface syntax, is
the long-term API.

## Three kinds of pull request

Claim-driven development makes three categories of change visible.

### Implementation under the same law

A handler is refactored, a helper is introduced, or a data structure changes.
The claims and topology remain stable.

This is ordinary implementation work within the declared architecture.

### Topology change under the same law

A new call or subscriber appears, but every claim still holds.

The topology artifact changes. Review can ask whether the new structure is
intentional even though it does not currently violate a law.

### Law change

A grant is added, a group is narrowed, or a bound is raised.

The claims block changes. The pull request is explicitly changing what the
system permits or requires.

Those categories existed before claims, but they were hidden in the same source
diff. Making the law a separate block gives review a structural distinction it
can enforce.

## Claims are not tests

A test executes one selected case.

A reachability claim quantifies over every path represented by the program
model. A cardinality claim inspects the complete declared set. A coverage claim
quantifies over a finite vocabulary. A bound follows every represented call and
message route from its roots.

Tests remain necessary for runtime values, algorithms, protocols, timing,
external systems, and behavior the static model cannot determine.

Claims answer a different class of question:

```text
test:
    given this input, did the program produce this output?

claim:
    can any represented path violate this system law?
```

Claim-driven development is therefore not a replacement for test-driven
development. They operate at different grains.

A useful project may write both first:

```text
test first:
    the handler produces a correct TaskDone

claim first:
    the handler cannot reach Gamma knowledge
    and can invoke the model at most once
```

One drives behavior. The other constrains the architecture in which the behavior
is allowed to exist.

## Claims are not ordinary design by contract

A precondition or postcondition surrounds one operation.

A claim can quantify over a domain assembled from many seeds, calls, handlers,
topics, and effect carriers. Its witness may cross files and message
boundaries.

Function annotations and claims remain complementary.

The annotation is written where one function's role is understood:

```hale
@effects(only: {knowledge(delta), llm, publish, alloc})
fn on_task(task: Task) {
    // ...
}
```

The claim is written where the assembled system's rule is understood:

```hale
claims {
    delta_cannot_read_gamma:
        forbid reaches(
            delta_wing,
            effects(knowledge(gamma))
        );
}
```

In the long-term model, the annotation is pointwise sugar over the same
underlying claim machinery. One attaches a law to a declaration. The other
quantifies over the world.

## The proof depends on derivation

Evaluating reachability is the easy half.

Deriving the graph is the trust root.

A negative claim can appear to hold for three bad reasons:

```text
the name resolved to nothing

the quantified domain was empty

an executable edge was omitted from the model
```

The first two are addressed directly:

- unknown groups, topics, effects, and members are errors
- empty groups and empty coverage domains are vacuity errors
- a group projecting to no executable vertices is rejected

The third is the soundness boundary of the compiler.

Every call form, message subject, imported declaration, generated method, and
dispatch rule must either contribute its edges or be represented as an unknown
that prevents certification.

The direction is fixed:

> Uncertainty may add possible edges. It may never delete an edge and report
> success.

That can reject a valid program whose operation the compiler cannot resolve. It
cannot certify an architecture by treating the unknown operation as doing
nothing.

Each judgment form therefore ships with a negative control:

```text
canary:
    a program in which the claim must fail

control:
    the corresponding program in which it must hold
```

A checker that cannot fail proves nothing. A checker that cannot pass proves the
wrong thing.

The program owns the law.

The compiler owns the derivation and the proof.

## Claims are static law, not a runtime policy engine

Claims lower to no runtime code.

They do not inspect production traffic. They do not authorize individual
requests. They do not replace validation, access control, supervision, or
runtime observation.

They answer what is knowable from the elaborated program model:

- which declarations can reach which others
- which topics connect declared endpoints
- where domain effects can propagate
- whether required structural members exist
- whether finite cardinalities and static path costs satisfy a bound

A computed runtime topic, an arbitrary reflective call, or a deployment choice
that has not yet been elaborated cannot be treated as a known static fact.

The right response is not to make the claim silently approximate in an unsafe
direction. It is to expose the boundary:

```text
this edge is unknown
this positive claim is deployment-dependent
this property belongs at runtime
```

Claim-driven development is useful because it refuses to confuse those
categories.

## From static `main` to elaborated deployments

The first claim model is derived from a static closing build.

A more dynamic `main locus` introduces another stage:

```text
configuration + machine + policy
               ↓
        deployment elaborator
               ↓
      concrete candidate main
               ↓
             claims
               ↓
          seal and run
```

This distinction matters most for positive and exact claims.

A negative claim such as:

```hale
forbid reaches(delta_wing, gamma_wing);
```

can often be checked conservatively over every possible edge.

An existential claim such as:

```hale
require subscribes(some workers, topic Tasks);
```

has no single truth value until a deployment chooses which workers exist.

An exact count:

```hale
count publishers(topic Commands) == 1;
```

must eventually count concrete instances, not merely declaration types.

The natural rule is:

> Claims are evaluated per elaborated deployment.

A configuration matrix then becomes a proof matrix:

```text
single-box development
three-node production
degraded one-region mode
high-throughput mode
```

Each elaboration receives its own topology identity and claim results.

The static source states the law. The elaborator proposes a concrete system.
The compiler accepts only arrangements that satisfy both language rules and
claims.

## The current `next` command is the countermodel

The manual workflow already answers a practical version of “what should I do
next?”

A failed `require` says which declared capability is missing.

A failed `cover` lists the unhandled topics.

A failed `count` names the competing publishers.

A failed `forbid` returns the path that crossed the boundary.

A failed `bound` identifies the excessive capability count and its
contributors.

That is enough to drive development:

```text
claim
  → failed obligation
  → focused edit
  → re-check
```

The compiler does not yet choose the edit. The developer does.

This matters because the repair space contains fundamentally different actions:

```text
law-preserving:
    remove an accidental edge
    add the missing subscriber
    route through the required gate
    replace a duplicate publisher

authority-increasing:
    add a new privileged component
    introduce a broader capability carrier

law-changing:
    widen an allowed boundary
    raise a bound
    narrow the protected group
    delete a prohibition
```

A useful development tool must distinguish them. The smallest textual change is
often to weaken the claim, but that is rarely the smallest
authority-preserving change.

## An idea under exploration: `hale next`

A possible future command is:

```bash
hale next app
```

Its input would be the same objects the current workflow already produces:

```text
current program model
named claims
failed countermodels
available declarations or deployment alternatives
```

Its output would be ranked candidate completions or repairs.

For a missing subscriber:

```text
claim `tasks_are_consumed` is violated

candidate 1:
    instantiate DeltaTriage in main.params
    its existing Tasks subscription satisfies the claim

candidate 2:
    add a Tasks subscription to GeneralWorker
    requires a new handler
```

For an isolation violation:

```text
claim `delta_does_not_enter_gamma` is violated

witness:
    DeltaTriage::on_task
      -(publishes Metrics)->
    Research::on_metric

law-preserving candidates:

    1. move the metrics subscriber outside gamma_wing

    2. route the metric through a redaction gateway and publish
       a distinct public topic

    3. remove the cross-wing subscription

law-changing candidate:

    4. grant Metrics across the boundary
       requires explicit permission to propose law changes
```

For deployment elaboration, the search space could include:

- locus cardinality
- implementation behind a perspective
- pool and core placement
- transport selection
- topic routing
- capacity
- predeclared deployment fragments

The claims become constraints. Placement or resource preferences become
objectives.

Conceptually:

```text
find change Δ minimizing cost(Δ)

such that

claims(elaborate(program + Δ)) all hold
```

This need not begin as general program synthesis. Hale's topology choices are
finite and heavily typed. A first implementation could search only
compiler-recognized structural edits and predeclared alternatives.

`hale next` is an idea, not a prerequisite.

The important point is that the compiler already knows what a candidate must
satisfy. Claim-driven development supplies the law, the model, and the
countermodel before it supplies the planner.

## A complete main-locus shape

Putting the pieces together:

```hale
import "lib/topics" as t;
import "delta" as delta;
import "gamma" as gamma;

group delta_wing = { delta::* };
group gamma_wing = { gamma::* };

group positions = {
    delta::DeltaTriage,
    gamma::Research
};

group gateways = {
    GithubGateway
};

locus GithubGateway {
    bus {
        publish t::Tasks;
    }

    fn intake(id: Int) {
        t::Tasks <- t::Task {
            id: id,
            label: "new",
            body: ""
        };
    }
}

main locus Org {
    params {
        github:   GithubGateway        = GithubGateway { };
        triage:   delta::DeltaTriage   = delta::DeltaTriage { };
        research: gamma::Research      = gamma::Research { };
    }

    bindings {
        // external topic adapters
    }

    placement {
        // machine policy
    }

    claims {
        delta_does_not_enter_gamma:
            forbid reaches(delta_wing, gamma_wing);

        gamma_to_delta_boundary:
            only edges gamma_wing -> delta_wing {
                publish t::ResearchDigest;
            };

        delta_cannot_read_gamma:
            forbid reaches(
                delta_wing,
                effects(knowledge(gamma))
            );

        gamma_cannot_read_delta:
            forbid reaches(
                gamma_wing,
                effects(knowledge(delta))
            );

        gateway_does_not_call_the_model:
            forbid reaches(
                gateways,
                effects(llm)
            );

        task_worker_exists:
            require subscribes(
                some delta_wing,
                topic t::Tasks
            );

        one_task_ingress:
            count publishers(topic t::Tasks) == 1;

        one_model_call_per_position:
            bound llm <= 1 on paths from positions;
    }
}

fn main() {
    Org { };
}
```

The file reads as an organization:

```text
params       the members
bindings     the boundary
placement    the machine arrangement
claims       the law
```

Implementation can change behind it. Helpers can be refactored. Seeds can grow.
Handlers can be split. As long as the derived graph continues to satisfy the
named sentences, the system remains within its declared architecture.

When it does not, the compiler returns the part of the graph that escaped.

## What claim-driven development is

Claim-driven development is not the claim that a compiler understands the
business better than its authors.

The compiler does not invent the domains. It does not decide that Gamma
knowledge is confidential. It does not know that one model call is affordable,
that authorization must interpose, or that one topic requires a single writer.

The program states those judgments.

What the compiler contributes is the part people are bad at maintaining by
inspection:

- finding every transitive path
- composing calls with message dispatch
- carrying domain classifications across seed boundaries
- detecting empty or misspelled quantification domains
- counting all declared participants
- exposing topology drift in review
- returning a concrete countermodel when the law is broken

The division is:

> **The program owns the law. The compiler owns the proof.**

Write the claim.

Build toward it.

Commit the resulting model.

Keep both the implementation and the architecture green.

That is claim-driven development in Hale.
