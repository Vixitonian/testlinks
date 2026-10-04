#!/bin/bash
# One-time setup for the Apprelab render worker on macOS.
# Installs dependencies, then registers the worker with launchd so it starts at login and restarts if it stops.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.apprelab.render-worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/apprelab-render-worker.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

command -v git >/dev/null && git --version >/dev/null 2>&1 || { echo "Missing git. Run: xcode-select --install  (then rerun this script)"; exit 1; }
command -v node >/dev/null && command -v npm >/dev/null || { echo "Missing Node.js. Download the macOS installer (LTS) from https://nodejs.org, run it, then rerun this script"; exit 1; }
git -C "$SCRIPT_DIR/.." ls-remote -q origin >/dev/null || { echo "This clone cannot reach GitHub. Check your internet connection."; exit 1; }
BR="$(git -C "$SCRIPT_DIR/.." rev-parse --abbrev-ref HEAD)"
echo "Checking that this Mac can push to GitHub (enter your GitHub username and token if asked)..."
git config --global credential.helper >/dev/null || git config --global credential.helper osxkeychain
git -C "$SCRIPT_DIR/.." push --dry-run -q origin "HEAD:refs/heads/$BR" || { echo "GitHub refused the push. Use your GitHub username and a token with Contents: Read and write as the password, then rerun this script."; exit 1; }

echo "Installing Playwright, its Chromium and a bundled ffmpeg..."
cd "$SCRIPT_DIR" && npm install --silent && npx playwright install chromium
node -e "const f=require('ffmpeg-static');require('child_process').execFileSync(f,['-version']);console.log('ffmpeg ok:',f)"
chmod +x "$SCRIPT_DIR/render-worker.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SCRIPT_DIR/render-worker.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Render worker is running. Watch it with: tail -f $LOG"
echo "Stop it with: launchctl bootout gui/\$(id -u)/$LABEL"
