"use strict";
const dns = require("dns");
const { URL } = require("url");

/**
 * Resolves the cloud server's current IP address(es) + port, fresh at
 * block-time (not cached — cloud hosts can rotate IPs), so the platform
 * network modules can allow-list exactly that destination instead of
 * cutting the agent's own connection along with everything else.
 *
 * Deliberately not re-checked periodically while a block is active: if
 * the server's IP changes mid-block, the agent falls back on the
 * auto-revert timer rather than staying stranded forever, but a true fix
 * for that edge case (periodic re-resolution) isn't built — see README.
 */
async function resolveAllowTarget(serverBaseUrl) {
  const url = new URL(serverBaseUrl);
  const port = url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80);

  const ips = new Set();
  const { address } = await dns.promises.lookup(url.hostname);
  ips.add(address);
  try {
    (await dns.promises.resolve4(url.hostname)).forEach((ip) => ips.add(ip));
  } catch (_) {
    /* host may be IPv6-only or resolve4 unsupported here — lookup() above still stands */
  }

  return { hostname: url.hostname, ips: [...ips], port };
}

module.exports = { resolveAllowTarget };
