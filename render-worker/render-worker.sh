#!/bin/bash
# Apprelab render worker for macOS.
# Watches the GitHub repo for render jobs (render-jobs/<name>/job.json on any branch),
# renders each one to MP4 on this Mac with export.js, and pushes out.mp4 back to the same branch.
#
# Job lifecycle (all files live in render-jobs/<name>/ on the branch that posted the job):
#   job.json      posted by Claude: {"page":"page.html","audio":"narration.mp3","fps":24,"width":1280,"query":""}
#   claimed.txt   pushed by this worker when it starts (tells Claude a worker is online)
#   out.mp4       pushed by this worker when it finishes
#   error.txt     pushed instead of out.mp4 if the render fails
#
# Settings (environment variables, or edit the defaults below):
#   REPO_DIR     the clone to watch                (default: the repo this script lives in)
#   POLL         seconds between checks            (default: 30)
#   BRANCH_GLOB  which remote branches to watch    (default: * = all)
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
POLL="${POLL:-30}"
BRANCH_GLOB="${BRANCH_GLOB:-*}"
WORK="${WORK:-$HOME/Library/Caches/apprelab-render}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_PATH="$SCRIPT_DIR/node_modules"
export GIT_TERMINAL_PROMPT=0   # never hang on a password prompt; launchd has no terminal

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
notify() { osascript -e "display notification \"$1\" with title \"Apprelab render\"" >/dev/null 2>&1 || true; }

# Commit the given files in the worktree and push them to the job's branch, rebasing if the branch moved.
push_back() {
  local wt="$1" branch="$2" msg="$3"; shift 3
  ( cd "$wt" && git add -f "$@" && git commit -q -m "$msg" ) || return 1
  local i
  for i in 1 2 3 4; do
    ( cd "$wt" && git push -q origin "HEAD:refs/heads/$branch" 2>"$WORK/push.err" ) && return 0
    if grep -qiE "could not read Username|Authentication failed|403|Permission" "$WORK/push.err"; then
      log "GitHub refused the push (no saved login, or the token lacks Contents: Read and write)."
      log "Fix: in Terminal run  cd \"$REPO_DIR\" && git push --dry-run origin HEAD:refs/heads/$branch  and enter your username and token."
      notify "GitHub login needed: see the worker log"
      sleep 300; return 1
    fi
    cat "$WORK/push.err"
    log "push rejected (try $i), rebasing onto origin/$branch"
    ( cd "$wt" && git pull -q --rebase origin "$branch" ) || sleep $((i * 2))
  done
  return 1
}

render() {
  local branch="$1" job="$2" name wt jobdir spec page audio fps width query out start
  name="$(basename "$job")"
  wt="$WORK/wt"
  log "job $name on $branch: claiming"
  rm -rf "$wt"; git -C "$REPO_DIR" worktree prune
  git -C "$REPO_DIR" worktree add -q --detach "$wt" "origin/$branch" || { log "worktree failed"; return 1; }
  jobdir="$wt/$job"
  echo "Claimed by $(scutil --get ComputerName 2>/dev/null || hostname) at $(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$jobdir/claimed.txt"
  push_back "$wt" "$branch" "Render worker: claim $name" "$job/claimed.txt" || { log "could not push claim"; return 1; }

  spec="$(node -e 'const j=require(process.argv[1]);console.log([j.page||"page.html",j.audio||"",j.fps||24,j.width||1280,j.query||""].join("|"))' "$jobdir/job.json")" || spec="page.html||24|1280|"
  IFS='|' read -r page audio fps width query <<< "$spec"
  out="$jobdir/out.mp4"
  local args=("$jobdir/$page" "$out" --fps "$fps" --width "$width")
  [ -n "$audio" ] && args+=(--audio "$jobdir/$audio")
  [ -n "$query" ] && args+=(--query "$query")

  notify "Rendering $name"
  start=$(date +%s)
  log "job $name: rendering ${fps} fps, ${width} px wide"
  if caffeinate -i node "$SCRIPT_DIR/export.js" "${args[@]}" > "$WORK/last.log" 2>&1 && [ -s "$out" ]; then
    log "job $name: rendered in $(( $(date +%s) - start )) s, pushing"
    push_back "$wt" "$branch" "Render worker: out.mp4 for $name" "$job/out.mp4" && notify "Done: $name" && log "job $name: done"
  else
    log "job $name: FAILED, pushing error.txt"
    { echo "Render failed on $(hostname) at $(date -u '+%Y-%m-%dT%H:%M:%SZ')"; tail -40 "$WORK/last.log"; } > "$jobdir/error.txt"
    push_back "$wt" "$branch" "Render worker: error for $name" "$job/error.txt"
    notify "Failed: $name"
  fi
  git -C "$REPO_DIR" worktree remove --force "$wt" 2>/dev/null
}

mkdir -p "$WORK"
cd "$REPO_DIR" || { log "REPO_DIR not found: $REPO_DIR"; exit 1; }
log "watching $(git remote get-url origin) every ${POLL}s (branches: $BRANCH_GLOB)"
while true; do
  if git fetch -q --prune origin; then
    for branch in $(git for-each-ref --format='%(refname:strip=3)' "refs/remotes/origin/$BRANCH_GLOB"); do
      [ "$branch" = "HEAD" ] && continue
      for job in $(git ls-tree -d --name-only "origin/$branch" render-jobs/ 2>/dev/null); do
        git cat-file -e "origin/$branch:$job/job.json" 2>/dev/null || continue
        for f in claimed.txt out.mp4 error.txt; do git cat-file -e "origin/$branch:$job/$f" 2>/dev/null && continue 2; done
        render "$branch" "$job"
      done
    done
  else
    log "fetch failed (offline?), retrying"
  fi
  sleep "$POLL"
done
