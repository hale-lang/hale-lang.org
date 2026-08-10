# Playground compile service

**Status: LIVE at `play.hale-lang.org`.** `/playground` iframes it, and it serves
an editable buffer with a Run button — so this service is compiling source
submitted by anyone on the internet. The sections below were written before that
happened and are corrected inline; the deployment itself is configured outside
this repo, so nothing here describes how it is actually run.

Hale has no interpreter — `hale run` compiles through LLVM — so arbitrary
client-side execution isn't possible. This service compiles untrusted source to
`wasm32` and hands the wasm back; the browser instantiates and runs it in its own
sandbox. **Untrusted code is only ever compiled server-side, never executed.**

The older, non-editable tour still exists at `/play/` (wasm vendored under
`public/play/`, no backend involved) and is linked from `/playground` as the
"Guided example tour".

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

## Open: containment

This list used to be titled "NOT done (before exposing publicly)". It is public
now, so the first item is no longer a plan — it is an open question about a
running service.

- **Sandboxing — UNVERIFIED.** As written, `main.hl` compiles in the host
  namespace under a coreutils `timeout` wall and nothing else: no CPU cap, no
  memory cap, no PID limit, no filesystem or mount isolation, no seccomp. A
  compiler is a large attack surface and this is arbitrary input from the
  internet. **No deployment config for this service exists in any repo** — note
  that `hale`'s `release/docker-compose.yml` is the compiler release-tarball
  builder and has no resource limits and never runs this service — so whether
  the live instance adds containment cannot be answered from source. If it does,
  commit that config here so it stops being invisible. If it does not, the
  minimum is a container with `pids_limit`, `mem_limit`, `cpus`, a read-only
  rootfs, a `tmpfs` scratch, dropped capabilities, and no network in the compile
  step.
- **Body size.** One `recv` per request (256 KB cap); fine for snippets, not uploads.

Done since this list was written: the storefront `/playground` page points at the
deployed endpoint, and the service is hosted.
