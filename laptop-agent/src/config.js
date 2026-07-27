"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULTS = {
  // Base URL of the cloud server's API, no trailing slash. Hardcoded to
  // this project's live deployment (../cloud-api on Render) so a fresh
  // install works immediately with no manual config editing — matching
  // the same choice made for the phone app. Point this elsewhere by
  // editing config.json if you deploy your own cloud-api instance.
  serverBaseUrl: "https://device-control-cloud-api.onrender.com",
  // Must match the live deployment's DEVICE_API_KEY.
  apiKey: "3d3dfa275d869feae65519a868b5d5646309ea51d5fbcceb55c4e7a99f65fbd2",
  // How often to poll the server, in milliseconds. Lower = commands
  // arrive faster; higher = fewer requests against the server.
  pollIntervalMs: 10000,
  // Hardcoded IP(s) + port to allow-list when BLOCK is applied, so the
  // agent's own connection to the server survives being "blocked" (see
  // README's "Blocking allow-lists the control server" section). Static
  // rather than resolved via DNS at block-time — simpler and more
  // predictable, at the cost of needing a manual update if the server's
  // IP ever changes. Regenerate with:
  //   node scripts/resolve-server-ips.js <serverBaseUrl>
  serverAllowIps: ["216.24.57.7", "216.24.57.15"],
  serverAllowPort: 443,
  // Passphrase required to quit the agent or open the local dashboard's
  // unblock action from an untrusted user's perspective. This is NOT a
  // substitute for the server-side control plane.
  quitPassphraseHash: hash("ifyobiekwe2026"),
  // Safety net: if a BLOCK is applied, it also cuts the agent's own
  // connection to the server (see README), so a remote ALLOW can't arrive
  // until a firewall allow-list punch-through exists server-side.
  // Automatically lift the block after this many minutes so a laptop can
  // never be stranded offline indefinitely.
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
    if (!existed) this.save(); // persist defaults so the file is there to hand-edit (e.g. serverBaseUrl)
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
