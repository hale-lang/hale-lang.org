// Literate full example — see sensor-pipeline.mjs for the contract.
export const full = {
  "slug": "chat-server",
  "file": "chat.hl",
  "title": "A chat server that runs itself",
  "tagline": "Rooms as keyed topics, a sealed session signer, supervision that recovers on the page, and a rule about who may sign.",
  "intro": "A complete chat server in one file: two rooms as shards of a keyed topic, a sealed signer stamping every relayed line, a spam guard built wrong on purpose so supervision repairs it mid-transcript, and three scripted participants so the whole thing runs itself. The claim at its centre says guests reach the signer only through rooms. The first draft of this page got that claim wrong, and the compiler corrected it.",
  "sections": [
    {
      "id": "types",
      "code": "type ChatLine { room: Int; who: String; text: String; }\ntype Join     { room: Int; who: String; }\n\ntopic RoomTalk { payload: ChatLine; keyed_by room; }\ntopic Joins    { payload: Join; }",
      "prose": "A room is a shard of a keyed topic. `RoomTalk` shards by `room`, so delivering to the right room is the bus's job, and a room never sees another room's traffic. No room keeps a member list."
    },
    {
      "id": "signer",
      "code": "@sealed locus SessionSigner {\n    params { key: Int = 40961; }\n    @effects(is: {secret_use})\n    fn stamp(room: Int) -> Int { return room * 31 + self.key % 997; }\n}",
      "prose": "Session tags come from a sealed signer. `@sealed` makes the key readable only from inside the locus's own methods, so the rest of the program can ask for a signature and never holds the key. `secret_use` marks the one privileged operation for the rule written below."
    },
    {
      "id": "room",
      "code": "locus Room {\n    params { room: Int = 0; lines: Int = 0; s: SessionSigner = SessionSigner { }; }\n    bus {\n        subscribe RoomTalk as post where key == self.room;\n    }\n    fn post(line: ChatLine) {\n        self.lines = self.lines + 1;\n        let tag = self.s.stamp(line.room);\n        println(\"[room \", line.room, \" #\", tag, \"] \", line.who, \": \", line.text);\n    }\n}",
      "prose": "A room subscribes to its own shard and stamps every line it relays. The room calls `stamp` on the guest's behalf, and that mediation is about to become law."
    },
    {
      "id": "guard",
      "code": "locus SpamGuard {\n    params { warmups: Int = 0; }\n    closure warmed_up {\n        self.warmups ~~ 1 within 0;\n        epoch birth;\n    }\n    birth() {\n        self.warmups = self.warmups + 1;\n        println(\"~ spam guard warm (attempt \", self.warmups, \")\");\n    }\n}",
      "prose": "The spam guard is here to show supervision working. Its closure demands one warmup, and the assembly below constructs it wrong on purpose. The transcript shows the closure failing, the parent's `on_failure` firing, `restart` re-running birth, and the closure passing. Recovery is written in the program text, where an ops runbook would usually hold it."
    },
    {
      "id": "door",
      "code": "locus Doorman {\n    params { seen: Int = 0; }\n    bus { subscribe Joins as greet; }\n    fn greet(j: Join) {\n        self.seen = self.seen + 1;\n        println(\"* \", j.who, \" joined room \", j.room);\n    }\n}",
      "prose": "The doorman greets joins on an ordinary unkeyed topic. Not everything needs a shard."
    },
    {
      "id": "participant",
      "code": "locus Participant {\n    params { name: String = \"guest\"; room: Int = 0; }\n    bus { publish RoomTalk; publish Joins; }\n    run() {\n        Joins <- Join { room: self.room, who: self.name };\n        RoomTalk <- ChatLine { room: self.room, who: self.name, text: \"hello\" };\n        RoomTalk <- ChatLine { room: self.room, who: self.name, text: \"anyone here?\" };\n    }\n}",
      "prose": "Participants are scripted so this page can run itself: join, say hello, ask the eternal question. A deployed chat server would put them behind a transport binding, and nothing else on this page would change."
    },
    {
      "id": "groups",
      "code": "group participants = { Participant };\ngroup rooms        = { Room };",
      "prose": "Two one-line groups, because the rule below quantifies over them, and over every participant and room anyone adds later."
    },
    {
      "id": "mainlocus",
      "code": "main locus ChatServer {\n    params {\n        lobby: Room = Room { room: 0 };\n        dev: Room = Room { room: 1 };\n        door: Doorman = Doorman { };\n        guard: SpamGuard = SpamGuard { warmups: -1 };\n        ada: Participant = Participant { name: \"ada\", room: 0 };\n        lin: Participant = Participant { name: \"lin\", room: 1 };\n        alan: Participant = Participant { name: \"alan\", room: 0 };\n    }\n    on_failure(g: SpamGuard, err: ClosureViolation) {\n        println(\"! \", err.closure, \" failed on \", err.locus, \" — restarting\");\n        restart (g);\n    }\n    claims {\n        guests_sign_only_via_rooms:\n            forbid reaches(participants, effects(secret_use))\n                avoiding rooms;\n    }\n    run() { }\n}\nfn main() { ChatServer { }; }",
      "prose": "The claim says guests may reach the signer only through rooms. The first draft said `forbid reaches(participants, effects(secret_use))` outright, and the compiler rejected the design with the witness `Participant::run -(publishes \"RoomTalk\")-> Room::post -> SessionSigner::stamp`. Guests do reach the signer, through the room, because the room stamps on their behalf. `avoiding rooms` states the real rule, which is mediation. Hand a participant its own signer and the claim catches the bypass:",
      "brk": {
        "find": "locus Participant {\n    params { name: String = \"guest\"; room: Int = 0; }",
        "replace": "locus Participant {\n    params { name: String = \"guest\"; room: Int = 0; s: SessionSigner = SessionSigner { }; }",
        "note": "Give a guest a signer of its own — and let it stamp.",
        "extraFind": "        Joins <- Join { room: self.room, who: self.name };",
        "extraReplace": "        let forged = self.s.stamp(self.room);\n        Joins <- Join { room: self.room, who: self.name };"
      },
      "captures": [
        {
          "kind": "run",
          "label": "The whole session, including the supervised recovery."
        }
      ]
    }
  ]
};
