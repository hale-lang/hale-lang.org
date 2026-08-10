# Playground compile service

**Status: LIVE at `play.hale-lang.org`.** `/playground` iframes it, and it serves
an editable buffer with a Run button — so this service is compiling source
submitted by anyone on the internet. It runs containerized, with the limits in
[Containment](#containment) below. The sections after that were written before
any of this was deployed and are corrected inline.

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

## Containment

`main.hl` itself enforces exactly one limit: a 20s coreutils `timeout` around the
compile (`compile_to_json`). **That wall is not the sandbox.** The container is,
and reading `main.hl` alone will badly understate what is actually in force. The
deployment lives in the ops compose that runs this host, not in this repo, and it
sets:

| control | value | what it stops |
|---|---|---|
| `read_only: true` | — | writes anywhere but the tmpfs mounts below |
| `tmpfs /tmp`, `/cache` | 256m each | unbounded disk growth from the wasm cache |
| `cap_drop: ALL` | — | every capability |
| `security_opt` | `no-new-privileges:true` | setuid escalation |
| `pids_limit` | 256 | fork bombs, and runaway `clang` fan-out |
| `cpus` | 0.8 | a compile burst starving the co-tenants on the box |
| `mem_limit` | 640m | an LLVM blow-up taking the host into swap |

Plus the design property that does the heaviest lifting: **untrusted code is only
ever compiled, never executed.** The wasm goes back to the browser and runs in
its sandbox, not this one.

The image is built on a dev machine and shipped with `docker save | ssh docker
load` rather than built on the 1-vCPU host; `editor.html` is bind-mounted read-only
from the host so copy tweaks are an `scp` and a restart, not an image re-ship.

Still open:

- **Body size.** One `recv` per request (256 KB cap); fine for snippets, not uploads.
- **Egress.** The container needs inbound HTTP, so it has a network; the compile
  subprocess inherits it. Nothing today needs to reach out, so this could be
  tightened.

Done since this list was written (it used to read "NOT done — before exposing
publicly"): the service is hosted and sandboxed, and the storefront `/playground`
points at it.
