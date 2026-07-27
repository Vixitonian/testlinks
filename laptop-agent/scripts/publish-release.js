#!/usr/bin/env node
"use strict";
/**
 * Publishes a new self-update release to SupaBein's agent_releases table
 * (see ../src/updater.js and ../README.md's "Self-updating service"
 * section). Bundles the exact same src/ files as
 * build-service-installer.sh (service-main.js + the core modules it
 * needs — no Electron/UI files), base64-encodes each, hashes the whole
 * manifest, and inserts one new row via the SupaBein owner PAT.
 *
 * This requires the *owner* PAT (SUPABEIN_PAT env var) — the same
 * credential the rest of this project's build/setup steps use, never
 * embedded in the shipped agent itself. Publishing a release is the one
 * privileged write this whole system has; guard that PAT accordingly.
 *
 * Usage:
 *   SUPABEIN_PAT=... node scripts/publish-release.js <version> ["notes"]
 *
 * Bump ../src/version.js's AGENT_VERSION to match <version> *before*
 * running this — the manifest published here includes version.js itself,
 * so the new version takes effect on every device once they apply it.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROJECT_ID = 79;
const BASE = "https://supabein.dxinnovationhub.com/api/v1";

const SRC_DIR = path.join(__dirname, "..", "src");
const FILES = [
  "version.js",
  "updater.js",
  "service-main.js",
  "logger.js",
  "config.js",
  "device.js",
  "state.js",
  "controller.js",
  "connection.js",
  "supabein.js",
  "time.js",
  "network/index.js",
  "network/target.js",
  "network/windows.js"
];

async function main() {
  const version = process.argv[2];
  const notes = process.argv[3] || "";
  if (!version) {
    console.error("Usage: SUPABEIN_PAT=... node scripts/publish-release.js <version> [\"notes\"]");
    process.exit(1);
  }

  const pat = process.env.SUPABEIN_PAT;
  if (!pat) {
    console.error("Missing SUPABEIN_PAT environment variable (the owner PAT — required to publish).");
    process.exit(1);
  }

  const { AGENT_VERSION } = require(path.join(SRC_DIR, "version.js"));
  if (AGENT_VERSION !== version) {
    console.error(
      `src/version.js says AGENT_VERSION="${AGENT_VERSION}", but you're publishing "${version}". ` +
      `Update src/version.js's AGENT_VERSION to "${version}" first, so the published manifest ` +
      `actually contains the version it claims to be.`
    );
    process.exit(1);
  }

  const manifestFiles = FILES.map((relPath) => {
    const abs = path.join(SRC_DIR, relPath);
    const content = fs.readFileSync(abs, "utf8");
    return { path: relPath, content: Buffer.from(content, "utf8").toString("base64") };
  });
  const manifest = JSON.stringify(manifestFiles);
  const sha256 = crypto.createHash("sha256").update(manifest, "utf8").digest("hex");

  console.log(`Publishing version ${version} (${manifestFiles.length} files, manifest sha256 ${sha256})...`);

  const res = await fetch(`${BASE}/data/${PROJECT_ID}/agent_releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pat}` },
    body: JSON.stringify({ version, manifest, sha256, notes })
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`Publish failed (${res.status}):`, body.error || body);
    process.exit(1);
  }
  console.log(`Published: release id ${body.id}, version ${body.version}.`);
  console.log("Devices running the service will pick this up within their next update-check interval.");
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
