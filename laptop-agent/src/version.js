"use strict";
// Single source of truth for the running service's version. Bumped by
// scripts/publish-release.js every time it publishes — see updater.js
// and README's "Self-updating service" section.
module.exports = { AGENT_VERSION: "1.1.0" };
