#!/bin/bash
# Post a render job from a Claude session (or anywhere): copies the page and audio into
# render-jobs/<name>/, writes job.json, commits and pushes to the current branch.
# usage: [FAST=true] render-worker/submit.sh NAME page.html [narration.mp3] [fps] [width]
set -e
NAME="$1"; PAGE="$2"; AUDIO="${3:-}"; FPS="${4:-24}"; WIDTH="${5:-1280}"
ROOT="$(git rev-parse --show-toplevel)"; BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DIR="$ROOT/render-jobs/$NAME"
[ -e "$DIR" ] && { echo "render-jobs/$NAME already exists; pick a new name"; exit 1; }
mkdir -p "$DIR"; cp "$PAGE" "$DIR/page.html"
A=""; [ -n "$AUDIO" ] && cp "$AUDIO" "$DIR/narration.mp3" && A="narration.mp3"
printf '{"page":"page.html","audio":"%s","fps":%s,"width":%s,"query":"","fast":%s}\n' "$A" "$FPS" "$WIDTH" "${FAST:-false}" > "$DIR/job.json"
git -C "$ROOT" add "render-jobs/$NAME" && git -C "$ROOT" commit -q -m "Render job: $NAME"
git -C "$ROOT" push -q -u origin "$BRANCH"
echo "posted render-jobs/$NAME on $BRANCH"
