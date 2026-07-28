"use strict";

/**
 * Picks the right platform backend at require-time. Every backend
 * exposes the same three-function contract: block(), allow(), isBlocked().
 */
function loadBackend() {
  switch (process.platform) {
    case "win32":
      return require("./windows");
    case "darwin":
      return require("./macos");
    case "linux":
      return require("./linux");
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

module.exports = loadBackend();
