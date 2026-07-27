"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULTS = {
  // Point this at the cloud server once it exists. ws:// for local dev,
  // wss:// for anything crossing a real network.
  serverUrl: "ws://localhost:8787/agent",
  // Passphrase required to quit the agent or open the local dashboard's
  // unblock action from an untrusted user's perspective. Change this on
  // first run — it is NOT a substitute for the server-side control plane.
  quitPassphraseHash: hash("changeme"),
  // Safety net: if a BLOCK is applied and the agent can't reach the server
  // (which is expected, since blocking cuts its own connection too, until
  // the server-side allowlist punch-through described in the README
  // exists), automatically lift the block after this many minutes so a
  // laptop can never be stranded offline indefinitely.
  autoRevertMinutes: 60
};

function hash(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

class Config {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, "config.json");
    const existed = fs.existsSync(this.file);
    this.data = this._load();
    if (!existed) this.save(); // persist defaults so the file is there to hand-edit (e.g. serverUrl)
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf8");
  }

  get(key) { return this.data[key]; }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  checkPassphrase(candidate) {
    return hash(candidate) === this.data.quitPassphraseHash;
  }

  setPassphrase(newPassphrase) {
    this.set("quitPassphraseHash", hash(newPassphrase));
  }
}

module.exports = { Config, hash };
