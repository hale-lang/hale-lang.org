#!/usr/bin/env bash
# Build the agent toolchain assets that the /agents page serves:
#   public/hale-context.txt        full authoring pack (essentials + spec + gotchas)
#   public/hale-context-slim.txt   essentials + the two highest-signal spec docs
#   public/llms-full.txt           the documentation corpus (full spec)
#   public/agent/AGENTS.md         rules-file template (canonical)
#   public/agent/CLAUDE.md         derived from AGENTS.md (Claude Code variant)
#   public/agent/.cursorrules      derived from AGENTS.md (Cursor variant)
#
# Usage: ./scripts/build-agent-assets.sh [hale-spec-dir] [pond-dir]
set -euo pipefail

SPEC="${1:-$HOME/code/hale-lang/hale/spec}"
POND="${2:-$HOME/code/hale-lang/pond}"
ASSETS="agent-assets"
OUT="public"
AGENTOUT="$OUT/agent"
DATE="$(date +%Y-%m-%d)"

# The canonical agent prompt lives in the hale repo, next to the spec —
# the site never authors its own copy (it drifted when it did).
AGENTS_SRC="$(dirname "$SPEC")/AGENTS.md"

[ -d "$SPEC" ] || { echo "spec dir not found: $SPEC" >&2; exit 1; }
[ -f "$AGENTS_SRC" ] || { echo "canonical AGENTS.md not found: $AGENTS_SRC" >&2; exit 1; }
mkdir -p "$AGENTOUT"

# Ordered reading sequence for the spec (high-signal first).
SPEC_ORDER="styleguide semantics types memory runtime forms tokens precedence projects packages stdlib ffi verification testing design-rationale"

sep() {  # sep "Title" "source/path"
  printf '\n%s\n## %s\n## source: %s\n%s\n\n' \
    "================================================================================" \
    "$1" "$2" \
    "================================================================================"
}

pack_header() {  # pack_header "Title" "one-line description"
  cat <<EOF
================================================================================
$1
================================================================================

$2

Generated $DATE from the Hale language specification. The authoritative source is
the compiler repository. When in doubt, run \`hale check\` — the compiler is the
oracle.

EOF
}

# ---- full context pack ----
full="$OUT/hale-context.txt"
{
  pack_header "HALE CONTEXT PACK (full)" \
    "Everything an LLM needs to write correct, idiomatic Hale: the essentials, the full language specification, and the real-world gotchas."
  sep "Essentials & gotchas" "$ASSETS/essentials.md"; cat "$ASSETS/essentials.md"
  for name in $SPEC_ORDER; do
    f="$SPEC/$name.md"; [ -f "$f" ] || continue
    title="$(grep -m1 '^# ' "$f" | sed 's/^# //')"
    sep "${title:-$name}" "spec/$name.md"; cat "$f"
  done
  if [ -f "$POND/CLAUDE.md" ]; then
    sep "pond — real-world gotchas & conventions" "pond/CLAUDE.md"; cat "$POND/CLAUDE.md"
  fi
} > "$full"

# ---- slim context pack ----
slim="$OUT/hale-context-slim.txt"
{
  pack_header "HALE CONTEXT PACK (slim)" \
    "The essentials plus the two highest-signal spec docs (style guide + lexical structure). Fits comfortably in a context window."
  sep "Essentials & gotchas" "$ASSETS/essentials.md"; cat "$ASSETS/essentials.md"
  for name in styleguide tokens; do
    f="$SPEC/$name.md"; [ -f "$f" ] || continue
    title="$(grep -m1 '^# ' "$f" | sed 's/^# //')"
    sep "${title:-$name}" "spec/$name.md"; cat "$f"
  done
} > "$slim"

# ---- llms-full.txt (documentation corpus) ----
corpus="$OUT/llms-full.txt"
{
  pack_header "HALE — full documentation corpus (llms-full.txt)" \
    "The complete Hale language specification, concatenated for machine consumption."
  for name in $SPEC_ORDER; do
    f="$SPEC/$name.md"; [ -f "$f" ] || continue
    title="$(grep -m1 '^# ' "$f" | sed 's/^# //')"
    sep "${title:-$name}" "spec/$name.md"; cat "$f"
  done
} > "$corpus"

# ---- rules files (hale's AGENTS.md is the source; derive the rest) ----
cp "$AGENTS_SRC" "$AGENTOUT/AGENTS.md"

{
  echo "<!-- Claude Code auto-loads CLAUDE.md. These are the project's Hale rules. -->"
  echo ""
  sed '1s/^# AGENTS.md/# CLAUDE.md/' "$AGENTS_SRC"
} > "$AGENTOUT/CLAUDE.md"

# .cursorrules: same rules, retitled.
sed '1s/^# AGENTS.md — /# Cursor rules — /' "$AGENTS_SRC" > "$AGENTOUT/.cursorrules"

echo "built:"
for f in "$full" "$slim" "$corpus" "$AGENTOUT/AGENTS.md" "$AGENTOUT/CLAUDE.md" "$AGENTOUT/.cursorrules"; do
  printf "  %-34s %s\n" "$f" "$(wc -c < "$f" | awk '{printf "%.0f KB", $1/1024}')"
done
