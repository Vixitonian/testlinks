#!/usr/bin/env node
"use strict";
/**
 * One-time setup helper: resolves the cloud server's current IP(s) and
 * prints the config.json fields to paste in, so BLOCK can allow-list a
 * fixed, hardcoded destination instead of doing a live DNS lookup every
 * time. Re-run this and update config.json if the server's IP ever
 * changes (e.g. after moving hosts).
 *
 * Usage: node scripts/resolve-server-ips.js <serverBaseUrl>
 */
const { resolveAllowTarget } = require("../src/network/target");

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/resolve-server-ips.js <serverBaseUrl>");
  console.error("Example: node scripts/resolve-server-ips.js https://your-api.example.com");
  process.exit(1);
}

resolveAllowTarget(url)
  .then((target) => {
    console.log(`Resolved ${target.hostname} -> ${target.ips.join(", ")} (port ${target.port})`);
    console.log("\nAdd these fields to config.json:");
    console.log(JSON.stringify({ serverAllowIps: target.ips, serverAllowPort: target.port }, null, 2));
  })
  .catch((e) => {
    console.error(`Could not resolve ${url}: ${e.message}`);
    process.exit(1);
  });
