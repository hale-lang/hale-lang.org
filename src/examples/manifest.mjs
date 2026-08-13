/*
  The examples page's single source of truth. Every panel's program,
  its deliberate break, and its links live here; the OUTPUTS — run
  stdout, break-it diagnostics, the replay session — are never
  written by hand. scripts/capture-examples.mjs produces them by
  invoking the compiler at build time (src/generated/examples.json),
  so a diagnostic on the page is one the shipped compiler actually
  printed. Hand-transcribed compiler output rots; generated output
  cannot.

  `brk` is a literal find/replace on the program — the page renders
  it as a diff, and the capture script asserts the broken form FAILS
  `hale check` and records what the compiler said. `pinned` is a
  machine-captured fallback, labeled with the commit that produced
  it, used only when the released compiler predates the feature.
*/

export const examples = [
  {
    "id": "queue",
    "eyebrow": "sharded job queue",
    "title": "Let the topic own the routing table.",
    "prose": "A keyed topic delivers each job only to the worker whose key it carries — the handler never sees the other shards. And the routing contract is typed: the break shows what happens when the payload stops carrying the field the topic shards on.",
    "file": "workers.hl",
    "program": "type Job { queue_id: Int; body: String; }\ntopic JobReady { payload: Job; keyed_by queue_id; }\n\nlocus Worker {\n    params { queue_id: Int = 0; done: Int = 0; }\n    bus { subscribe JobReady as perform where key == self.queue_id; }\n    fn perform(job: Job) {\n        self.done = self.done + 1;\n        println(\"worker \", self.queue_id, \" took \", job.body);\n    }\n}\n\nmain locus App {\n    params { a: Worker = Worker { queue_id: 1 }; b: Worker = Worker { queue_id: 2 }; }\n    bus { publish JobReady; }\n    run() {\n        JobReady <- Job { queue_id: 1, body: \"resize\" };\n        JobReady <- Job { queue_id: 2, body: \"transcode\" };\n        JobReady <- Job { queue_id: 1, body: \"thumbnail\" };\n    }\n}\nfn main() { App { }; }",
    "run": true,
    "brk": {
      "find": "type Job { queue_id: Int; body: String; }",
      "replace": "type Job { body: String; }",
      "note": "Drop the field the topic shards on."
    },
    "docs": {
      "href": "/docs/tutorial/job-queue",
      "label": "Read the job-queue tutorial"
    }
  },
  {
    "id": "causal",
    "eyebrow": "causal boundary",
    "title": "State what may influence a subsystem.",
    "prose": "The dependency set is checked transitively through the bus graph — a republisher cannot launder an undeclared source into this locus. Subscribe to one topic the declaration does not name, and the build stops.",
    "file": "risk-view.hl",
    "program": "type Snapshot { id: Int; }\ntype Config   { limit: Int; }\ntype Tick     { n: Int; }\n\ntopic RiskSnapshot { payload: Snapshot; }\ntopic RiskConfig   { payload: Config; }\ntopic Clock        { payload: Tick; }\n\n@effects(depends: {RiskSnapshot, RiskConfig})\nlocus RiskView {\n    params { seen: Int = 0; }\n    bus {\n        subscribe RiskSnapshot as update;\n        subscribe RiskConfig as configure;\n    }\n    fn update(s: Snapshot) { self.seen = self.seen + 1; }\n    fn configure(c: Config) { self.seen = self.seen + 1; }\n}\n\nmain locus App {\n    params { v: RiskView = RiskView { }; }\n    bus { publish RiskSnapshot; publish RiskConfig; publish Clock; }\n    run() { RiskSnapshot <- Snapshot { id: 1 }; }\n}\nfn main() { App { }; }",
    "run": false,
    "brk": {
      "find": "        subscribe RiskConfig as configure;",
      "replace": "        subscribe RiskConfig as configure;\n        subscribe Clock as tick;",
      "extraFind": "    fn configure(c: Config) { self.seen = self.seen + 1; }",
      "extraReplace": "    fn configure(c: Config) { self.seen = self.seen + 1; }\n    fn tick(t: Tick) { self.seen = self.seen + 1; }",
      "note": "Listen to the clock without declaring it."
    },
    "docs": {
      "href": "/docs/effects",
      "label": "Read effects and causality"
    }
  },
  {
    "id": "hot",
    "eyebrow": "certified hot path",
    "title": "Make the performance assumption reviewable.",
    "prose": "This path does not merely intend to avoid the kernel, waiting, and allocation — the compiler follows its callees and rejects the build when the promise stops being true, counting the exact allocation that broke it.",
    "file": "score.hl",
    "program": "type Sample { a: Float; b: Float; w: Float; }\n\n@no_block @no_syscall @deterministic\n@budget(alloc_per_call = 0)\nfn score(sample: Sample) -> Float {\n    return sample.a * sample.w + sample.b * (1.0 - sample.w);\n}\n\nfn main() {\n    let s = Sample { a: 0.9, b: 0.4, w: 0.75 };\n    println(\"score \", score(s));\n}",
    "run": true,
    "brk": {
      "find": "    return sample.a * sample.w + sample.b * (1.0 - sample.w);",
      "replace": "    let label = \"sample-\" + to_string(sample.w);\n    return sample.a * sample.w + sample.b * (1.0 - sample.w);",
      "note": "Build a label on the hot path."
    },
    "docs": {
      "href": "/docs/effects",
      "label": "Read effects and contracts"
    }
  },
  {
    "id": "sealed",
    "eyebrow": "confined secret",
    "title": "State what the rest of the program cannot reach.",
    "prose": "A sealed locus owns its params outright: everyone else holds a phone number, not the key. Reading the field from outside is not a convention violation — it fails the build, and the diagnostic names the method to call instead.",
    "file": "signer.hl",
    "program": "@sealed locus Signer {\n    params { key: Int = 7; }\n    @effects(is: {secret_use})\n    fn sign(msg: Int) -> Int { return msg * 31 + self.key; }\n}\n\nlocus Gateway {\n    params { s: Signer = Signer { }; }\n    fn tag(msg: Int) -> Int {\n        return self.s.sign(msg);\n    }\n}\n\nfn main() {\n    let g = Gateway { };\n    println(\"sig \", g.tag(41));\n}",
    "run": true,
    "brk": {
      "find": "        return self.s.sign(msg);",
      "replace": "        let direct = self.s.key;\n        return msg * 31 + direct;",
      "note": "Read the key instead of asking for a signature."
    },
    "docs": {
      "href": "/articles/secrets-in-hale",
      "label": "Read the secrets article"
    }
  },
  {
    "id": "claims",
    "eyebrow": "law with a witness",
    "title": "Write the rule; get the counterexample.",
    "prose": "The claim is two lines of law about the program itself. Wire a signer into the plugin host and the violation names the exact call chain that crosses the boundary — a counterexample, not a lint.",
    "file": "app.hl",
    "program": "@sealed locus Signer {\n    params { key: Int = 7; }\n    @effects(is: {secret_use})\n    fn sign(msg: Int) -> Int { return msg * 31 + self.key; }\n}\n\nlocus Gateway {\n    params { s: Signer = Signer { }; }\n    fn issue(msg: Int) -> Int { return self.s.sign(msg); }\n}\n\nlocus PluginHost {\n    params { n: Int = 0; }\n    fn render(x: Int) -> Int { return x + self.n; }\n}\n\ngroup plugins  = { PluginHost };\n\nmain locus App {\n    params { g: Gateway = Gateway { }; p: PluginHost = PluginHost { }; }\n    claims {\n        plugins_never_sign:\n            forbid reaches(plugins, effects(secret_use));\n    }\n    run() { let sig = self.g.issue(41); }\n}\nfn main() { App { }; }",
    "run": false,
    "brk": {
      "find": "locus PluginHost {\n    params { n: Int = 0; }\n    fn render(x: Int) -> Int { return x + self.n; }\n}",
      "replace": "locus PluginHost {\n    params { n: Int = 0; s: Signer = Signer { }; }\n    fn render(x: Int) -> Int { return self.s.sign(x); }\n}",
      "note": "Hand the plugin host a signer."
    },
    "docs": {
      "href": "/articles/claims-in-hale",
      "label": "Read the claims article"
    }
  },
  {
    "id": "replay",
    "eyebrow": "record & replay",
    "title": "The run becomes a file you can run again.",
    "prose": "Twenty readings of a random sensor, recorded — schedule and journaled inputs both. The replay serves the same random values back in the same per-consumer order and the comparison signs off. No logging calls, no instrumentation: the runtime is the thing delivering the messages.",
    "file": "sensor.hl",
    "program": "type Reading { v: Int; }\n\nlocus Aggregator {\n    params { total: Int = 0; count: Int = 0; }\n    bus { subscribe Sensor as ingest; }\n    fn ingest(r: Reading) {\n        self.total = self.total + r.v;\n        self.count = self.count + 1;\n    }\n}\n\ntopic Sensor { payload: Reading; }\n\nlocus Probe {\n    bus { publish Sensor; }\n    run() {\n        let mut i = 0;\n        while i < 20 {\n            Sensor <- Reading { v: std::rand::next_int(100) };\n            i = i + 1;\n        }\n    }\n}\n\nmain locus App {\n    params { a: Aggregator = Aggregator { }; p: Probe = Probe { }; }\n    placement { p: pinned(core = 0); }\n    run() { std::time::sleep(700ms); }\n}\nfn main() { App { }; }",
    "run": false,
    "session": {
      "steps": [
        "LOTUS_OBS_RECORD=session.halerec hale run sensor.hl",
        "hale replay session.halerec sensor.hl --allow-live-effects --diff"
      ]
    },
    "pinned": {
      "label": "captured against hale main@e7dbca5",
      "session": "hale replay: journal served fully — 0 divergences, 20 consumes\nreplay matches the recording: 20 consumes across 1 consumers; canonical payloads identical, raw ABI payload sizes matched (110 ring records, 20 journal reads)"
    },
    "docs": {
      "href": "/articles/record-and-replay-in-hale",
      "label": "Read the record & replay article"
    }
  }
];
