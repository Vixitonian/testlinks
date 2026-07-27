#!/usr/bin/env bash
# Builds LaptopAgentService-Setup.exe: a self-contained NSIS installer for
# the headless Windows Service variant (src/service-main.js), bundling a
# portable Node.js runtime so the target machine needs nothing
# pre-installed. See build/service-installer.nsi for what it actually does.
#
# Requires: makensis (NSIS) on PATH, or set MAKENSIS to its full path.
# Requires network access once, to fetch the portable Node.js runtime if
# runtime/node.exe isn't already present.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NODE_VERSION="v24.18.0"
RUNTIME_DIR="$ROOT/runtime"
STAGE="$ROOT/build/stage"
MAKENSIS="${MAKENSIS:-makensis}"

if [ ! -f "$RUNTIME_DIR/node.exe" ]; then
  echo "Downloading portable Node.js $NODE_VERSION (win-x64)..."
  mkdir -p "$RUNTIME_DIR"
  tmpzip="$(mktemp)"
  curl -sL -o "$tmpzip" "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip"
  unzip -j -o "$tmpzip" "node-${NODE_VERSION}-win-x64/node.exe" "node-${NODE_VERSION}-win-x64/LICENSE" -d "$RUNTIME_DIR"
  rm -f "$tmpzip"
fi

# node-windows's own dependencies (xml, yargs, and yargs's transitive
# deps) get hoisted to the top level by npm — and this project's own
# node_modules/ is polluted with unrelated electron/electron-builder
# devDependencies at that same top level, so copying node_modules/node-windows
# alone (as an earlier version of this script did) silently ships a
# node-windows that's missing its own deps, breaking at runtime with
# MODULE_NOT_FOUND for `yargs` inside node-windows/lib/wrapper.js — the
# script that actually runs *inside* the installed service, not just at
# install time, so this has to be right. Installing node-windows fresh in
# an empty scratch directory gives a clean, correctly-resolved dependency
# tree with nothing extra mixed in.
NW_SCRATCH="$ROOT/build/node-windows-deps"
if [ ! -d "$NW_SCRATCH/node_modules/node-windows" ]; then
  echo "Resolving node-windows's dependency tree in a clean scratch dir..."
  rm -rf "$NW_SCRATCH"
  mkdir -p "$NW_SCRATCH"
  (cd "$NW_SCRATCH" && npm init -y >/dev/null && npm install node-windows >/dev/null)
fi

echo "Staging files..."
rm -rf "$STAGE"
mkdir -p "$STAGE/runtime" "$STAGE/scripts"
cp "$RUNTIME_DIR/node.exe" "$STAGE/runtime/node.exe"
cp -r "$NW_SCRATCH/node_modules" "$STAGE/node_modules"
cp "$ROOT/scripts/install-service.js" "$ROOT/scripts/uninstall-service.js" "$STAGE/scripts/"

# Only the modules service-main.js actually needs — no Electron/UI files
# (main.js, tray.js, preload.js, autostart.js, ui/) since those require
# "electron", which isn't present or needed in a headless service.
mkdir -p "$STAGE/src/network"
cp "$ROOT/src/service-main.js" \
   "$ROOT/src/logger.js" \
   "$ROOT/src/config.js" \
   "$ROOT/src/device.js" \
   "$ROOT/src/state.js" \
   "$ROOT/src/controller.js" \
   "$ROOT/src/connection.js" \
   "$ROOT/src/supabein.js" \
   "$ROOT/src/time.js" \
   "$STAGE/src/"
cp "$ROOT/src/network/index.js" \
   "$ROOT/src/network/target.js" \
   "$ROOT/src/network/windows.js" \
   "$STAGE/src/network/"

mkdir -p "$ROOT/dist"
echo "Compiling installer..."
"$MAKENSIS" "$ROOT/build/service-installer.nsi"

echo "Done: $ROOT/dist/LaptopAgentService-Setup.exe"
