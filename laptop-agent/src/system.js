"use strict";
const { execFile } = require("child_process");

/**
 * Shuts down the machine. Deliberately not instant — gives a short grace
 * period (and a visible on-screen message on Windows) so the shutdown
 * itself is never silent/covert, matching this whole project's rule
 * against covert action: the person at the keyboard sees it coming.
 */
function shutdown() {
  return new Promise((resolve, reject) => {
    const GRACE_SECONDS = 30;
    let cmd, args;
    if (process.platform === "win32") {
      cmd = "shutdown";
      args = ["/s", "/t", String(GRACE_SECONDS), "/c", "Laptop Agent: this device is shutting down.", "/f"];
    } else if (process.platform === "darwin") {
      cmd = "shutdown";
      args = ["-h", "+1"]; // macOS's shutdown only accepts whole minutes
    } else {
      cmd = "shutdown";
      args = ["-h", `+${Math.ceil(GRACE_SECONDS / 60)}`];
    }
    execFile(cmd, args, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { shutdown };
