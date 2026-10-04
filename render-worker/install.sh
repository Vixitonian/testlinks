#!/bin/bash
# One-time setup for the Apprelab render worker on macOS.
# Installs dependencies, then registers the worker with launchd so it starts at login and restarts if it stops.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.apprelab.render-worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/apprelab-render-worker.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

for tool in git node npm ffmpeg; do
  command -v "$tool" >/dev/null || { echo "Missing $tool. Install it with: brew install ${tool/npm/node}"; exit 1; }
done
git -C "$SCRIPT_DIR/.." ls-remote -q origin >/dev/null || { echo "This clone cannot reach GitHub. Sign in first (gh auth login, or an SSH key)."; exit 1; }

echo "Installing Playwright and its Chromium..."
cd "$SCRIPT_DIR" && npm install --silent && npx playwright install chromium
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
