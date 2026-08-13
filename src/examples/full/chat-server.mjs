// Literate full example — see sensor-pipeline.mjs for the contract.
export const full = {
  "slug": "chat-server",
  "file": "chat.hl",
  "title": "A chat server that runs itself",
  "tagline": "Rooms as keyed topics, a sealed session signer, supervision that recovers on the page, and a law about who may sign.",
  "intro": "A complete chat server in one file: two rooms as shards of a keyed topic, a sealed signer stamping every relayed line, a deliberately mis-constructed spam guard that supervision repairs mid-transcript, and three scripted participants so the whole thing runs itself. The centerpiece is the claim — guests reach the signer only through rooms — which this page's own first draft got wrong, and the compiler corrected.",
  "sections": [
    {
      "id": "types",
      "code": "type ChatLine { room: Int; who: String; text: String; }\ntype Join     { room: Int; who: String; }\n\ntopic RoomTalk { payload: ChatLine; keyed_by room; }\ntopic Joins    { payload: Join; }",
      "prose": "Rooms are not objects with member lists — they are a keyed topic. `RoomTalk` shards by `room`, so delivery to the right room is the bus's job, and a room never sees another room's traffic."
    },
    {
      "id": "signer",
      "code": "@sealed locus SessionSigner {\n    params { key: Int = 40961; }\n    @effects(is: {secret_use})\n    fn stamp(room: Int) -> Int { return room * 31 + self.key % 997; }\n}",
      "prose": "Session tags come from a sealed signer. `@sealed` means the key is readable only from inside the locus's own methods — the rest of the program holds a phone number, not the key — and `secret_use` marks the one privileged operation for the law written below."
    },
    {
      "id": "room",
      "code": "locus Room {\n    params { room: Int = 0; lines: Int = 0; s: SessionSigner = SessionSigner { }; }\n    bus {\n        subscribe RoomTalk as post where key == self.room;\n    }\n    fn post(line: ChatLine) {\n        self.lines = self.lines + 1;\n        let tag = self.s.stamp(line.room);\n        println(\"[room \", line.room, \" #\", tag, \"] \", line.who, \": \", line.text);\n    }\n}",
      "prose": "A room subscribes to its own shard and stamps every line it relays. Note who calls `stamp`: the room, on the guest's behalf. That mediation is about to become law."
    },
    {
      "id": "guard",
      "code": "locus SpamGuard {\n    params { warmups: Int = 0; }\n    closure warmed_up {\n        self.warmups ~~ 1 within 0;\n        epoch birth;\n    }\n    birth() {\n        self.warmups = self.warmups + 1;\n        println(\"~ spam guard warm (attempt \", self.warmups, \")\");\n    }\n}",
      "prose": "The spam guard exists to show supervision working, not to be clever: its closure demands one warmup, and the assembly below constructs it wrong on purpose. Watch the transcript — the closure fails, the parent's `on_failure` fires, `restart` re-runs birth, the closure passes. Recovery is part of the program text, not an ops runbook."
    },
    {
      "id": "door",
      "code": "locus Doorman {\n    params { seen: Int = 0; }\n    bus { subscribe Joins as greet; }\n    fn greet(j: Join) {\n        self.seen = self.seen + 1;\n        println(\"* \", j.who, \" joined room \", j.room);\n    }\n}",
      "prose": "The doorman greets joins on an ordinary unkeyed topic — not everything needs a shard."
    },
    {
      "id": "participant",
      "code": "locus Participant {\n    params { name: String = \"guest\"; room: Int = 0; }\n    bus { publish RoomTalk; publish Joins; }\n    run() {\n        Joins <- Join { room: self.room, who: self.name };\n        RoomTalk <- ChatLine { room: self.room, who: self.name, text: \"hello\" };\n        RoomTalk <- ChatLine { room: self.room, who: self.name, text: \"anyone here?\" };\n    }\n}",
      "prose": "Participants are scripted so this page can run itself: join, say hello, ask the eternal question. In a deployed chat server these would sit behind a transport binding; nothing else on this page would change."
    },
    {
      "id": "groups",
      "code": "group participants = { Participant };\ngroup rooms        = { Room };",
      "prose": "Two one-line groups, because the law below quantifies over them — and over every participant and room anyone adds later."
    },
    {
      "id": "mainlocus",
      "code": "main locus ChatServer {\n    params {\n        lobby: Room = Room { room: 0 };\n        dev: Room = Room { room: 1 };\n        door: Doorman = Doorman { };\n        guard: SpamGuard = SpamGuard { warmups: -1 };\n        ada: Participant = Participant { name: \"ada\", room: 0 };\n        lin: Participant = Participant { name: \"lin\", room: 1 };\n        alan: Participant = Participant { name: \"alan\", room: 0 };\n    }\n    on_failure(g: SpamGuard, err: ClosureViolation) {\n        println(\"! \", err.closure, \" failed on \", err.locus, \" — restarting\");\n        restart (g);\n    }\n    claims {\n        guests_sign_only_via_rooms:\n            forbid reaches(participants, effects(secret_use))\n                avoiding rooms;\n    }\n    run() { }\n}\nfn main() { ChatServer { }; }",
      "prose": "The claim is the page's centerpiece: guests may only reach the signer via rooms. Not \"never\" — the first draft said `forbid reaches(participants, effects(secret_use))` outright, and the compiler rejected the honest design with the witness `Participant::run -(publishes \"RoomTalk\")-> Room::post -> SessionSigner::stamp`: guests DO reach the signer, through the room, because the room stamps on their behalf. `avoiding rooms` is the real law — mediation, not prohibition. Hand a participant its own signer and the claim catches the bypass:",
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
