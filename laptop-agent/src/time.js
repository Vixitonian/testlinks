"use strict";

/**
 * DATETIME columns store the literal string sent, with no timezone
 * conversion — so as long as this always writes UTC, "online" comparisons
 * done elsewhere (the phone app) stay correct regardless of the
 * underlying DB's configured timezone.
 */
function nowMysqlUtc() {
  return toMysqlUtc(new Date());
}

/** Same format as nowMysqlUtc(), for an arbitrary Date instead of "now" —
 *  used to report a browser history entry's actual last-visit time. */
function toMysqlUtc(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { nowMysqlUtc, toMysqlUtc };
