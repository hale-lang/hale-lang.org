// Literate full example — the everyday tier's flagship. Sections'
// `code` fields concatenate ('\n\n'-joined) to the EXACT program
// the capture script checks and breaks; drift between the page and
// a working program fails the build.
export const full = {
  "slug": "everyday-api",
  "tier": "everyday",
  "file": "orders-api.hl",
  "title": "A small JSON API",
  "tagline": "Typed JSON in and out, a stateful handler, a router, and a server — from the standard library, with no framework decision.",
  "intro": "A complete HTTP service in under fifty lines: one order type whose `json:` tags are the entire codec, a read handler, a stateful intake handler, and a router mounted on `std::http::Server`. Every section below concatenates to the exact program this build checked, and the one deliberate mistake shows the compiler catching the classic API bug — trusting a request body — at build time.",
  "sections": [
    {
      "id": "types",
      "code": "type Order {\n    id: Int      `json:\"id\"`;\n    item: String `json:\"item\"`;\n    price: Int   `json:\"px\"`;\n}",
      "prose": "The type is the schema. `from_json` parses a document into an `Order` in one pass — a missing field is an error naming the field — and `to_json` writes it back. There is no separate schema language, no derive ceremony, and no map-of-anything passing through the handlers."
    },
    {
      "id": "read",
      "code": "locus OrderRead {\n    fn handle(ctx: std::http::Context) -> std::http::Response {\n        let id = std::str::parse_int(std::http::path_param(ctx.params, \"id\")) or 0;\n        let o = Order { id: id, item: \"espresso\", price: 350 };\n        return std::http::Response {\n            status: 200,\n            body: Order::to_json(o),\n            content_type: \"application/json\",\n        };\n    }\n}",
      "prose": "A route handler is an ordinary locus with a `handle` method — the interface is structural, so there is nothing to implement or register beyond the method itself. The path capture arrives through `ctx.params`, the parse failure is addressed inline with a default, and the response is a literal."
    },
    {
      "id": "intake",
      "code": "locus OrderIntake {\n    params { placed: Int = 0; }\n\n    fn handle(ctx: std::http::Context) -> std::http::Response {\n        let o = Order::from_json(ctx.req.body) or {\n            return std::http::Response { status: 400, body: \"not an order: \" + err.field };\n        };\n        self.placed += 1;\n        return std::http::Response { status: 201, body: Order::to_json(o) };\n    }\n}",
      "prose": "State is what a locus is for: `placed` is a param, private to the handler, no shared-mutability story required. The request body is attacker-controlled input, and `from_json` is fallible accordingly — the or-block turning a bad body into a 400 is not optional. Delete it and the build refuses:",
      "brk": {
        "find": "        let o = Order::from_json(ctx.req.body) or {\n            return std::http::Response { status: 400, body: \"not an order: \" + err.field };\n        };",
        "replace": "        let o = Order::from_json(ctx.req.body);",
        "note": "Trust the request body."
      }
    },
    {
      "id": "server",
      "code": "fn build_router() -> std::http::Router {\n    let r = std::http::Router { };\n    r.add(\"GET\", \"/orders/:id\", OrderRead { });\n    r.add(\"POST\", \"/orders\", OrderIntake { });\n    return r;\n}\n\nfn main() {\n    std::http::Server { port: 8080, handler: build_router(), max_accepts: 2 };\n}",
      "prose": "The router is first-match-wins; the server is one statement. `max_accepts` bounds the accept loop, which is how a test drives the same server a deployment runs. Nothing on this page imported a framework — the server, router, JSON codec, and handler contract all ship in `std::http` and the language itself."
    }
  ]
};
