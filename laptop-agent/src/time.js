"use strict";

/**
 * DATETIME columns store the literal string sent, with no timezone
 * conversion — so as long as this always writes UTC, "online" comparisons
 * done elsewhere (the phone app) stay correct regardless of the
 * underlying DB's configured timezone.
 */
function nowMysqlUtc() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { nowMysqlUtc };
