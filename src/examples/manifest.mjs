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
    "id": "convert",
    "tier": "everyday",
    "eyebrow": "cli converter",
    "title": "A tool is a binary with arguments.",
    "prose": "Read a positional argument with a default, parse it with the error addressed on the same line, print the answer. `hale build` turns it into one static executable — no interpreter, no packaging step. The break shows the fallback typing: a default that could not stand in for the parse result is refused.",
    "file": "convert.hl",
    "program": "fn main() {\n    let raw = std::env::arg_or(1, \"100\");\n    let celsius = std::str::parse_int(raw) or 0;\n    let fahrenheit = celsius * 9 / 5 + 32;\n    println(raw, \"°C = \", fahrenheit, \"°F\");\n}",
    "run": true,
    "brk": {
      "find": "std::str::parse_int(raw) or 0",
      "replace": "std::str::parse_int(raw) or \"0\"",
      "note": "Default with the wrong type."
    },
    "docs": {
      "href": "/docs/everyday/cli-config",
      "label": "Read CLI arguments & config"
    }
  },
  {
    "id": "orders-json",
    "tier": "everyday",
    "eyebrow": "json in, json out",
    "title": "Parse into a type, not a tree.",
    "prose": "The `json:` tags on the type are the whole codec: `from_json` walks the document once into a typed value, and `to_json` writes it back. A missing field is an error with a name, not a null that surfaces three calls later — and the parse is fallible, so skipping the handler is a compile error, not a runtime surprise.",
    "file": "orders.hl",
    "program": "type Order {\n    id: Int          `json:\"id\"`;\n    price: Int       `json:\"px\"`;\n    currency: String = \"USD\";\n}\n\nfn main() {\n    let body = \"{\\\"id\\\": 7, \\\"px\\\": 1899}\";\n    let o = Order::from_json(body) or { println(\"bad order: \", err.field); return; };\n    let marked = Order { id: o.id, price: o.price * 105 / 100, currency: o.currency };\n    println(Order::to_json(marked));\n}",
    "run": true,
    "brk": {
      "find": "Order::from_json(body) or { println(\"bad order: \", err.field); return; }",
      "replace": "Order::from_json(body)",
      "note": "Skip the error the parse can raise."
    },
    "docs": {
      "href": "/docs/everyday/json",
      "label": "Read JSON without a schema language"
    }
  },
  {
    "id": "logsum",
    "tier": "everyday",
    "eyebrow": "files & directories",
    "title": "Walk a directory, count what matters.",
    "prose": "Write, list, read, and summarize — the one-shot `std::io::fs` calls, each fallible and each addressed where it happens. Inside a `fallible` helper an unhandled error propagates to the caller; at `main` the buck stops, and the break shows the compiler refusing to let it ride.",
    "file": "logsum.hl",
    "program": "@form(vec)\nlocus Names { capacity { heap items of String; } }\n@form(vec)\nlocus Lines { capacity { heap items of String; } }\n\nfn count_errors(text: String) -> Int {\n    let lines = Lines { };\n    std::str::split_into(text, \"\\n\", lines);\n    let mut errors = 0;\n    for line in lines.items {\n        if std::str::starts_with(line, \"ERROR\") { errors += 1; }\n    }\n    return errors;\n}\n\nfn summarize() fallible(IoError) {\n    std::io::fs::mkdir(\"logs\") or discard;\n    std::io::fs::write_file(\"logs/api.log\", \"ok\\nERROR timeout\\nok\\n\") or raise;\n    std::io::fs::write_file(\"logs/db.log\", \"ERROR lock\\nERROR retry\\n\") or raise;\n\n    let found = Names { };\n    let count = std::io::fs::list_dir_count(\"logs\") or raise;\n    let mut i = 0;\n    while i < count {\n        found.push(std::io::fs::list_dir_at(\"logs\", i) or raise);\n        i += 1;\n    }\n    let names = Names { };\n    found.sort_into(names);\n\n    for name in names.items {\n        let text = std::io::fs::read_file(\"logs/\" + name) or \"\";\n        println(name, \": \", count_errors(text), \" error(s)\");\n    }\n}\n\nfn main() {\n    summarize() or { println(\"io error\"); };\n}",
    "run": true,
    "brk": {
      "find": "summarize() or { println(\"io error\"); };",
      "replace": "summarize();",
      "note": "Let the helper's errors ride past main."
    },
    "docs": {
      "href": "/docs/everyday/files",
      "label": "Read files & the filesystem"
    }
  },
  {
    "id": "fetch",
    "tier": "everyday",
    "eyebrow": "http client",
    "title": "One call, one response, errors in the type.",
    "prose": "`std::http::get` returns a response or an error with a kind — connection refused and a bad URL are different values, not different string prefixes. The or-block is the entire error story; drop it and the build stops. Not captured at build time only because CI has no network.",
    "file": "fetch.hl",
    "program": "fn main() {\n    let url = std::env::arg_or(1, \"https://hale-lang.org/llms.txt\");\n    let resp = std::http::get(url) or {\n        println(\"fetch failed: \", err.kind);\n        return;\n    };\n    let body = std::str::from_bytes(resp.body);\n    println(\"status \", resp.status, \", \", len(body), \" bytes\");\n}",
    "run": false,
    "brk": {
      "find": "std::http::get(url) or {\n        println(\"fetch failed: \", err.kind);\n        return;\n    }",
      "replace": "std::http::get(url)",
      "note": "Leave the network error unaddressed."
    },
    "docs": {
      "href": "/docs/everyday/http",
      "label": "Read HTTP clients & servers"
    }
  },
  {
    "id": "configured",
    "tier": "everyday",
    "eyebrow": "layered config",
    "title": "Argument beats environment beats default.",
    "prose": "One resolver states the precedence — positional argument, then `$APP_HOST`, then the built-in — and an app locus receives the result as typed params. Params are a contract, not a bag: constructing one that the locus never declared is the break, and the diagnostic names the field.",
    "file": "configured.hl",
    "program": "locus App {\n    params { host: String = \"0.0.0.0\"; port: Int = 8080; }\n\n    run() {\n        println(\"listening on \", self.host, \":\", self.port);\n    }\n}\n\nfn main() {\n    let cfg = std::cli::Resolver {\n        env_prefix: \"APP_\",\n        argv_keys: \"host\\nport\\n\",\n    };\n    App {\n        host: cfg.get(\"host\", \"0.0.0.0\"),\n        port: cfg.get_int(\"port\", 8080),\n    };\n}",
    "run": true,
    "brk": {
      "find": "host: cfg.get(\"host\", \"0.0.0.0\"),",
      "replace": "hostname: cfg.get(\"host\", \"0.0.0.0\"),",
      "note": "Configure a param that doesn't exist."
    },
    "docs": {
      "href": "/docs/everyday/cli-config",
      "label": "Read CLI arguments & config"
    }
  },
  {
    "id": "wasm-counter",
    "tier": "everyday",
    "eyebrow": "webassembly",
    "title": "The same locus, compiled for the browser.",
    "prose": "`target wasm { }` is a declaration the typechecker enforces: the portable stdlib and the typed bus work as they do natively, and the syscall-backed namespaces are refused at compile time — the break reaches for `std::http` inside the sandbox and is told exactly why not. `@export` methods become the module's exports; the page drives them.",
    "file": "counter.hl",
    "program": "target wasm { }\n\n@ffi(\"js\") fn console_log(msg: String);\n\n@export locus Counter {\n    params { clicks: Int = 0; }\n\n    birth() { console_log(\"counter ready\"); }\n\n    fn bump() {\n        self.clicks += 1;\n        console_log(\"clicks: \" + to_string(self.clicks));\n    }\n}",
    "run": false,
    "brk": {
      "find": "birth() { console_log(\"counter ready\"); }",
      "replace": "birth() {\n        console_log(\"counter ready\");\n        let r = std::http::get(\"https://example.com/config\") or { return; };\n    }",
      "note": "Reach for sockets inside the sandbox."
    },
    "docs": {
      "href": "/docs/systems/webassembly",
      "label": "Read WebAssembly & the browser"
    },
    "play": {
      "href": "https://play.hale-lang.org/",
      "label": "Run Hale in the playground"
    }
  },
  {
    "id": "queue",
    "tier": "systems",
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
    "tier": "systems",
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
    "tier": "systems",
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
    "tier": "systems",
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
    "tier": "systems",
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
    "tier": "systems",
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
