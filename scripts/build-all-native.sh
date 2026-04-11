#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/cli"
NPM="$ROOT/npm"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

need_cmd rustup
if RUSTUP_CARGO="$(rustup which cargo 2>/dev/null)" && [[ -n "$RUSTUP_CARGO" ]]; then
  export PATH="$(dirname "$RUSTUP_CARGO"):$HOME/.cargo/bin:${PATH:-}"
fi
need_cmd cargo

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script is intended to run on macOS." >&2
  exit 1
fi

need_cmd cargo-zigbuild
need_cmd zig

echo ">> Building UI (embedded assets)"
(cd "$ROOT" && npm run build:ui)

rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true
rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu x86_64-pc-windows-gnu >/dev/null 2>&1 || true

cd "$CLI"

build_copy() {
  local target="$1"
  local dest_dir="$2"
  local dest_name="$3"
  local use_zig="${4:-0}"
  echo ">> Building $target -> npm/$dest_dir/$dest_name"
  if [[ "$use_zig" == "1" ]]; then
    cargo zigbuild --release --target "$target"
  else
    cargo build --release --target "$target"
  fi
  local src="target/$target/release/$dest_name"
  if [[ ! -f "$src" ]]; then
    echo "Expected binary missing: $src" >&2
    exit 1
  fi
  mkdir -p "$NPM/$dest_dir"
  cp "$src" "$NPM/$dest_dir/$dest_name"
  if [[ "$dest_name" != "nyo.exe" ]]; then
    chmod +x "$NPM/$dest_dir/$dest_name" || true
  fi
}

ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  build_copy aarch64-apple-darwin darwin-arm64 nyo 0
  build_copy x86_64-apple-darwin darwin-x64 nyo 0
elif [[ "$ARCH" == "x86_64" ]]; then
  build_copy x86_64-apple-darwin darwin-x64 nyo 0
  echo ">> darwin-arm64: skipping on Intel Mac (build on Apple Silicon or run .github/workflows/publish-native.yml)." >&2
else
  echo "Unsupported Mac arch: $ARCH" >&2
  exit 1
fi

build_copy x86_64-unknown-linux-gnu linux-x64 nyo 1
build_copy aarch64-unknown-linux-gnu linux-arm64 nyo 1
build_copy x86_64-pc-windows-gnu win32-x64 nyo.exe 1

echo ">> Binaries staged under $NPM/*/ (run npm publish in each folder or use GitHub Actions)."
