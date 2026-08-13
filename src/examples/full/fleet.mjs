// Literate full example — see sensor-pipeline.mjs for the contract.
// Multi-file: sections carry `file`; capture assembles a seed dir.
export const full = {
  "slug": "fleet",
  "files": [
    "intake.hl",
    "worker.hl",
    "plan.json"
  ],
  "file": "intake.hl",
  "title": "Two binaries, one law",
  "tagline": "Separate builds sharing a topic over a socket, composed and checked as a fleet — drift in either binary fails the plan.",
  "intro": "The smallest honest fleet: an intake binary and a worker binary that share one topic over a unix socket, plus the plan that names both instances, routes the topic between them, and states a claim across the pair. Each binary's build emits a topology artifact; `hale fleet check` composes the artifacts and verifies the plan against what the binaries actually are — not what a diagram says they are.",
  "sections": [
    {
      "id": "intake",
      "file": "intake.hl",
      "code": "type Task { kind: Int; body: String; }\ntopic Work { payload: Task; }\n\nlocus Intake {\n    params { queued: Int = 0; }\n    bus { publish Work; }\n    run() {\n        let mut i = 0;\n        while i < 3 {\n            Work <- Task { kind: i % 2, body: \"job\" };\n            self.queued = self.queued + 1;\n            i = i + 1;\n        }\n        println(\"intake queued \", self.queued);\n    }\n}\n\nmain locus IntakeApp {\n    params { in_: Intake = Intake { }; }\n    bindings { Work: unix(\"/tmp/hale-fleet-demo.sock\", role: connect); }\n    run() { }\n}\nfn main() { IntakeApp { }; }",
      "prose": "The first binary: an intake that queues three tasks onto `Work` and connects the topic to a unix socket. Its whole contract with the outside world is the topic declaration and the binding."
    },
    {
      "id": "worker",
      "file": "worker.hl",
      "code": "type Task { kind: Int; body: String; }\ntopic Work { payload: Task; }\n\n@supervised locus Executor {\n    params { done: Int = 0; }\n    bus { subscribe Work as perform; }\n    fn perform(t: Task) {\n        self.done = self.done + 1;\n        println(\"executor did \", t.body, \" kind \", t.kind);\n    }\n}\n\nmain locus WorkerApp {\n    params { ex: Executor = Executor { }; }\n    bindings { Work: unix(\"/tmp/hale-fleet-demo.sock\", role: listen); }\n    on_failure(e: Executor, err: ClosureViolation) { restart (e); }\n    run() { }\n}\nfn main() { WorkerApp { }; }",
      "prose": "The second binary: a supervised executor listening on the same socket. The two programs share nothing but the `Work` payload shape and the wire — separate builds, separate processes, separate failures."
    },
    {
      "id": "plan",
      "file": "plan.json",
      "code": "{\n  \"schema\": \"1.1\",\n  \"name\": \"demo\",\n  \"instances\": [\n    {\n      \"id\": \"intake-0\",\n      \"artifact\": \"intake.topology.json\"\n    },\n    {\n      \"id\": \"worker-0\",\n      \"artifact\": \"worker.topology.json\"\n    }\n  ],\n  \"routes\": [\n    {\n      \"id\": \"work\",\n      \"publishers\": [\n        {\n          \"instance\": \"intake-0\",\n          \"topic\": \"Work\"\n        }\n      ],\n      \"subscribers\": [\n        {\n          \"instance\": \"worker-0\",\n          \"topic\": \"Work\"\n        }\n      ],\n      \"transport\": \"unix:///tmp/hale-fleet-demo.sock\"\n    }\n  ],\n  \"groups\": {\n    \"executors\": {\n      \"instances\": [\n        \"worker-0\"\n      ]\n    }\n  },\n  \"claims\": [\n    {\n      \"name\": \"every_task_has_a_worker\",\n      \"require_subscribes\": {\n        \"group\": \"executors\",\n        \"subject\": \"Work\"\n      }\n    }\n  ]\n}",
      "lang": "json",
      "prose": "The fleet plan is deployment describing itself: exact instances, each pointing at the topology artifact its build produced, the route that connects them, and a fleet-level claim — every task must have a subscribed executor. `hale fleet check` composes the real artifacts and holds the plan to them:",
      "captures": [
        {
          "kind": "fleet"
        }
      ]
    },
    {
      "id": "drift",
      "prose": "Now the reason this layer exists. Ship a worker build whose executor stopped subscribing — the binary still typechecks, both artifacts are individually valid, and only the composition can see the hole:",
      "captures": [
        {
          "kind": "fleet-break",
          "file": "worker.hl",
          "find": "    bus { subscribe Work as perform; }",
          "replace": "    bus { }",
          "note": "A worker build that quietly stopped listening."
        }
      ]
    }
  ]
};
