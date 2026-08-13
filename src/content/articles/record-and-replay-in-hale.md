---
title: "Record & Replay"
kind: article
authorship: ai
date: 2026-08-13
version: v0.16.0
summary: >-
  Record one concurrent execution, then re-run the same program with the same
  journaled inputs and the same per-consumer delivery order. How Hale turns
  its typed bus, effect frontier, and runtime ownership of scheduling into a
  replayable incident — without asking application code to instrument itself.
---

A concurrency bug is not only a bad input. It is a bad input observed in one particular order.

Two publishers race. One handler reads the clock between two deliveries. A random choice changes the next subject. The system reaches a state nobody can reproduce, and the incident report becomes a story: these messages probably arrived first, this worker may have been running, this timestamp came from somewhere around here.

Logs help, but logs are commentary the application chose to emit. They do not preserve every input, they rarely identify the exact delivery that caused another, and adding enough logging to reconstruct the schedule changes the schedule you were trying to observe.

Hale can record the choices below the application instead:

```sh
LOTUS_OBS_RECORD=run.halerec hale run app.hl
```

Then it can give those choices back to the same program:

```sh
hale replay run.halerec app.hl --diff
```

The replay recompiles the program, verifies that the recording belongs to that executable model, serves the recorded nondeterministic inputs, and makes each consumer handle queued deliveries in the order it saw the first time. `--diff` records the second run too and reports the first place the two executions disagree.

No logging calls are added to the loci. No handler is rewritten around a replay framework. The compiler and runtime already own the places where the relevant choices are made.

## What has to be repeated

A replayable execution has three independent parts:

| Part | What must match |
|------|-----------------|
| Program | The compiler, runtime, standard library, build options, and application source that produced the executable |
| Inputs | Values read from outside deterministic computation: time, entropy, environment, and other journaled frontiers |
| Schedule | The order in which each single consumer actually began handling its deliveries |

Missing any one gives you an imitation rather than a replay.

The same source under a different compiler is not necessarily the same program. The same messages with a different clock read are not the same inputs. The same inputs delivered to one worker in another order are not the same execution.

Hale already has a useful base case. A program running entirely on the main cooperative scheduler is deterministic by construction: one consumer thread, FIFO dispatch, handlers running to completion. Given the same inputs, there is no scheduling freedom left.

Pinned loci and additional cooperative pools introduce real concurrency. Hale does not respond by forcing production into one deterministic global scheduler. It records the order each consumer observed and reconstructs those orders later.

That distinction is the design.

## Inputs are invocations, not a bag of values

Consider two calls:

```hale
let delay = std::rand::next_int(100);
let now = std::time::monotonic_ns();
```

Saving one integer and one timestamp is not enough. Replay must also know which consumer made each call, which primitive it invoked, the exact arguments, and where the invocation sat relative to that consumer's other inputs.

The journal therefore records an ordered invocation envelope:

```text
consumer
primitive
exact encoded arguments
result, or an explicit withheld result
```

During replay, the next call must match the recorded primitive and its arguments before the value is served. `next_int(100)` cannot silently consume the value recorded for `next_int(101)`. A request for 32 random bytes cannot consume an entry made for 64. A changed environment-variable name is the first divergence, not a plausible value substituted into the wrong call.

The current journal covers:

- wall and monotonic time;
- `std::rand::next_int`;
- `std::os::getrandom`;
- environment variables and process arguments.

This is compiler/runtime instrumentation, not annotation-driven instrumentation. `@deterministic` can assert that a function reaches no time, entropy, or environment source, but record and replay do not depend on every author remembering to write it. Hale's effect inference already finds those frontiers transitively.

Environment values are withheld by default because recordings are artifacts people copy, attach to incidents, and retain. The artifact still records the call identity and the withheld value's length, so replay names the missing input rather than pretending it was reproduced. Exact environment replay is an explicit opt-in:

```sh
LOTUS_OBS_RECORD_ENV=full \
LOTUS_OBS_RECORD=run.halerec \
hale run app.hl
```

That option should be treated like writing a credential-bearing dump: useful when required, dangerous when handled casually.

## There is no global schedule

A multi-threaded trace tempts you to assign one process-wide sequence number to everything and call it the schedule. Hale does not need to invent that order.

The runtime's meaningful ordering unit is the **consumer**:

- the main bus queue has one consumer;
- each cooperative pool has one consumer worker;
- each pinned locus mailbox has one consuming thread.

Each consumer's delivery order is exact. The relative timing of two independent consumers is usually not.

Suppose two pinned publishers race into one sink:

```text
publisher A emits: A0 A1 A2 A3
publisher B emits: B0 B1 B2 B3

sink consumed: B0 A0 A1 B1 B2 A2 B3 A3
```

The sink's order is the fact that matters. Hale stamps the delivery when the handler is about to run, not when some producer enqueues it. Enqueue order can differ from consumption order once queues, mailboxes, and workers are involved.

Every message receives a run-stable identity derived from its producer consumer and that producer's sequence. A delivery is identified by the target locus together with that message identity, so one publish fanning out to two subscribers does not collapse into two indistinguishable copies.

During replay, an early delivery that is not the consumer's recorded next item is held. When the expected delivery arrives, it is released first. The runtime reconstructs the recorded order per consumer without imposing an order between consumers that the original execution never defined.

A divergent replay must not deadlock forever waiting for a delivery that will never exist. The hold is bounded. After the timeout, replay releases work, counts the order miss, and reports the divergence. Replay is an instrument: when it cannot reproduce the execution, it says where the reconstruction stopped holding rather than hanging in a counterfeit exactness.

## Observation and recording obey opposite laws

Hale's live observation plane is one-way glass. An observer may attach and inspect counters and records, but it must never become load-bearing. If a live consumer falls behind, observation drops old detail rather than stall the application.

A recording has the opposite requirement. A file that silently missed the critical delivery is worse than no recording because it looks complete.

So record mode changes the disposition:

```text
observation: drop rather than stall
recording:   stall rather than drop
```

Recorder-owned events travel through process-private per-thread rings rather than consuming Iris's public protocol namespace. The semantic probe points are shared; their pressure and failure contracts are not.

When a recording ring fills, its producer waits for the in-process drain. If the runtime cannot assign a ring to an emitting thread, the run fails. Allocation failure, write failure, malformed finalization, and internal artifact corruption fail loudly. A clean trailer and exact entry count distinguish a completed artifact from a file that merely happens to end in recognizable bytes.

Recording therefore changes timing by design. It is a flight recorder for reconstructing a run, not a zero-disturbance profiler. The application pays the cost of preserving the history it asked not to lose.

## Same program means more than the same filename

`hale replay` does not take a recording and optimistically run whatever source path it was given.

The artifact carries two identities.

The stronger one is a SHA-256 build-input digest covering the Hale parser, analyses, code generator, runtime, standard library, replay implementation, compiler build identity, build options, and the application's logical source paths and bytes. A change confined to the recorder runtime changes the identity. So does a behavior change that leaves the architecture graph untouched.

The second is the model's `shape_hash`: the normalized structural graph of loci, calls, topics, subscriptions, effects, ownership, and deployment facts. It answers a different question — whether the assembled system still has the same shape.

Exact replay requires both layers to agree. An unstamped recording or mismatched executable is refused unless the operator explicitly asks for an unverified experiment. A truncated or internally inconsistent artifact is rejected before application code runs.

The CLI validates the recording and hands the same file object to the child runtime; the runtime snapshots those bytes before serving values from them. Admission is about the artifact actually replayed, not whichever file happens to occupy the same path a moment later.

## Replay refuses to repeat side effects by accident

Re-execution is not automatically safe.

A replayed payment handler can send the payment again. A replayed webhook publisher can contact the real endpoint. A file write, subprocess launch, database mutation, or arbitrary FFI call does not become harmless because time and randomness were journaled.

Hale has an advantage here too: the compiler already infers effects over the call graph, and `main` declares external transport bindings. Before replay runs, the CLI checks that coverage boundary. Programs reaching live `syscall`, `ffi`, or unclassified behavior, or carrying external bindings, are refused by default.

Proceeding requires an explicit override:

```sh
hale replay run.halerec app.hl --allow-live-effects
```

That flag means exactly what it says: non-journaled reads and real outputs may touch the live world again. It is not a way to make them replayable.

This is deliberately conservative. Over-refusing a harmless sleep is inconvenient. Quietly sending a second order is unacceptable.

`where async_io` pools are also refused in the current system. Their coroutine interleaving needs its own replay model; treating it as an ordinary single-consumer queue would claim coverage the runtime does not have.

## What `--diff` compares

A replay can finish with no journal miss and still have computed something different. `--diff` makes the replay produce a second recording and compares the represented execution surfaces in both directions.

The comparison includes:

- each consumer's ordered public publish and delivery stream;
- each consumer's queued handler-consumption stream, including target and message identity;
- canonical wire payload bytes;
- metadata and declared size for raw same-process payloads;
- each consumer's ordered journal calls, exact arguments, redaction state, and results;
- the runtime verdict: journal misses, order timeouts, unconsumed entries, and unexpected deliveries.

Same-process typed payloads are deliberately not dumped as raw process memory. Their in-memory structs may contain pointers, padding, or secret-derived bytes, and an address is not a portable value. They are re-derived by executing the same program; the artifact records safe metadata. Payloads that already cross a wire have a canonical encoded form and can be compared as bytes.

The comparison is bidirectional. A missing expected delivery diverges. An extra replay delivery diverges. An input left unused diverges. A new input read past the journal diverges. Success is derived from the machine-readable replay verdict and the artifact comparison, not from the absence of one convenient error message.

The first mismatch is usually the useful one:

```text
replay DIVERGED:
consumer 17: delivery #41 was (target Orders, message B:20)
in the recording, but (target Orders, message A:21) in the replay
```

That turns an incident from a narrative into a coordinate.

For a debugger coordinate instead of a diff:

```sh
hale replay run.halerec app.hl --at 4120
```

The process stops at the selected consumption point so a native debugger can attach. A consumer-qualified coordinate is the stable form for multi-consumer programs.

## The exact guarantee

The current promise is intentionally narrower than “the universe happened twice”:

> **Re-run a recorded execution and get the same schedule and the same journaled inputs, with an explicit, checked coverage boundary.**

That sentence says several things and declines to say several others.

It says:

- the same admitted executable receives the recorded input invocations;
- each supported consumer handles queued deliveries in its recorded order;
- represented bus, payload, and journal surfaces can be compared for exact agreement;
- anything the runtime could not reproduce is counted and named.

It does not yet say:

- external socket or adapter ingress is injected from the artifact;
- arbitrary file, network, process, database, or FFI behavior is virtualized;
- external outputs are suppressed and transactionally compared;
- `async_io` coroutine schedules are replayed;
- every locus's final state is snapshotted and compared;
- the pre-stable recording format is a long-term storage contract.

External ingress captured at a wire boundary is useful evidence, but in this version the live reader still supplies the replayed run. Fleet-wide ingress injection and cross-process replay require stable origin identity and are a later phase.

The boundary is part of the feature. A replay system that approximates an unsupported source and prints green is less useful than one that refuses or returns a named divergence.

## A recording is not a WAL

The recorder is lossless over a successfully completed recorded run: it blocks or fails instead of silently dropping. That is not the same as making the recording a write-ahead log.

A WAL is load-bearing application state. It needs a durability fence before a protected delivery or output becomes visible, a fail-closed policy when storage cannot keep up, crash-tail recovery, checkpoints or snapshots, and restart semantics for accepted-but-uncommitted work. Batching becomes group commit; lag becomes a correctness limit rather than a debugging tradeoff.

The semantic substrate is deliberately compatible with that future. The same compiler-owned events could feed several policies:

```text
sampled forensic recording
full recording with bounded lag
batched replay-grade history
required durable WAL before delivery
```

But those are distinct contracts. The current recorder flushes a replay artifact; it does not claim that application progress is durable through an `fdatasync`, and a critical deployment cannot yet declare that it must refuse startup without a WAL.

Calling the two things by their right names keeps the path open without marketing the destination as shipped.

## Why Hale can do this below the application

General-purpose record/replay systems usually choose between two hard approaches: instrument application code and hope every input was wrapped, or trace the operating system deeply enough to reconstruct a process from syscalls and memory effects.

Hale owns a more useful middle layer.

The compiler knows the closed topic vocabulary and every declared publish and subscription. The runtime owns dispatch and knows where a message becomes a handler invocation. Placement identifies the single consumers whose local orders matter. Effect inference identifies nondeterministic frontiers. The build pipeline can name the executable semantics that must match. Payload types distinguish canonical wire values from unsafe process-memory snapshots.

That is enough to record the choices a deterministic Hale computation needs without teaching domain code about the recorder:

```text
application logic        unchanged
message topology         already declared
input frontier           compiler-derived
consumer schedule        runtime-owned
recording and replay      substrate policy
```

The absence of instrumentation is not only convenience. It is completeness. A critical handler cannot forget to log one delivery because the runtime is the thing delivering it. A helper cannot hide a clock read from the journal because the call reaches a compiler-known primitive. A new pool does not require someone to invent a correlation scheme because consumer identity belongs to placement.

Logs tell you what the program decided to say. A recording preserves the choices the program needs repeated.

> **A Hale recording is the run reduced to its replayable decisions.**

The bug becomes a file. The file becomes a test case. The first divergence becomes the next edit.
