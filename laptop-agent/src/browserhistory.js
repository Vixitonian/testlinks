"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

// Built into Node (v22.5+), no external dependency — matches this
// project's zero-npm-dependency-at-runtime design. Experimental per
// Node's own docs; used here for a single, simple read-only SELECT, the
// lowest-risk way to depend on an experimental API.
let DatabaseSync = null;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (_) {
  // Older Node without node:sqlite — history reporting just no-ops (see
  // collectDomainVisits below), everything else keeps working.
}

const CHROME_EPOCH_OFFSET_MS = 11644473600000; // ms between 1601-01-01 and 1970-01-01

function chromeTimeToDate(chromeMicroseconds) {
  if (!chromeMicroseconds) return null;
  // Chrome's own values here (~1.3e16) exceed Number.MAX_SAFE_INTEGER, so
  // node:sqlite returns them as BigInt (see setReadBigInts below) rather
  // than silently losing precision. Converting that BigInt to Number here
  // loses only sub-microsecond precision, irrelevant at the
  // day/hour granularity this is actually used at.
  const micros = typeof chromeMicroseconds === "bigint" ? Number(chromeMicroseconds) : chromeMicroseconds;
  return new Date(micros / 1000 - CHROME_EPOCH_OFFSET_MS);
}

/** Finds every Chrome/Edge profile's History file across all local user
 *  accounts — a SYSTEM-level service isn't tied to one logged-in user,
 *  so it has to look across `C:\Users\*` rather than just process.env. */
function findHistoryFiles() {
  if (process.platform !== "win32") return []; // see README's known gap for macOS/Linux
  const usersDir = "C:\\Users";
  let usernames = [];
  try {
    usernames = fs.readdirSync(usersDir);
  } catch (_) {
    return [];
  }

  const browserUserDataDirs = [];
  for (const username of usernames) {
    browserUserDataDirs.push(
      path.join(usersDir, username, "AppData", "Local", "Google", "Chrome", "User Data"),
      path.join(usersDir, username, "AppData", "Local", "Microsoft", "Edge", "User Data")
    );
  }

  const historyFiles = [];
  for (const userDataDir of browserUserDataDirs) {
    let profileDirs = [];
    try {
      profileDirs = fs.readdirSync(userDataDir).filter((d) => d === "Default" || /^Profile \d+$/.test(d));
    } catch (_) {
      continue; // browser not installed for this user, or path doesn't exist
    }
    for (const profile of profileDirs) {
      const historyPath = path.join(userDataDir, profile, "History");
      if (fs.existsSync(historyPath)) historyFiles.push(historyPath);
    }
  }
  return historyFiles;
}

/** Reads one History file's urls table into {domain -> {visitCount, lastVisitAt}}.
 *  Copies to a temp file first — Chrome holds its own lock on the live
 *  file while running, and a straight copy sidesteps that far more often
 *  than opening it directly would (best-effort: if Chrome is mid-write at
 *  the exact moment of the copy, this cycle just misses it and picks it
 *  up on the next scheduled check — see README's known limitation). */
function readHistoryFile(historyPath, logger) {
  if (!DatabaseSync) return new Map();
  const tmpPath = path.join(os.tmpdir(), `laptop-agent-history-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  const perDomain = new Map();
  try {
    fs.copyFileSync(historyPath, tmpPath);
    const db = new DatabaseSync(tmpPath, { readOnly: true });
    try {
      const stmt = db.prepare("SELECT url, visit_count, last_visit_time FROM urls");
      // last_visit_time (microseconds since 1601-01-01) exceeds
      // Number.MAX_SAFE_INTEGER for any modern date — without this,
      // node:sqlite throws instead of silently truncating.
      stmt.setReadBigInts(true);
      const rows = stmt.all();
      for (const row of rows) {
        let hostname;
        try {
          hostname = new URL(row.url).hostname.toLowerCase().replace(/^www\./, "");
        } catch (_) {
          continue; // not a well-formed URL — skip rather than guess
        }
        if (!hostname) continue;
        const visitCount = Number(row.visit_count) || 0;
        const lastVisit = chromeTimeToDate(row.last_visit_time);
        const existing = perDomain.get(hostname);
        if (existing) {
          existing.visitCount += visitCount;
          if (lastVisit && (!existing.lastVisitAt || lastVisit > existing.lastVisitAt)) {
            existing.lastVisitAt = lastVisit;
          }
        } else {
          perDomain.set(hostname, { visitCount, lastVisitAt: lastVisit });
        }
      }
    } finally {
      db.close();
    }
  } catch (e) {
    logger.warn(`Could not read browser history at ${historyPath}: ${e.message}`);
  } finally {
    fs.rm(tmpPath, { force: true }, () => {});
  }
  return perDomain;
}

/** Aggregates every found profile's history into one {domain -> {visitCount, lastVisitAt}} map. */
function collectDomainVisits(logger) {
  const combined = new Map();
  if (!DatabaseSync) {
    logger.warn("node:sqlite isn't available in this Node build — skipping browser history collection.");
    return combined;
  }
  for (const historyPath of findHistoryFiles()) {
    const perDomain = readHistoryFile(historyPath, logger);
    for (const [domain, stats] of perDomain) {
      const existing = combined.get(domain);
      if (existing) {
        existing.visitCount += stats.visitCount;
        if (stats.lastVisitAt && (!existing.lastVisitAt || stats.lastVisitAt > existing.lastVisitAt)) {
          existing.lastVisitAt = stats.lastVisitAt;
        }
      } else {
        combined.set(domain, { ...stats });
      }
    }
  }
  return combined;
}

module.exports = { collectDomainVisits, findHistoryFiles, readHistoryFile, chromeTimeToDate };
