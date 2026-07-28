"use strict";
const { exec } = require("child_process");

// Windows Firewall rule names used by this agent. Kept distinctive so we
// never touch a rule we didn't create, and so "allow" is safe to run even
// if nothing is currently blocked (idempotent).
const SERVER_RULE_PREFIX = "LaptopAgentAllow-Server";
const DNS_UDP_RULE = "LaptopAgentAllow-DNS-udp";
const DNS_TCP_RULE = "LaptopAgentAllow-DNS-tcp";

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

/**
 * Blocks all traffic by flipping the Windows Firewall's DEFAULT policy to
 * deny inbound/outbound, then adds explicit ALLOW rules for the control
 * server's resolved IP(s) + port and for outbound DNS — so the agent's
 * heartbeat loop (and thus a remote ALLOW command) keeps working even
 * while "blocked."
 *
 * This is NOT a naive "add a block rule ahead of the allow rule" — that
 * doesn't reliably work on Windows Firewall, which evaluates an explicit
 * block rule as taking precedence over an explicit allow rule for the
 * same traffic regardless of order, unless the allow rule uses IPsec
 * authenticated bypass (a much heavier mechanism than needed here).
 * Flipping the default POLICY and using only ALLOW rules sidesteps that
 * precedence question entirely: unmatched traffic is denied by policy,
 * matched (allow-listed) traffic is explicitly permitted, no conflict.
 *
 * Requires the process to already be running elevated (see
 * package.json's win.requestedExecutionLevel) — netsh advfirewall fails
 * silently otherwise.
 *
 * @param {{ips: string[], port: number}|null} allowTarget resolved via
 *   network/target.js. If null (DNS resolution failed), falls back to a
 *   blanket block with no allow-list — the agent's own connection is cut
 *   too in that fallback case, same as before this fix, relying solely
 *   on the auto-revert timer.
 */
async function block(allowTarget) {
  await allow(); // idempotent: clear any stale rules/policy from a previous run first

  if (allowTarget) {
    for (let i = 0; i < allowTarget.ips.length; i++) {
      await run(
        `netsh advfirewall firewall add rule name="${SERVER_RULE_PREFIX}-${i}" dir=out action=allow ` +
        `remoteip=${allowTarget.ips[i]} remoteport=${allowTarget.port} protocol=TCP enable=yes profile=any`
      );
    }
    await run(`netsh advfirewall firewall add rule name="${DNS_UDP_RULE}" dir=out action=allow remoteport=53 protocol=UDP enable=yes profile=any`);
    await run(`netsh advfirewall firewall add rule name="${DNS_TCP_RULE}" dir=out action=allow remoteport=53 protocol=TCP enable=yes profile=any`);
  }

  await run("netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound");
}

async function allow() {
  await run("netsh advfirewall set allprofiles firewallpolicy allowinbound,allowoutbound").catch(() => {});
  // "delete rule" errors if it doesn't exist — fine, ignore it. Delete a
  // generous range of indexed server rules since we don't know how many
  // IPs were allow-listed by whatever block() call created them.
  for (let i = 0; i < 8; i++) {
    await run(`netsh advfirewall firewall delete rule name="${SERVER_RULE_PREFIX}-${i}"`).catch(() => {});
  }
  await run(`netsh advfirewall firewall delete rule name="${DNS_UDP_RULE}"`).catch(() => {});
  await run(`netsh advfirewall firewall delete rule name="${DNS_TCP_RULE}"`).catch(() => {});
}

async function isBlocked() {
  try {
    const out = await run("netsh advfirewall show allprofiles firewallpolicy");
    return /BlockOutbound/i.test(out);
  } catch (_) {
    return false;
  }
}

module.exports = { block, allow, isBlocked };
