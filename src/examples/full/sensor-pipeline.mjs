// Literate full example. Sections' `code` fields concatenate
// ('\n\n'-joined) to the EXACT program the capture script
// checks, runs, breaks, records, and replays — drift between
// the page and a working program fails the build.
export const full = {
  "slug": "sensor-pipeline",
  "file": "pipeline.hl",
  "title": "A sharded sensor pipeline",
  "tagline": "Keyed fan-out, placement, a certified hot path, a causal boundary, and the whole run recorded and replayed.",
  "intro": "One complete program, top to bottom: a pinned probe feeds forty random sensor frames through keyed shard workers on a cooperative pool, into an aggregator behind a declared causal boundary, out to an alert sink. Ninety lines. The build that renders this page enforces every guarantee on it: the diagnostics are captured from the compiler, and the code sections below concatenate to the exact program that was checked, run, recorded and replayed.",
  "sections": [
    {
      "id": "types",
      "code": "type RawFrame { shard: Int; seq: Int; sample: Int; }\ntype Metric   { shard: Int; value: Int; }\ntype Alert    { shard: Int; value: Int; }\n\ntopic Frames  { payload: RawFrame; keyed_by shard; }\ntopic Metrics { payload: Metric; }\ntopic Alerts  { payload: Alert; }",
      "prose": "Three record types and three topics are the whole vocabulary. `Frames` is keyed by `shard`, so the routing table lives on the topic and the handlers carry none of it. Everything downstream is typed against these payloads, and nothing in the program deserializes and hopes."
    },
    {
      "id": "decode",
      "code": "@no_syscall @deterministic\n@budget(alloc_per_call = 0)\nfn decode(f: RawFrame) -> Int {\n    return f.sample * 3 + f.seq % 7;\n}",
      "prose": "The decode step is the hot path, so it says so. These annotations are contracts the compiler checks: it follows every callee and rejects the build if the function ever reaches a syscall, nondeterminism or an allocation. Add one string concatenation and see.",
      "brk": {
        "find": "    return f.sample * 3 + f.seq % 7;",
        "replace": "    let tag = \"frame-\" + to_string(f.seq);\n    return f.sample * 3 + f.seq % 7;",
        "note": "Build a label on the hot path."
      }
    },
    {
      "id": "worker",
      "code": "locus ShardWorker {\n    params { shard: Int = 0; handled: Int = 0; }\n    bus {\n        subscribe Frames as ingest where key == self.shard;\n        publish Metrics;\n    }\n    fn ingest(f: RawFrame) {\n        self.handled = self.handled + 1;\n        Metrics <- Metric { shard: f.shard, value: decode(f) };\n    }\n}",
      "prose": "Each worker subscribes to its own shard with `where key == self.shard`, so the fan-out is declarative and a worker never sees another shard's frames. Both workers are placed on one cooperative pool below, which makes the pair a single consumer: one thread, deterministic order, no locks."
    },
    {
      "id": "aggregator",
      "code": "@effects(depends: {Metrics, Frames})\nlocus Aggregator {\n    params { peak: Int = 0; count: Int = 0; }\n    bus {\n        subscribe Metrics as fold;\n        publish Alerts;\n    }\n    fn fold(m: Metric) {\n        self.count = self.count + 1;\n        if m.value > self.peak {\n            self.peak = m.value;\n            if m.value > 250 {\n                Alerts <- Alert { shard: m.shard, value: m.value };\n            }\n        }\n    }\n}",
      "prose": "The aggregator declares what may influence it. The set is transitive through the bus graph, and the compiler holds it to that: the first draft of this page declared only `{Metrics}`, and the build failed with the path `Frames -> ShardWorker -> Metrics -> Aggregator`. The workers carry frame data into metrics, so `Frames` is a real dependency whether the declaration says so or not. Try hiding it again:",
      "brk": {
        "find": "@effects(depends: {Metrics, Frames})",
        "replace": "@effects(depends: {Metrics})",
        "note": "Declare less than the truth."
      }
    },
    {
      "id": "sink",
      "code": "locus AlertSink {\n    params { fired: Int = 0; }\n    bus { subscribe Alerts as raise_alarm; }\n    fn raise_alarm(a: Alert) {\n        self.fired = self.fired + 1;\n        println(\"ALERT shard \", a.shard, \" value \", a.value);\n    }\n}",
      "prose": "The sink is deliberately plain: subscribe, count, print. It runs on the main scheduler, and its one producer is the aggregator, so its output order is the aggregator's fold order."
    },
    {
      "id": "probe",
      "code": "locus Probe {\n    bus { publish Frames; }\n    run() {\n        let mut seq = 0;\n        while seq < 40 {\n            let sample = std::rand::next_int(100);\n            Frames <- RawFrame { shard: seq % 2, seq: seq, sample: sample };\n            seq = seq + 1;\n        }\n    }\n}",
      "prose": "The probe is pinned to its own OS thread and publishes forty frames with random samples. The randomness is the point: every live run differs, which is what the closing step needs."
    },
    {
      "id": "mainlocus",
      "code": "main locus Pipeline {\n    params {\n        w0: ShardWorker = ShardWorker { shard: 0 };\n        w1: ShardWorker = ShardWorker { shard: 1 };\n        agg: Aggregator = Aggregator { };\n        sink: AlertSink = AlertSink { };\n        probe: Probe = Probe { };\n    }\n    placement {\n        probe: pinned(core = 0);\n        w0: cooperative(pool = shards);\n        w1: cooperative(pool = shards);\n    }\n    run() { std::time::sleep(900ms); }\n}\nfn main() { Pipeline { }; }",
      "prose": "Assembly is declarative. The tree owns the loci, `placement` puts the probe on core 0 and both workers on one pool, and `run` keeps the process alive while the messages drain. The program constructs no channels, spawns no threads by hand and writes no shutdown sequence; dissolve order is the ownership tree.",
      "captures": [
        {
          "kind": "run",
          "label": "Two runs. The random samples differ, so the alerts differ.",
          "runs": 2
        }
      ]
    },
    {
      "id": "replay-closer",
      "prose": "Two live runs of this program never match, because the probe reads real entropy. Record one, and the runtime journals every random read and every consumer's delivery order beneath the application. Replay serves the same values back in the same order, and the comparison signs off: the run became a file, and the file runs again.",
      "captures": [
        {
          "kind": "session",
          "steps": [
            "LOTUS_OBS_RECORD=pipeline.halerec hale run pipeline.hl",
            "hale replay pipeline.halerec pipeline.hl --allow-live-effects --diff"
          ],
          "pinned": {
            "label": "captured against hale main@e7dbca5",
            "output": "hale replay: journal served fully — 0 divergences, 81 consumes\nreplay matches the recording: 81 consumes across 2 consumers; canonical payloads identical, raw ABI payload sizes matched (382 ring records, 40 journal reads)"
          }
        }
      ]
    }
  ]
};
