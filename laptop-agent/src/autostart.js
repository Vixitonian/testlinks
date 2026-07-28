"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Registers the agent to launch automatically at user login. This is a
 * *login-time* start, not a pre-login system service — Electron apps
 * need a graphical user session to show a tray icon at all, so a true
 * "before anyone logs in" boot service would have to be a separate
 * headless component. See README for that distinction.
 */
function enable(app) {
  if (process.platform === "linux") return enableLinuxAutostart(app);

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true, // macOS: don't flash a window on auto-launch
    args: ["--autostarted"]
  });
}

function disable(app) {
  if (process.platform === "linux") return disableLinuxAutostart();
  app.setLoginItemSettings({ openAtLogin: false });
}

function isEnabled(app) {
  if (process.platform === "linux") return fs.existsSync(linuxDesktopFilePath());
  return app.getLoginItemSettings().openAtLogin;
}

// Electron's setLoginItemSettings has no effect on most Linux desktop
// environments, so we write a standard XDG autostart .desktop file instead.
function linuxDesktopFilePath() {
  return path.join(os.homedir(), ".config", "autostart", "laptop-agent.desktop");
}

function enableLinuxAutostart(app) {
  const file = linuxDesktopFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const exec = process.env.APPIMAGE || process.execPath;
  const contents = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Laptop Agent",
    `Exec=${exec} --autostarted`,
    "X-GNOME-Autostart-enabled=true",
    "NoDisplay=false"
  ].join("\n");
  fs.writeFileSync(file, contents + "\n", "utf8");
}

function disableLinuxAutostart() {
  try {
    fs.unlinkSync(linuxDesktopFilePath());
  } catch (_) {
    /* already absent */
  }
}

module.exports = { enable, disable, isEnabled };
