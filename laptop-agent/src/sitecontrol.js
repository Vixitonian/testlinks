"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const MARKER_START = "# BEGIN LAPTOP-AGENT SITE BLOCKS";
const MARKER_END = "# END LAPTOP-AGENT SITE BLOCKS";

// Deliberately strict: a bare hostname only (letters, digits, hyphens,
// dots), no leading/trailing dot, no whitespace of any kind — this value
// comes from the `site_blocks` table, which anon can INSERT into (see
// README's "Custom site blocking" section), and gets written verbatim
// into a line of the hosts file. Without this check, a value containing
// e.g. a newline could inject an unrelated extra hosts-file entry
// (redirecting some other domain) rather than just blocking the one it
// claims to. Reject anything that isn't a plain, single-line hostname.
const SAFE_DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

function hostsFilePath() {
  if (process.platform === "win32") {
    return path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts");
  }
  return "/etc/hosts";
}

/**
 * Rewrites just the managed block in the OS hosts file to redirect the
 * given domains (and their www. variant) to 0.0.0.0, leaving everything
 * else in the file untouched. Called with the current desired list every
 * time it changes (see connection.js's site-block sync) — always a full
 * replace of the managed block, never an incremental edit, so it can
 * never drift from what's actually configured. `filePathOverride` exists
 * only for tests — production always calls this with just (domains,
 * logger), which uses the real OS hosts file via hostsFilePath().
 */
function applyBlockedSites(domains, logger, filePathOverride) {
  const file = filePathOverride || hostsFilePath();
  const safe = (domains || []).filter((d) => {
    const ok = typeof d === "string" && SAFE_DOMAIN.test(d.toLowerCase());
    if (!ok) logger.warn(`Ignoring unsafe/invalid domain in site_blocks: ${JSON.stringify(d)}`);
    return ok;
  });

  let current = "";
  try {
    current = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`Could not read hosts file (${file}): ${e.message}`);
  }

  const startIdx = current.indexOf(MARKER_START);
  const endIdx = current.indexOf(MARKER_END);
  let withoutBlock = current;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    withoutBlock = current.slice(0, startIdx) + current.slice(endIdx + MARKER_END.length);
  }
  withoutBlock = withoutBlock.replace(/\n{3,}/g, "\n\n").trimEnd();

  let next = withoutBlock;
  if (safe.length > 0) {
    const lines = [MARKER_START];
    for (const domain of safe) {
      // Both address families — a dual-stack site (most major ones are)
      // resolving via AAAA/IPv6 would otherwise sail straight past an
      // IPv4-only block. 0.0.0.0 for v4 (an invalid/unreachable
      // destination), ::1 for v6 (loopback — connection refused if
      // nothing's listening there, same practical effect).
      for (const host of [domain, `www.${domain}`]) {
        lines.push(`0.0.0.0 ${host}`);
        lines.push(`::1 ${host}`);
      }
    }
    lines.push(MARKER_END);
    next = `${withoutBlock}\n\n${lines.join("\n")}\n`;
  } else {
    next = `${withoutBlock}\n`;
  }

  fs.writeFileSync(file, next, "utf8");
  flushDnsCache(logger);
  logger.info(`Site blocks applied: ${safe.length} domain(s) blocked.`);
}

/** A hosts-file edit alone doesn't evict already-cached DNS answers — a
 *  domain resolved (and cached) before the block was added would keep
 *  working until that cache entry naturally expires otherwise. Flushing
 *  right after every write makes the block take effect immediately. */
function flushDnsCache(logger) {
  if (process.platform !== "win32") return; // macOS/Linux flush commands vary too much to guess safely — not attempted
  execFile("ipconfig", ["/flushdns"], (err) => {
    if (err) logger.warn(`Could not flush DNS cache after applying site blocks: ${err.message}`);
  });
}

module.exports = { applyBlockedSites, hostsFilePath };
