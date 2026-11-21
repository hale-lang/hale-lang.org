#!/bin/sh
# Hale installer — https://hale-lang.org
#
#   curl -fsSL https://hale-lang.org/install.sh | sh
#
# Downloads the latest prebuilt release from GitHub, verifies its
# sha256, and installs to ~/.hale (override with HALE_INSTALL).
# Pin a version with HALE_VERSION=<tag>, a tag from
# https://github.com/hale-lang/hale/releases.
#
# Nightly builds of main: HALE_VERSION=nightly installs the newest,
# HALE_VERSION=nightly-2026-11-21 that day's. A nightly's version
# (v0.37.1-nightly.20261121+<commit>, as `hale --version` prints it)
# installs from its nightly too. Without HALE_VERSION, the latest
# release (a v* tag), never a nightly.
#
# Prebuilt targets: x86_64/aarch64 Linux (glibc), Apple Silicon macOS.
# Anything else (Intel macs, musl, BSD): build from source —
# https://github.com/hale-lang/hale#building-from-source
set -eu

REPO="hale-lang/hale"
INSTALL_DIR="${HALE_INSTALL:-$HOME/.hale}"

say()  { printf '%s\n' "$*"; }
fail() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar  >/dev/null 2>&1 || fail "tar is required"

os="$(uname -s)"
arch="$(uname -m)"
case "$os/$arch" in
  Linux/x86_64)                 target="x86_64-unknown-linux-gnu" ;;
  Linux/aarch64 | Linux/arm64)  target="aarch64-unknown-linux-gnu" ;;
  Darwin/arm64)                 target="aarch64-apple-darwin" ;;
  Darwin/x86_64) fail "no prebuilt binary for Intel macs yet — build from source: https://github.com/$REPO#building-from-source" ;;
  *)             fail "no prebuilt binary for $os/$arch — build from source: https://github.com/$REPO#building-from-source" ;;
esac

# The newest release tag matching the extended regex $1, newest first as
# the API lists them; pre-releases included (every pre-1.0 tag is one,
# and so is every nightly).
newest_tag() {
  curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=100" \
    | grep '"tag_name"' | sed 's/.*"tag_name"[^"]*"\([^"]*\)".*/\1/' \
    | grep -E "$1" | head -n 1
}

case "${HALE_VERSION:-}" in
  "")
    version="$(newest_tag '^v[0-9]')"
    [ -n "$version" ] || fail "could not determine the latest release tag"
    ;;
  nightly)
    version="$(newest_tag '^nightly-[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]+)?$')"
    [ -n "$version" ] || fail "could not find a nightly build"
    ;;
  v*-nightly.* | [0-9]*-nightly.*)
    # a nightly's version, as `hale --version` and a lock name it:
    # 0.37.1-nightly.20261121+8fd8d68 is nightly-2026-11-21, and the
    # day's second (…-nightly.20261121.2+…) nightly-2026-11-21.2
    version="$(printf '%s' "$HALE_VERSION" \
      | sed -n 's/^v\{0,1\}[^-]*-nightly\.\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)\(\.[0-9][0-9]*\)\{0,1\}\(+.*\)\{0,1\}$/nightly-\1-\2-\3\4/p')"
    [ -n "$version" ] || fail "not a nightly version: $HALE_VERSION"
    ;;
  *)
    version="$HALE_VERSION"
    ;;
esac

tarball="hale-$version-$target.tar.gz"
url="https://github.com/$REPO/releases/download/$version/$tarball"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

say "Downloading hale $version ($target)..."
curl -fL --progress-bar -o "$workdir/$tarball" "$url" \
  || fail "download failed: $url"
curl -fsSL -o "$workdir/$tarball.sha256" "$url.sha256" \
  || fail "checksum download failed: $url.sha256"

say "Verifying checksum..."
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$workdir" && sha256sum -c "$tarball.sha256" >/dev/null) \
    || fail "sha256 mismatch — refusing to install"
elif command -v shasum >/dev/null 2>&1; then
  (cd "$workdir" && shasum -a 256 -c "$tarball.sha256" >/dev/null) \
    || fail "sha256 mismatch — refusing to install"
else
  fail "need sha256sum or shasum to verify the download"
fi

# The tarball is flat: hale, libhale_ts_shim.a (must stay beside the
# binary — codegen probes for it when linking std::io), licenses.
mkdir -p "$INSTALL_DIR/bin"
tar -xzf "$workdir/$tarball" -C "$INSTALL_DIR/bin"
chmod +x "$INSTALL_DIR/bin/hale"

say ""
say "hale $version installed to $INSTALL_DIR/bin/hale"

case ":${PATH}:" in
  *":$INSTALL_DIR/bin:"*) ;;
  *)
    say ""
    say "Add it to your PATH:"
    say ""
    say "  export PATH=\"$INSTALL_DIR/bin:\$PATH\""
    say ""
    say "(append that line to your shell profile to make it stick)"
    ;;
esac

say ""
say 'Try it:  printf '\''fn main() { println("hale, world"); }'\'' > hello.hl && hale run hello.hl'
