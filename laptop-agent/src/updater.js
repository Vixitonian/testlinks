"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const supabein = require("./supabein");
const { AGENT_VERSION } = require("./version");

const SRC_DIR = __dirname;
const BACKUP_ROOT = path.join(SRC_DIR, ".backups");

// Only plain relative filenames under src/ (optionally one subfolder deep,
// e.g. "network/windows.js") ending in .js — rejects anything with ".."
// or an absolute/drive-letter path outright, before it ever touches fs.
const SAFE_PATH = /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)?\.js$/;

/**
 * Checks the anon-SELECT-only `agent_releases` table for a version newer
 * than the one currently running, and applies it if found. See README's
 * "Self-updating service" section for the full design and its security
 * boundary: anon access to this table is read-only (verified — see the
 * table's SupaBein policies), so publishing a release requires the
 * project owner's PAT, not just knowing this table exists. The SHA-256
 * check here is a data-integrity check (catches corruption or a botched
 * publish), not an authentication mechanism — the anon-INSERT-denied
 * policy is what actually gates who can ship code.
 *
 * On success, exits the process (code 0) so the service wrapper
 * (node-windows' wrapper.js) relaunches it — the fresh process picks up
 * the newly-written files, since Node's module cache doesn't carry over
 * to a new process. Never throws; every failure path just logs and
 * leaves the current install untouched.
 */
async function checkForUpdate(logger) {
  let latest;
  try {
    latest = await supabein.findOne("agent_releases", {}, { order: "id.desc" });
  } catch (e) {
    logger.warn(`Update check failed: ${e.message}`);
    return;
  }
  if (!latest) return; // nothing published yet
  if (latest.version === AGENT_VERSION) return; // already current

  logger.info(`Update available: ${AGENT_VERSION} -> ${latest.version}`);

  const expectedHash = crypto.createHash("sha256").update(latest.manifest, "utf8").digest("hex");
  if (expectedHash !== latest.sha256) {
    logger.warn(
      `Update ${latest.version} rejected: manifest hash mismatch ` +
      `(expected ${latest.sha256}, computed ${expectedHash}) — not applying.`
    );
    return;
  }

  let files;
  try {
    files = JSON.parse(latest.manifest);
    if (!Array.isArray(files)) throw new Error("manifest is not an array");
  } catch (e) {
    logger.warn(`Update ${latest.version} rejected: invalid manifest JSON (${e.message}).`);
    return;
  }

  const decoded = [];
  for (const entry of files) {
    if (!entry || typeof entry.path !== "string" || typeof entry.content !== "string") {
      logger.warn(`Update ${latest.version} rejected: malformed manifest entry.`);
      return;
    }
    if (!SAFE_PATH.test(entry.path)) {
      logger.warn(`Update ${latest.version} rejected: unsafe file path "${entry.path}".`);
      return;
    }
    const destPath = path.resolve(SRC_DIR, entry.path);
    if (!destPath.startsWith(SRC_DIR + path.sep)) {
      logger.warn(`Update ${latest.version} rejected: path "${entry.path}" escapes src/.`);
      return;
    }
    let content;
    try {
      content = Buffer.from(entry.content, "base64").toString("utf8");
    } catch (e) {
      logger.warn(`Update ${latest.version} rejected: bad base64 for "${entry.path}".`);
      return;
    }
    try {
      new vm.Script(content, { filename: entry.path }); // syntax check only, never executed
    } catch (e) {
      logger.warn(`Update ${latest.version} rejected: "${entry.path}" has a syntax error (${e.message}).`);
      return;
    }
    decoded.push({ destPath, content });
  }

  if (decoded.length === 0) {
    logger.warn(`Update ${latest.version} rejected: manifest listed no files.`);
    return;
  }

  try {
    backupCurrentFiles(decoded, latest.version);

    // Write to temp files first, then rename all at once — if any single
    // write fails partway through, nothing already-applied gets replaced,
    // so a disk error can't leave a half-updated, broken file set.
    const staged = decoded.map(({ destPath, content }) => {
      const tmpPath = destPath + ".updating";
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(tmpPath, content, "utf8");
      return { tmpPath, destPath };
    });
    for (const { tmpPath, destPath } of staged) {
      fs.renameSync(tmpPath, destPath);
    }
  } catch (e) {
    logger.warn(`Update ${latest.version} failed while writing files: ${e.message}. Backup is in ${BACKUP_ROOT}.`);
    return;
  }

  logger.info(`Update ${latest.version} applied (${decoded.length} file(s)). Restarting to load it...`);
  process.exit(0);
}

/** Copies the current on-disk version of every file about to be replaced
 *  into a timestamped folder, so a bad update can be manually rolled back
 *  (not automatic — see README's stated limitation). */
function backupCurrentFiles(decoded, newVersion) {
  const dir = path.join(BACKUP_ROOT, `${new Date().toISOString().replace(/[:.]/g, "-")}_to-${newVersion}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const { destPath } of decoded) {
    if (!fs.existsSync(destPath)) continue;
    const rel = path.relative(SRC_DIR, destPath);
    const backupPath = path.join(dir, rel);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(destPath, backupPath);
  }
}

module.exports = { checkForUpdate };
