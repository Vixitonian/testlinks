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
 * Uses NetworkManager's global switch. Same all-or-nothing tradeoff as
 * the other platforms — see README for the auto-revert safety timer.
 * Requires NetworkManager (nmcli) to be present; most desktop distros
 * ship it by default, but minimal/server installs may not.
 */
async function block() {
  await sudoExec("nmcli networking off");
}

async function allow() {
  await sudoExec("nmcli networking on");
}

async function isBlocked() {
  try {
    const out = await run("nmcli networking connectivity");
    return out.trim().toLowerCase() === "none";
  } catch (_) {
    return false;
  }
}

module.exports = { block, allow, isBlocked };
