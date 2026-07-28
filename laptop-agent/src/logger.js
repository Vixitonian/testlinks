"use strict";
const fs = require("fs");
const path = require("path");

/**
 * Minimal rotating file + console logger. No external deps so the agent
 * has as few moving parts as possible in its most privileged code path.
 */
class Logger {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "agent.log");
    this._rotateIfLarge();
  }

  _rotateIfLarge() {
    try {
      const st = fs.statSync(this.file);
      if (st.size > 2 * 1024 * 1024) {
        fs.renameSync(this.file, this.file + ".1");
      }
    } catch (_) {
      /* file doesn't exist yet — nothing to rotate */
    }
  }

  _write(level, msg) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
    console.log(line);
    try {
      fs.appendFileSync(this.file, line + "\n");
    } catch (_) {
      /* best-effort; never let logging crash the agent */
    }
  }

  info(msg) { this._write("INFO", msg); }
  warn(msg) { this._write("WARN", msg); }
  error(msg) { this._write("ERROR", msg); }
}

module.exports = { Logger };
