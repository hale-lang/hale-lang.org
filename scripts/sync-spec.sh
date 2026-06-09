#!/usr/bin/env bash
# Sync the Hale language spec into the Starlight docs collection.
#
# Copies each spec markdown file from the hale compiler repo into
# src/content/docs/docs/spec/, adding the Starlight frontmatter
# (title derived from the file's first H1, which is then stripped from
# the body so the page isn't double-titled).
#
# Usage:  ./scripts/sync-spec.sh  [path-to-hale-spec-dir]
set -euo pipefail

SRC="${1:-$HOME/code/hale-lang/hale/spec}"
DST="src/content/docs/docs/spec"

if [ ! -d "$SRC" ]; then
  echo "spec source not found: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"
rm -f "$DST"/*.md

count=0
for f in "$SRC"/*.md; do
  base="$(basename "$f")"
  title="$(grep -m1 '^# ' "$f" | sed 's/^# //; s/"/\\"/g')"
  [ -z "$title" ] && title="${base%.md}"
  out="$DST/$base"
  {
    echo "---"
    echo "title: \"$title\""
    echo "description: \"Hale language specification — $title.\""
    echo "---"
    echo ""
    echo "> Synced from the Hale compiler repo's \`spec/$base\`. Cross-references"
    echo "> to \`spec/*\` / \`notes/*\` / \`crates/*\` point at the source repo."
    echo ""
    # drop the first H1 line (Starlight renders the frontmatter title as H1)
    sed '0,/^# /{/^# /d;}' "$f"
  } > "$out"
  count=$((count + 1))
done

echo "synced $count spec file(s) → $DST"
