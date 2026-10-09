// The glossary: every Hale word, with the familiar idea it names and the
// one difference worth knowing. One source for two readers:
//
//   src/pages/glossary.astro renders the page from it;
//   src/integrations/gloss.mjs underlines the first use of each `match`
//   on every built page outside the docs, links it here, and attaches the
//   short `gloss` so it shows on hover.
//
// `familiar` and `difference` are HTML (they carry <code>); `gloss` is
// plain text, because it travels in an attribute.

export const GROUPS = [
  {
    "title": "The language",
    "entries": [
      {
        "id": "locus",
        "term": "locus",
        "familiar": "a component that owns its own state and talks to others only through messages, like an actor, a small service, or an object nobody else can reach into. An app, a cache, a request handler and a library are all loci.",
        "difference": "there is no other kind of thing, so the compiler can see the whole graph of who owns what and who talks to whom.",
        "gloss": "A component that owns its own state and talks to others only through messages, like an actor or a small service. There is no other kind of thing, so the compiler sees the whole graph."
      },
      {
        "id": "topic",
        "term": "topic",
        "familiar": "a named, typed message channel, like a pub/sub topic in Kafka or NATS.",
        "difference": "it is declared in source with its payload type, and publishing and subscribing are declarations too, so the compiler knows every sender and every receiver.",
        "gloss": "A named, typed message channel, like a pub/sub topic. Declared in source, so the compiler knows every sender and receiver."
      },
      {
        "id": "bus",
        "term": "bus",
        "familiar": "an event bus. In a locus, the <code>bus</code> block lists which topics it publishes and subscribes to; at runtime, the bus delivers them.",
        "difference": "a bus edge can be a direct call, an in-process queue, a socket or a broker, and the program does not change when that changes.",
        "gloss": "The event bus: the block that lists what a component publishes and subscribes to, and the runtime that delivers it."
      },
      {
        "id": "keyed",
        "term": "keyed_by",
        "familiar": "a partition or sharding key. A keyed topic delivers each message only to the subscriber whose key matches.",
        "difference": "the routing is part of the topic's declaration, so the handler never filters and the compiler checks the key's type.",
        "gloss": "A partition key. A keyed topic delivers each message only to the subscriber whose key matches."
      },
      {
        "id": "send",
        "term": "the send, <code>&lt;-</code>",
        "familiar": "publishing a message. <code>Broadcast &lt;- m</code> puts <code>m</code> on the Broadcast topic.",
        "difference": "a send is only allowed from a locus that declared it may publish there.",
        "gloss": "Publishing a message onto a topic."
      },
      {
        "id": "main",
        "term": "main locus",
        "familiar": "<code>main()</code> plus the deployment manifest, in one place.",
        "difference": "the root component also says where each part runs and how each channel travels, and nothing else in the program mentions a thread or a transport.",
        "gloss": "main() and the deployment manifest in one: the root component, where each part runs, and how each channel travels."
      },
      {
        "id": "placement",
        "term": "placement",
        "familiar": "thread affinity and scheduling: a shared pool, a dedicated thread, a pinned core, a NUMA node.",
        "difference": "it is a block in <code>main</code>, and the components it places do not change.",
        "gloss": "Thread affinity and scheduling: a shared pool, a dedicated thread, a pinned core, a NUMA node. A block in main; the components do not change."
      },
      {
        "id": "bindings",
        "term": "bindings",
        "familiar": "the wiring in a deployment config: which transport carries which channel. In-process, a Unix socket, a shared-memory ring, or an adapter to a broker like NATS.",
        "difference": "the transport is itself a child component, so it is supervised like one, and a binding that cannot open fails at startup, so no route drops messages silently.",
        "gloss": "Which transport carries which channel: in-process, a Unix socket, a shared-memory ring, or an adapter to a broker."
      },
      {
        "id": "params",
        "term": "params",
        "familiar": "a component's typed fields with defaults: its constructor arguments and its state.",
        "difference": "params are a contract, so constructing a component with a field it never declared is a compile error.",
        "gloss": "A component’s typed fields with defaults: its constructor arguments and its state."
      },
      {
        "id": "lifecycle",
        "term": "birth, run, dissolve",
        "familiar": "constructor, main body, destructor.",
        "difference": "dissolve frees the component's whole memory region at once, so there is no garbage collector and no borrow checker.",
        "gloss": "Constructor, main body, destructor. Dissolve frees the component’s whole memory region at once."
      },
      {
        "id": "supervision",
        "term": "supervision, on_failure",
        "familiar": "Erlang-style supervisors: a parent handles a child's failure and can restart it, quarantine it, or pass it up.",
        "difference": "there is no other error channel; nothing fails sideways.",
        "gloss": "A parent handles a child’s failure and can restart it, quarantine it, or pass it up. Nothing fails sideways."
      },
      {
        "id": "fallible",
        "term": "fallible(E)",
        "familiar": "a Result type or a checked exception: a function that can fail says so in its signature.",
        "difference": "the caller must say what happens at the call site, with <code>or default</code>, <code>or raise</code> and the rest, and forgetting is a compile error.",
        "gloss": "A function that can fail says so in its signature, and the caller must handle it at the call site."
      },
      {
        "id": "closure",
        "term": "closure",
        "familiar": "an invariant, or an assertion that must hold.",
        "difference": "it is declared on the component and audited by the runtime at phase boundaries, and a broken one goes to the parent as a structural failure.",
        "gloss": "An invariant on a component, audited by the runtime at phase boundaries."
      },
      {
        "id": "perspective",
        "term": "perspective",
        "familiar": "an interface with a swappable implementation.",
        "difference": "it can be swapped while the program runs, at the cost of a pointer flip, with state carried across.",
        "gloss": "An interface with an implementation that can be swapped while the program runs."
      },
      {
        "id": "sealed",
        "term": "@sealed",
        "familiar": "private fields.",
        "difference": "components are not otherwise encapsulated at the field level, so <code>@sealed</code> is what makes \"nobody else can read this key\" a fact the compiler enforces.",
        "gloss": "Private fields, enforced by the compiler."
      },
      {
        "id": "unit",
        "term": "unit",
        "familiar": "a unit of measure, like <code>ms</code> or <code>USD</code>, declared with its equation: <code>unit USD = 100 cent;</code>.",
        "difference": "a program declares its own, the standard library's time units are declared the same way, and the compiler knows every conversion between two units as one exact factor.",
        "gloss": "A unit of measure, like ms or USD, declared with its equation. The compiler knows every conversion as one exact factor."
      },
      {
        "id": "quantity",
        "term": "quantity, point",
        "familiar": "a typed amount, such as Money or Duration, and a position on its line, such as Price or Time.",
        "difference": "every value is the integer it counts, arithmetic stays exact, widening is free, and narrowing is written where it happens with the rounding you chose: <code>or floor</code> at the site, or <code>{ round: half_even; }</code> on the type.",
        "gloss": "A typed amount or a position on its line. Every value is the integer it counts; widening is free and narrowing names its rounding."
      },
      {
        "id": "distinct",
        "term": "distinct, range",
        "familiar": "a newtype for an id, and a bounded integer.",
        "difference": "an identity never passes for an <code>Int</code> and has no arithmetic; a range is an <code>Int</code> with bounds, and narrowing into it says what happens outside them: <code>or clamp</code>, <code>or wrap</code>, <code>or 0</code>, or a handler.",
        "gloss": "A newtype for an id that never mixes with an Int, and a bounded integer that says what happens outside its range."
      },
      {
        "id": "surface",
        "term": "api, rpc, surface",
        "familiar": "an API definition, like an OpenAPI document or a gRPC service, listing the operations and who may call each.",
        "difference": "it is rows in the program, <code>rpc Shop::on_order requires: [clerk]</code>, and the compiler checks them, hashes them into a contract digest, and generates the OpenAPI, JSON Schema and MCP forms. Arrives in the next release.",
        "gloss": "An API definition as rows in the program: the operations, and the roles a caller needs. The compiler checks and hashes it and generates the client forms."
      },
      {
        "id": "role",
        "term": "role",
        "familiar": "a permission group.",
        "difference": "a role is declared vocabulary with <code>includes</code>, the requirement sits on the operation's row, and who holds a role is a source the serve site names, so one program can serve the same surface to two sets of people.",
        "gloss": "A permission group, declared in the program, required on an operation’s row; who holds it is a source the serve site names."
      },
      {
        "id": "serve",
        "term": "api::serve, exposure",
        "familiar": "starting the server.",
        "difference": "one line puts a surface on a transport the standard library ships, a Unix socket, HTTP or MCP, with a bounded queue and one policy for when it is full, and the running exposure describes itself to any client.",
        "gloss": "A surface put on a transport the library ships. A running exposure describes itself to any client."
      },
      {
        "id": "hub",
        "term": "hub, stream",
        "familiar": "a WebSocket channel.",
        "difference": "a stream is a topic bound to a hub, with the roles a subscriber needs on its row, so the same typed topic the program already publishes reaches the outside.",
        "gloss": "A WebSocket channel: a topic bound to a hub, with the roles a subscriber needs."
      },
      {
        "id": "altitude",
        "term": "altitude",
        "familiar": "how low-level you are working: scripting, everyday application code, services, systems programming.",
        "difference": "it is one language at every level, and a function written at the top still compiles at the bottom. Scale, how big the system is, is a separate axis.",
        "gloss": "How low-level you are working, from scripting to systems programming. Not how big the system is."
      },
      {
        "id": "scale",
        "term": "scale",
        "familiar": "how big the composed system is, from a function to a fleet of machines.",
        "difference": "the same construct, the locus, is what you write at every size.",
        "gloss": "How big the composed system is, from a function to a fleet."
      }
    ]
  },
  {
    "title": "What the compiler checks",
    "entries": [
      {
        "id": "effect",
        "term": "effect, effect classes",
        "familiar": "what a function is allowed to do: make a syscall, block, read the clock, allocate, publish, spawn, recurse. It resembles an effect system, or a stricter notion of a pure function.",
        "difference": "a declaration is proven across everything the function can reach, and a violation names the path.",
        "gloss": "What a function is allowed to do: syscalls, blocking, time, allocation, publishing. Proven across everything it can reach."
      },
      {
        "id": "budget",
        "term": "@budget",
        "familiar": "a performance assertion.",
        "difference": "it is a numeric bound the compiler checks, such as zero allocations per call, counting the allocation that broke it.",
        "gloss": "A numeric bound the compiler checks, such as zero allocations per call."
      },
      {
        "id": "claim",
        "term": "claim",
        "familiar": "an architecture test, like ArchUnit's \"this package must not depend on that one\".",
        "difference": "it is a sentence about the whole program's structure, checked over every path, including the ones no test takes, and it compiles to no code.",
        "gloss": "An architecture rule, like \"billing never reaches research\", checked over every path in the program and compiled to no code."
      },
      {
        "id": "group",
        "term": "group",
        "familiar": "a named set of components that a rule talks about, such as <code>billing</code> or <code>plugins</code>.",
        "difference": "a misspelt member is an error, and an empty group is an error unless the rule says it may be empty.",
        "gloss": "A named set of components that a rule talks about."
      },
      {
        "id": "constitution",
        "term": "constitution",
        "familiar": "a shared rulebook.",
        "difference": "written once, adopted by many programs, and proven by each against its own structure. Composition only adds rules; it cannot weaken one.",
        "gloss": "A shared rulebook: claims written once, adopted by many programs, each proving them against its own structure."
      },
      {
        "id": "witness",
        "term": "witness, countermodel",
        "familiar": "a counterexample, or a failing test's trace.",
        "difference": "when a rule is false, the compiler returns the concrete path that breaks it, in your own names: the call, the publish, the subscriber.",
        "gloss": "A counterexample: the concrete path that breaks a rule, in your own names."
      },
      {
        "id": "hole",
        "term": "hole",
        "familiar": "\"unknown\".",
        "difference": "where the compiler could not see, such as a call through a function value, it records a hole and says so. A rule that reaches a hole reports uncertified, a different answer from false.",
        "gloss": "Where the compiler could not see, it records a hole and says so."
      },
      {
        "id": "artifact",
        "term": "topology artifact",
        "familiar": "a generated architecture diagram, or a bill of materials for structure.",
        "difference": "it is a byte-reproducible JSON file the compiler emits, with every component, topic, edge and rule verdict, so the architecture can be diffed in review and signed for deployment.",
        "gloss": "A machine-readable map of the program’s structure the compiler emits, diffable and signable."
      },
      {
        "id": "fleet",
        "term": "fleet, plan",
        "familiar": "several separately built services deployed together, described by a manifest.",
        "difference": "<code>hale fleet check</code> checks rules across the binaries using their artifacts, so two correct services wired into an incorrect deployment are caught before it runs.",
        "gloss": "Several separately built services deployed together, with rules checked across them."
      },
      {
        "id": "seed",
        "term": "seed",
        "familiar": "a package or crate: a unit of Hale source, a library or an application.",
        "difference": "a library's rules travel with it into every program that imports it.",
        "gloss": "A unit of Hale source: a library or an application, like a package."
      }
    ]
  },
  {
    "title": "The toolchain and the runtime",
    "entries": [
      {
        "id": "check",
        "term": "hale check, hale verify",
        "familiar": "the type checker and a stricter lint gate.",
        "difference": "<code>check</code> is the whole-project check that runs as you type; <code>verify</code> turns every advisory into a failure.",
        "gloss": "The whole-project check that runs as you type, and the stricter gate that turns advisories into failures."
      },
      {
        "id": "iris",
        "term": "Iris",
        "familiar": "an observability dashboard or a debugger for a running system.",
        "difference": "it reads the running program's components and messages against the same structure the compiler certified.",
        "gloss": "An observer for a running program, reading it against the structure the compiler certified."
      },
      {
        "id": "replay",
        "term": "record and replay",
        "familiar": "a flight recorder.",
        "difference": "the runtime delivers the messages, so it can record a concurrent run's inputs and schedule and replay them exactly, with no instrumentation in the application.",
        "gloss": "A flight recorder: a concurrent run’s inputs and schedule, replayed exactly, with no instrumentation in the application."
      },
      {
        "id": "pond",
        "term": "pond",
        "familiar": "a package index.",
        "difference": "packages are vendored by pinning a git ref; there is no central registry.",
        "gloss": "The contributed library collection, vendored by pinning a git ref."
      }
    ]
  },
  {
    "title": "DNA",
    "entries": [
      {
        "id": "organism",
        "term": "organism",
        "familiar": "an application together with its own delivery pipeline, operations, governance and audit log.",
        "difference": "all of that is one Hale program generated next to the code, and it changes itself only under review.",
        "gloss": "An application together with its own delivery pipeline, operations, governance and audit log, as one program next to the code."
      },
      {
        "id": "dna",
        "term": "DNA",
        "familiar": "the generator and command for the above: <code>hale dna</code>.",
        "difference": "the same parts in every organism, so what differs between two organisms is only what their projects wrote.",
        "gloss": "The generator and command for an organism: hale dna."
      },
      {
        "id": "board",
        "term": "the Board",
        "familiar": "the people with final say.",
        "difference": "their authority is a position in the record, and only they can widen what the automated roles may do.",
        "gloss": "The people with final say."
      },
      {
        "id": "leader",
        "term": "the Leader",
        "familiar": "a reviewer.",
        "difference": "an AI-backed role that may approve routine changes within limits the Board set, with its reasoning and cost on the record. It decides; it never commits.",
        "gloss": "An AI-backed reviewer that may approve routine changes within limits the Board set. It decides; it never commits."
      },
      {
        "id": "grant",
        "term": "grant",
        "familiar": "permissions.",
        "difference": "a grant is enforced by the compiler against the program's actual wiring: the editing role can read, edit, format and check and nothing more, and handing it a git handle fails the build.",
        "gloss": "Permissions, enforced by the compiler against the program’s actual wiring."
      },
      {
        "id": "record",
        "term": "the record, the journal",
        "familiar": "an audit log.",
        "difference": "it is kept as git commits on <code>refs/dna/journal</code>, one per event, in the repository the code lives in, so a clone carries the whole history.",
        "gloss": "The audit log, kept as git commits in the repository the code lives in."
      },
      {
        "id": "memory",
        "term": "memory",
        "familiar": "the organism's working state, in a Postgres database it owns under its own roles.",
        "difference": "",
        "gloss": "The organism’s working state, in a database it owns."
      },
      {
        "id": "nerves",
        "term": "nerves",
        "familiar": "messaging between the organism's parts, over NATS.",
        "difference": "",
        "gloss": "Messaging between the organism’s parts."
      },
      {
        "id": "senses",
        "term": "senses, reflexes",
        "familiar": "monitoring, with Prometheus, and the automatic responses to what it sees.",
        "difference": "",
        "gloss": "Monitoring, and the automatic responses to what it sees."
      },
      {
        "id": "skin",
        "term": "skin",
        "familiar": "secrets and access control: a vault, and a role per client on each backend.",
        "difference": "",
        "gloss": "Secrets and access control."
      },
      {
        "id": "spine",
        "term": "spine",
        "familiar": "the decision engine: tasks, reviews, grants and budgets.",
        "difference": "",
        "gloss": "The decision engine: tasks, reviews, grants and budgets."
      },
      {
        "id": "head",
        "term": "head, face",
        "familiar": "the API, and the web UI people use to reach it.",
        "difference": "",
        "gloss": "The API, and the web UI people use to reach it."
      },
      {
        "id": "legs",
        "term": "legs, hands, voice",
        "familiar": "the workers that carry out tasks, their tools, and their access to models.",
        "difference": "",
        "gloss": "The workers that carry out tasks."
      },
      {
        "id": "heart",
        "term": "heart, body",
        "familiar": "the application itself, and the machines it runs on.",
        "difference": "",
        "gloss": "The application itself, and the machines it runs on."
      },
      {
        "id": "expression",
        "term": "expression",
        "familiar": "deployment.",
        "difference": "an approved change is restarted locally or redeployed on every node the plan assigns, then watched, and rolled back everywhere if one instance fails.",
        "gloss": "Deployment: an approved change restarted locally or redeployed on every node, then watched."
      },
      {
        "id": "habitat",
        "term": "habitat",
        "familiar": "shared infrastructure: the records, access, identity and tools that several organisms and the people in them share.",
        "difference": "sharing is deliberate publication between isolated records. Designed, and partly built.",
        "gloss": "Shared infrastructure for several organisms: records, access, identity and tools. Designed, partly built."
      }
    ]
  }
];

// First-use matching, in priority order (longer phrases before the words
// inside them). A term with no pattern is listed on the page but never
// underlined in running text.
export const MATCH = [
  ["main", /\bmain locus\b/],
  ["locus", /\b(?:loci|locus)\b/],
  ["keyed", /\bkeyed topic\b/],
  ["topic", /\btopics?\b/],
  ["bus", /\bbus\b/],
  ["placement", /\bplacement\b/],
  ["bindings", /(?<!C |\) )\bbindings?\b/],
  ["params", /\bparams\b/],
  ["supervision", /\bsupervis(?:ion|ed)\b/],
  ["perspective", /\bperspectives?\b/],
  ["effect", /\beffect classes\b/],
  ["claim", /\bclaims?\b/],
  ["group", /\bgroups\b/],
  ["constitution", /\bconstitutions?\b/],
  ["witness", /\b(?:witness|countermodel)\b/],
  ["hole", /\ba hole\b/],
  ["artifact", /\btopology artifacts?\b/],
  ["fleet", /\bfleet\b/],
  ["seed", /\bseeds?\b/],
  ["quantity", /\bquantit(?:y|ies)\b/],
  ["surface", /\bAPI surfaces?\b/],
  ["serve", /\bexposures?\b/],
  ["altitude", /\baltitude\b/],
  ["scale", /\bsystem scale\b/],
  ["iris", /\bIris\b/],
  ["replay", /\brecord and replay\b/],
  ["pond", /\bpond\b/],
  ["organism", /\borganisms?\b/],
  ["board", /\bthe Board\b/],
  ["leader", /\bthe Leader\b/],
  ["grant", /\b(?:a|the|its) grant\b/],
  ["record", /\bthe record\b/],
  ["nerves", /\bthe nerves\b/],
  ["senses", /\bthe senses\b/],
  ["skin", /\bthe skin\b/],
  ["spine", /\bthe spine\b/],
  ["head", /\bthe head\b/],
  ["legs", /\bthe legs\b/],
  ["heart", /\bthe heart\b/],
  ["expression", /\bexpress(?:ed|ion)\b/],
  ["habitat", /\bhabitat\b/],
];
