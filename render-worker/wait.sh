#!/bin/bash
# Wait for a posted job. Exits 0 with out.mp4 pulled, 2 if no worker claims it within CLAIM_WAIT seconds,
# 3 if the worker reports an error, 4 if the render does not finish within DONE_WAIT seconds.
# usage: render-worker/wait.sh NAME
NAME="$1"; CLAIM_WAIT="${CLAIM_WAIT:-180}"; DONE_WAIT="${DONE_WAIT:-3600}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"; J="render-jobs/$NAME"; t=0; claimed=0
while :; do
  git fetch -q origin "$BRANCH" || true
  has() { git cat-file -e "origin/$BRANCH:$J/$1" 2>/dev/null; }
  if has out.mp4; then git pull -q --no-rebase origin "$BRANCH" && echo "done: $J/out.mp4"; exit 0; fi
  if has error.txt; then git show "origin/$BRANCH:$J/error.txt"; exit 3; fi
  if [ $claimed = 0 ] && has claimed.txt; then claimed=1; git show "origin/$BRANCH:$J/claimed.txt"; fi
  [ $claimed = 0 ] && [ $t -ge "$CLAIM_WAIT" ] && { echo "no worker claimed $J within ${CLAIM_WAIT}s"; exit 2; }
  [ $t -ge "$DONE_WAIT" ] && { echo "render of $J did not finish within ${DONE_WAIT}s"; exit 4; }
  sleep 20; t=$((t + 20))
done
