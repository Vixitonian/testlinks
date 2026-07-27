"use strict";
const { exec } = require("child_process");

const OUT_CHAIN = "LAPTOP_AGENT_OUT";
const IN_CHAIN = "LAPTOP_AGENT_IN";

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
 * Uses two dedicated iptables chains (hooked into OUTPUT/INPUT) instead
 * of the earlier `nmcli networking off` — that disabled NetworkManager's
 * management of every interface outright, an on/off switch with no way
 * to selectively let anything through. iptables rules let loopback and
 * the control server's resolved IP(s)/port + DNS stay reachable while
 * everything else is dropped.
 *
 * Inbound: only loopback and replies to connections we ourselves
 * initiated (ESTABLISHED/RELATED) are allowed — unsolicited new inbound
 * connections stay blocked either way, matching "block internet" intent.
 *
 * @param {{ips: string[], port: number}|null} allowTarget see windows.js
 *   for the fallback semantics when this is null.
 */
async function block(allowTarget) {
  await allow(); // idempotent: clear any stale chains from a previous run first

  await sudoExec(`iptables -N ${OUT_CHAIN}`);
  await sudoExec(`iptables -A ${OUT_CHAIN} -o lo -j RETURN`);
  if (allowTarget) {
    for (const ip of allowTarget.ips) {
      await sudoExec(`iptables -A ${OUT_CHAIN} -p tcp -d ${ip} --dport ${allowTarget.port} -j RETURN`);
    }
    await sudoExec(`iptables -A ${OUT_CHAIN} -p udp --dport 53 -j RETURN`);
    await sudoExec(`iptables -A ${OUT_CHAIN} -p tcp --dport 53 -j RETURN`);
  }
  await sudoExec(`iptables -A ${OUT_CHAIN} -j DROP`);
  await sudoExec(`iptables -I OUTPUT 1 -j ${OUT_CHAIN}`);

  await sudoExec(`iptables -N ${IN_CHAIN}`);
  await sudoExec(`iptables -A ${IN_CHAIN} -i lo -j RETURN`);
  await sudoExec(`iptables -A ${IN_CHAIN} -m state --state ESTABLISHED,RELATED -j RETURN`);
  await sudoExec(`iptables -A ${IN_CHAIN} -j DROP`);
  await sudoExec(`iptables -I INPUT 1 -j ${IN_CHAIN}`);
}

async function allow() {
  await sudoExec(`iptables -D OUTPUT -j ${OUT_CHAIN}`).catch(() => {});
  await sudoExec(`iptables -F ${OUT_CHAIN}`).catch(() => {});
  await sudoExec(`iptables -X ${OUT_CHAIN}`).catch(() => {});
  await sudoExec(`iptables -D INPUT -j ${IN_CHAIN}`).catch(() => {});
  await sudoExec(`iptables -F ${IN_CHAIN}`).catch(() => {});
  await sudoExec(`iptables -X ${IN_CHAIN}`).catch(() => {});
}

async function isBlocked() {
  try {
    await run(`iptables -L ${OUT_CHAIN} -n`);
    return true; // chain exists => we've applied a block
  } catch (_) {
    return false; // chain doesn't exist => not blocked
  }
}

module.exports = { block, allow, isBlocked };
