"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

/**
 * Establishes a stable identity for this laptop that survives restarts
 * and reinstalls of the agent (as long as userData isn't wiped). This is
 * the id the phone app will see in its device list.
 */
function loadOrCreateDevice(userDataDir) {
  const file = path.join(userDataDir, "device.json");
  try {
    const existing = JSON.parse(fs.readFileSync(file, "utf8"));
    if (existing.id) return refreshVolatileFields(existing, file);
  } catch (_) {
    /* first run — fall through and create one */
  }

  const device = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(device, null, 2), "utf8");
  return refreshVolatileFields(device, file);
}

/** Fields that can legitimately change between runs (hostname edits,
 *  OS upgrades, user switches) are recomputed every launch rather than
 *  frozen at first install. */
function refreshVolatileFields(device, file) {
  device.hostname = os.hostname();
  device.platform = process.platform; // 'win32' | 'darwin' | 'linux'
  device.osRelease = os.release();
  device.username = os.userInfo().username;
  fs.writeFileSync(file, JSON.stringify(device, null, 2), "utf8");
  return device;
}

module.exports = { loadOrCreateDevice };
