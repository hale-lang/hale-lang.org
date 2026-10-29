// Literate full example — see sensor-pipeline.mjs for the contract.
// Each component and the fleet live in separate seeds.
export const full = {
  "slug": "fleet",
  "files": [
    "shared/topics.hl",
    "intake/main.hl",
    "worker/main.hl",
    "fleet/main.hl"
  ],
  "file": "intake/main.hl",
  "title": "Two binaries, one law",
  "tagline": "Separate builds sharing a topic over a socket, composed and checked as a fleet. Drift in either binary fails verification.",
  "intro": "A small fleet: an intake binary and a worker binary share one topic over a Unix socket. A fleet locus names both instances, binds their shared topic, and states a claim across the pair. Save each file under the path shown below, then run `hale fleet check fleet/main.hl`. The compiler derives each component artifact and checks the composition.",
  "sections": [
    {
      "id": "shared",
      "file": "shared/topics.hl",
      "code": "type Task { kind: Int; body: String; }\ntopic Work { payload: Task; subject: \"demo.work\"; }",
      "prose": "The shared seed names the payload and its wire subject. Both binaries and the fleet import this declaration, so the route has the same identity at every boundary."
    },
    {
      "id": "intake",
      "file": "intake/main.hl",
      "code": "import \"../shared\" as t;\n\nlocus Intake {\n    params { queued: Int = 0; }\n    bus { publish t::Work; }\n    run() {\n        let mut i = 0;\n        while i < 3 {\n            t::Work <- t::Task { kind: i % 2, body: \"job\" };\n            self.queued = self.queued + 1;\n            i = i + 1;\n        }\n        println(\"intake queued \", self.queued);\n    }\n}\n\nmain locus IntakeApp {\n    params { in_: Intake = Intake { }; }\n    bindings { t::Work: unix(\"/tmp/hale-fleet-demo.sock\", role: connect); }\n    run() { }\n}\nfn main() { IntakeApp { }; }",
      "prose": "The first binary: an intake that queues three tasks onto `Work` and connects the topic to a Unix socket. Its whole contract with the outside world is the topic declaration and the binding."
    },
    {
      "id": "worker",
      "file": "worker/main.hl",
      "code": "import \"../shared\" as t;\n\n@supervised locus Executor {\n    params { done: Int = 0; }\n    bus { subscribe t::Work as perform; }\n    fn perform(t: t::Task) {\n        self.done = self.done + 1;\n        println(\"executor did \", t.body, \" kind \", t.kind);\n    }\n}\n\nmain locus WorkerApp {\n    params { ex: Executor = Executor { }; }\n    bindings { t::Work: unix(\"/tmp/hale-fleet-demo.sock\", role: listen); }\n    on_failure(e: Executor, err: ClosureViolation) { restart(e); }\n    run() { }\n}\nfn main() { WorkerApp { }; }",
      "prose": "The second binary: a supervised executor listening on the same socket. The two programs share only the `Work` payload shape and the wire, with separate builds, separate processes and separate failures."
    },
    {
      "id": "fleet",
      "file": "fleet/main.hl",
      "code": "import \"../intake\" as intake;\nimport \"../worker\" as worker;\nimport \"../shared\" as t;\n\nfleet locus Demo {\n    params {\n        producer: intake::IntakeApp;\n        executor: worker::WorkerApp;\n    }\n    bindings {\n        t::Work: unix(\"/tmp/hale-fleet-demo.sock\");\n    }\n    claims {\n        every_task_has_a_worker: require subscribes(some executor, topic t::Work);\n    }\n}",
      "prose": "The fleet locus names the deployed instances, binds the topic across them, and requires a subscribed executor. `hale fleet check` derives the component artifacts and route from these seeds, then checks the fleet claim. The fleet itself never runs.",
      "captures": [
        {
          "kind": "fleet"
        }
      ]
    },
    {
      "id": "drift",
      "prose": "Remove the worker subscription. The worker still typechecks on its own, but fleet verification rejects the binding because no instance receives the topic:",
      "captures": [
        {
          "kind": "fleet-break",
          "file": "worker/main.hl",
          "find": "    bus { subscribe t::Work as perform; }",
          "replace": "    bus { }",
          "note": "A worker build that quietly stopped listening."
        }
      ]
    }
  ],
  "fleetFile": "fleet/main.hl"
};
