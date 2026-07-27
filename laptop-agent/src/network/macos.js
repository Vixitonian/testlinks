"use strict";
const { exec } = require("child_process");

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

/** sudo-prompt shows a native macOS password dialog; it's an optional
 *  dependency so the rest of the agent still loads if it's missing
 *  (you'll just get a clear error instead of a silent no-op). */
function sudoExec(cmd) {
  return new Promise((resolve, reject) => {
    let sudo;
    try {
      sudo = require("sudo-prompt");
    } catch (_) {
      return reject(new Error("sudo-prompt is not installed; run npm install"));
    }
    sudo.exec(cmd, { name: "Laptop Agent" }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

async function listNetworkServices() {
  const out = await run("networksetup -listallnetworkservices");
  return out
    .split("\n")
    .slice(1) // first line is a header/disclaimer
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("*")); // "*Name" = already-disabled service
}

/**
 * Disables every active network service (Wi-Fi, Ethernet, ...). Same
 * all-or-nothing tradeoff as Windows — see README for the auto-revert
 * safety timer this relies on.
 */
async function block() {
  const services = await listNetworkServices();
  for (const svc of services) {
    await sudoExec(`networksetup -setnetworkserviceenabled "${svc}" off`);
  }
}

async function allow() {
  // We don't persist which services were on before blocking (a laptop's
  // set of services rarely changes), so re-enable everything discoverable.
  const out = await run("networksetup -listallnetworkservices");
  const all = out.split("\n").slice(1).map((s) => s.replace(/^\*/, "").trim()).filter(Boolean);
  for (const svc of all) {
    await sudoExec(`networksetup -setnetworkserviceenabled "${svc}" on`);
  }
}

async function isBlocked() {
  const services = await listNetworkServices();
  return services.length === 0; // none enabled => everything is off
}

module.exports = { block, allow, isBlocked };
