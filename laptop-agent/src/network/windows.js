"use strict";
const { exec } = require("child_process");

// Windows Firewall rule names used by this agent. Kept distinctive so we
// never touch a rule we didn't create, and so "allow" is safe to run even
// if nothing is currently blocked (idempotent).
const OUT_RULE = "LaptopAgentBlock-Out";
const IN_RULE = "LaptopAgentBlock-In";

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

/**
 * Blocks all inbound/outbound traffic via two blanket Windows Firewall
 * rules. Requires the process to already be running elevated (see
 * package.json's win.requestedExecutionLevel) — netsh advfirewall fails
 * silently otherwise.
 *
 * NOTE: this is an all-or-nothing block, so it also cuts the agent's own
 * connection to the control server. See README "Known limitation" for why
 * that's acceptable for this MVP (auto-revert safety timer) and what a
 * v2 fix looks like (allow-list the server's IP with a higher-priority
 * permit rule).
 */
async function block() {
  await allow(); // idempotent: clear any stale rules from a previous run first
  await run(`netsh advfirewall firewall add rule name="${OUT_RULE}" dir=out action=block enable=yes profile=any`);
  await run(`netsh advfirewall firewall add rule name="${IN_RULE}" dir=in action=block enable=yes profile=any`);
}

async function allow() {
  // "delete rule" errors if the rule doesn't exist — that's fine, ignore it.
  await run(`netsh advfirewall firewall delete rule name="${OUT_RULE}"`).catch(() => {});
  await run(`netsh advfirewall firewall delete rule name="${IN_RULE}"`).catch(() => {});
}

async function isBlocked() {
  try {
    const out = await run(`netsh advfirewall firewall show rule name="${OUT_RULE}"`);
    return /Enabled:\s*Yes/i.test(out);
  } catch (_) {
    return false; // rule not found => not blocked
  }
}

module.exports = { block, allow, isBlocked };
