# Playground compile service

The browser playground (`/playground`) runs **canned** examples fully client-side
(wasm vendored under `public/play/`). To let visitors write and run **their own**
code we need a backend: Hale has no interpreter — `hale run` compiles through LLVM —
so arbitrary client-side execution isn't possible. This service compiles untrusted
source to `wasm32` and hands the wasm back; the browser instantiates and runs it in
its own sandbox. **Untrusted code is only ever compiled server-side, never executed.**

Dogfooding: the service is itself a Hale program (`main.hl`), built on the std
HTTP/TCP/process/fs/crypto substrate — same posture as the Causality servers.

## Files

| file          | what it is                                                        |
|---------------|-------------------------------------------------------------------|
| `main.hl`     | the service (HTTP server + compile + content-addressed wasm cache)|
| `editor.html` | the editor page served at `GET /` (textarea, Run, share-by-URL)   |

## Routes

- `GET /` → the editor page (`editor.html`).
- `POST /compile` → request body is Hale source. Returns
  `{"ok":true,"bytes":N,"wasm":"<base64>"}` on success, or
  `{"ok":false,"error":"<diagnostics>"}` (server paths stripped) on failure.
- `OPTIONS *` → CORS preflight, so the storefront (a different origin) can call it.

## Build & run

```sh
hale build service/main.hl          # → service/main (native binary)
./service/main 8080                 # listen on :8080
# open http://127.0.0.1:8080/
```

Config (env, all optional):

| var               | default                                            |
|-------------------|----------------------------------------------------|
| `HALE_BIN`        | `/home/riley/code/hale-lang/hale/target/release/hale` |
| `HALE_PLAY_CACHE` | `/tmp/hale-play-cache`                             |
| `HALE_PLAY_HTML`  | `service/editor.html`                             |
| `PORT` (argv[1])  | `8080`                                            |

## Validated

- arbitrary `fn main() { … }` → ~5.6 KB wasm → runs in the browser (`hello`, loops).
- error path returns clean `playground.hl:LINE:COL` diagnostics (host paths stripped).
- content-addressed cache (sha256 → url-safe base64): repeat compiles ~2 ms.
- `--wrap-main` lets a bare `fn main()` target wasm without an `@export locus`.

## NOT done (before exposing publicly)

- **Sandboxing.** Compilation runs in the host namespace under a `timeout` wall
  only. Run it behind a container / nsjail with CPU+memory+fs limits before
  putting it on the internet — a compiler is a big attack surface.
- **Hosting / deploy.** No systemd unit, container image, or reverse-proxy config yet.
- **Body size.** One `recv` per request (256 KB cap); fine for snippets, not uploads.
- **Wiring the storefront `/playground` page** to point its editor at this endpoint
  (currently the page embeds the static tour).
