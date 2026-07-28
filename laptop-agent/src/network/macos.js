"use strict";
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// A distinctive first line in every ruleset we load, so isBlocked() can
// tell "our block is active" apart from macOS's own default pf rules.
const MARKER = "# laptop-agent-block-marker";
const RULES_FILE = path.join(os.tmpdir(), "laptop-agent-pf.conf");

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

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

/**
 * Loads a complete pf (packet filter) ruleset that denies everything by
 * default except loopback and — when allowTarget is known — the control
 * server's resolved IP(s)/port and outbound DNS. This replaced an earlier
 * version that just disabled every network service via `networksetup`:
 * that's a blunt on/off switch with the interface itself going down, so
 * there was no way to let any traffic through selectively. pf rules run
 * underneath the interface staying up, so specific destinations can stay
 * reachable while everything else is blocked.
 *
 * Uses a full top-level `pfctl -f <file>` load rather than a named anchor
 * — macOS's default /etc/pf.conf only auto-evaluates anchors under the
 * "com.apple/*" namespace, so a custom anchor name wouldn't actually run
 * without also editing /etc/pf.conf. Loading a complete replacement
 * ruleset avoids needing to touch that file at all.
 *
 * @param {{ips: string[], port: number}|null} allowTarget see windows.js
 *   for the fallback semantics when this is null.
 */
async function block(allowTarget) {
  const lines = [MARKER, "set skip on lo0", "block drop all"];
  if (allowTarget) {
    for (const ip of allowTarget.ips) {
      lines.push(`pass out quick proto tcp to ${ip} port ${allowTarget.port}`);
    }
    lines.push("pass out quick proto { tcp udp } to any port 53");
  }
  fs.writeFileSync(RULES_FILE, lines.join("\n") + "\n", "utf8");

  await sudoExec(`pfctl -f ${RULES_FILE}`);
  await sudoExec("pfctl -e").catch(() => {}); // errors if already enabled — fine, ignore
}

async function allow() {
  // Restore macOS's own default ruleset rather than just disabling pf,
  // since disabling it would also drop Apple's own default rules (some
  // of which matter for normal networking, e.g. its NAT/anchor setup).
  await sudoExec("pfctl -f /etc/pf.conf").catch(() => {});
  try {
    fs.unlinkSync(RULES_FILE);
  } catch (_) {
    /* already absent */
  }
}

async function isBlocked() {
  try {
    // pf comments (like MARKER) aren't compiled into the kernel's active
    // ruleset, so `pfctl -sr` (which reads that, not our source file)
    // never shows them — check for the distinctive rule text instead.
    // Best-effort, same as the other platforms' isBlocked().
    const out = await run("pfctl -sr");
    return out.includes("block drop all");
  } catch (_) {
    return false;
  }
}

module.exports = { block, allow, isBlocked };
