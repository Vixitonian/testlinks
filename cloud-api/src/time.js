"use strict";

/**
 * DATETIME columns (unlike TIMESTAMP) store the literal string you send
 * with no timezone conversion — so as long as this server always writes
 * and reads them as UTC itself, "online" calculations stay correct
 * regardless of what timezone the underlying DB happens to be configured
 * with. Never mix this with values from anything else's clock.
 */
function nowMysqlUtc() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function parseMysqlUtc(str) {
  if (!str) return null;
  return new Date(str.replace(" ", "T") + "Z");
}

module.exports = { nowMysqlUtc, parseMysqlUtc };
