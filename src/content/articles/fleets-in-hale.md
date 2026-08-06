---
title: "Fleets"
kind: article
authorship: ai
series: "Hale as a general model checker"
part: 4
date: 2026-08-06
version: v0.16.0
summary: >-
  Claims close one application; a fleet plan closes one deployment of many.
  Topology artifacts compose across binaries, cross-process law gets checked
  with cross-process witnesses, and signatures carry the certificate to the
  machine that runs it. What a development lifecycle looks like when every
  stage from function to fleet is either proven or refused.
---

The [effects system](/articles/effects-in-hale/) lets one function make a
promise. [Claims](/articles/claims-in-hale/) let one `main locus` state a
law over one assembled application.
[Constitutions](/articles/constitutions-in-hale/) let many entrypoints prove
one law without copying it.

All three stop at the same wall: the process boundary. A system built from
several independently compiled binaries has laws that live above every one
of them —

- traffic from one domain must not reach a privileged sink except through a
  designated mediator
- exactly one *deployed process* may publish an authoritative channel
- an operator surface may command a service without acquiring its authority

— and every binary can be locally correct while the assembled system is
wrong. Recursively checking each application proves each local law and says
nothing about whether the deployed processes are connected in the intended
arrangement.

Fleets are the tier above: **a plan closes one deployment the way `main`
closes one application**, and the same checker runs over the composed world.

## Why not merge the source

The tempting implementation is a "super-main" that imports every application
and runs ordinary claims over the union. It is rejected for soundness
reasons, not taste:

- **It invents edges.** An unbound topic is in-process by default, so
  merging two binaries makes matching publishers and subscribers look
  connected when no deployed route joins them.
- **It erases edges.** Real routes supplied by deployment config or a broker
  do not appear because source was concatenated.
- **It changes what a call means.** Calls cannot cross a process boundary;
  flattening turns serialized messaging into ordinary reachability.

So the unit of composition is the **artifact**, never the source. Each
application's `hale check` emits a topology artifact — the model, the claim
verdicts, the topics table, source maps, an integrity digest — and the fleet
tier reads exactly what any third party would read. It never reopens the
source.

```sh
hale check apps/oms --dump-topology=artifacts/oms.json
hale check apps/gw  --dump-topology=artifacts/gw.json
hale fleet check prod.plan.json
```

A plan names deployed **instances** — `oms-0` is a process, `oms` is merely
a program — and the explicit routes between them:

```json
{ "schema": "1.1", "name": "prod",
  "instances": [
    {"id": "prober-0", "artifact": "artifacts/prober.json", "labels": ["strategy"]},
    {"id": "oms-0",    "artifact": "artifacts/oms.json",    "labels": ["oms"]},
    {"id": "gw-0",     "artifact": "artifacts/gw.json",     "labels": ["gateway"]}],
  "routes": [
    {"id": "intent", "transport": "unix",
     "publishers":  [{"instance": "prober-0", "topic": "OrderIntent"}],
     "subscribers": [{"instance": "oms-0",    "topic": "OrderIntent"}]}],
  "claims": [
    {"name": "orders_pass_oms",
     "forbid_reaches": {"from": "strategy", "to": "gateway", "avoiding": "oms"}}] }
```

Two rules carry the tier's soundness. **Matching wire identities establish
compatibility; only an explicit route creates an edge** — three binaries
declaring the same topics with no routes compose to zero connections, which
is precisely the property a source merge destroys silently. And endpoints
join on `(wire subject, payload hash)`, never on a local name: the same
identifier can mean different wire shapes in different applications, and
different identifiers can deliberately denote one contract.

When a fleet claim fails, the witness crosses binaries and still says where
to edit:

```text
fleet claim `orders_pass_oms` violated — witness:
  prober-0::Probe::submit  [prober/main.hl]
  -(route `bypass`)->
  gw-0::Gateway::on_order  [gw/main.hl]
```

Both components check clean on their own. Only the deployment is wrong —
which is the entire justification for the tier, and something no
per-application check can see.

## The lifecycle, tier by tier

With four tiers in place, a change moves from editor to production through
checks that hand evidence to each other rather than trust:

```text
function      @effects, budgets, phase contracts      hale check
application   claims { } in main                      hale check
entrypoints   constitutions × environments            hale check --matrix
deployment    fleet plan over artifacts               hale fleet check
```

**While developing**, the law is feedback. Write the claim before the
wiring; the countermodel is the task list. A new subscription that crosses a
boundary turns the check red in the same edit-check loop as a type error —
architecture drift surfaces at the moment of drift, not in a quarterly
diagram review.

**In review**, the artifact separates two questions: does the program still
satisfy the law, and did the graph change in a way reviewers should see?
Commit the topology artifact and diff it in CI. Three kinds of pull request
become structurally distinguishable: implementation under the same law,
topology change under the same law, and law change — where the `claims`
block itself moved, and the diff of the law is the review event.

**In CI**, the gates compose. `hale verify` fails on any advisory.
`hale check --matrix` proves every entrypoint under the law of every
environment that deploys it — an entrypoint listed nowhere is an error, not
a skip. `hale fleet check` with no argument checks **every** deployment the
workspace declares:

```toml
[fleets]
production = "ops/fleet/prod.plan.json"
staging    = "ops/fleet/staging.plan.json"
```

Every fleet runs even when an earlier one fails, and the exit status is the
worst of them. Checking whichever plan somebody remembered to name is the
same partial-coverage hole the matrix closes for entrypoints.

## The certificate travels

Everything so far proves things on the machine that ran the check. A
deployment usually happens somewhere else — a deploy box that did not build
the artifacts, a CI stage that did not run the checks. The remaining gap is
not analysis; it is custody.

Two properties close it. Artifacts are **byte-reproducible** — the same
sources produce the identical document from any working directory — so a
signature over exact bytes is meaningful. And the fleet tier already refuses
components it cannot verify, so signatures slot into an admission pipeline
that exists:

```sh
hale fleet keygen ops                        # ES256 keypair
hale fleet sign artifacts/oms.json --key ops.pem
hale fleet check prod.plan.json --trust ops.pub.pem
```

Trust is **strict when declared**. With trust roots present — `--trust`
flags, or `[fleet_trust] keys = [...]` in the manifest — an unsigned,
tampered, or wrong-key component is a composition error, ordered before any
claim runs. There is no `require = true` knob: a trust set that quietly
admits unsigned artifacts would be law that looks bound and binds nothing.
The fleet artifact records what admitted each component — the SHA-256 of the
bytes and the identity of the verifying key — so a reader can tell "verified
under this key" from "composed without trust", and the signature suite is
the one `std::crypto` already speaks, so a Hale program can verify the same
sidecar with the language's own stdlib.

The last row binds the executables themselves. Each instance may carry the
hash of the binary it is supposed to run, and attestation is all-or-nothing:

```sh
hale fleet attest prod.plan.json
```

An instance without the rows fails the attestation rather than thinning it —
a partial attestation would report coverage it does not have.

Assembled, the lifecycle reads as a chain of custody:

```text
write the law        claims, constitutions          the program owns the law
prove each world     check, --matrix                the compiler owns the proof
emit the evidence    --dump-topology                byte-reproducible artifact
sign the evidence    fleet sign --key               provenance over exact bytes
compose and check    fleet check --trust            only routes create edges
pin the binaries     fleet attest                   all instances or none
deploy               the certificate arrives with the fleet it certifies
```

The property the chain delivers has a one-sentence spelling: **the fleet
that runs is the fleet that was certified.**

## What the certificate does not say

The honest boundary matters more at this tier than at any other, because a
green pipeline is easy to over-read.

A signature certifies **provenance and integrity, never behavior**. It says
these exact artifacts, checked under this exact law, are the ones a
key-holder meant — not that the code is good, and not that a compromised
builder or a malicious compiler produced honest evidence in the first place.

The fleet model certifies **topology, never delivery**. Which routes exist,
which instances they connect, what each carries — yes. That a message will
arrive — no. Delivery is a property of the protocol and the peer, not of the
calling code, and no static analysis changes that. Runtime observation is
the measuring instrument, and it complements the static tier rather than
duplicating it: the plan says which routes should exist; the counters say
what actually flowed.

Attestation checks **bytes at rest**, at deploy time. Whether a running
process is still that binary hours later is a runtime question.

And a clean old plan plus a clean new plan say nothing about the arrangement
that exists midway through a rollout. The tier certifies exact steady
states; transitions are sequenced deployments of certified states, not yet a
certified object themselves.

Where the model is uncertain, it says so. Uncertainty may add possible
edges; it may never delete one and report success — the rule is the same at
every tier, and it is what makes the green worth trusting.

## What fleets are

The tiers share one design: a **closed world is not the whole repository or
the whole fleet — it is a stage boundary at which a graph becomes exact
enough to certify.** A function's frontier, an application's `main`, an
entrypoint under an environment, a deployment under a plan. Each closure
emits evidence the next closure composes without reopening what produced it.
Policy may be dynamic; validity is not.

> **The program owns the law. The compiler owns the proof. The signature
> makes the proof portable.**

Write the law at every tier. Prove every world that adopts it. Sign what
you proved, compose what you signed, and deploy nothing you didn't.

That is the fleet tier in Hale — and with it, the series' claim is complete:
one checker, four horizons, from a function's syscall set to the arrangement
of a production fleet.
