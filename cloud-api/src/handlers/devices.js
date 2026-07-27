"use strict";
const supabein = require("../supabein");
const config = require("../config");
const { parseMysqlUtc } = require("../time");

const IN_FLIGHT_STATUSES = new Set(["pending", "delivered"]);

/**
 * For the phone app's device list. Not called by the agent.
 *
 * internet_blocked reflects what the device itself last reported via
 * heartbeat — sending a command doesn't flip it immediately, since the
 * device might take up to its poll interval to pick the command up, or
 * the underlying OS action could fail. So each device also carries its
 * most recent command's status, letting the UI show "Blocking…" while
 * a command is in flight rather than silently reverting to the old
 * status with no explanation.
 */
module.exports = async function devices() {
  const rows = await supabein.list("devices", {}, { order: "last_seen.desc", limit: 200 });
  const now = Date.now();
  const thresholdMs = config.onlineThresholdSeconds * 1000;

  const result = [];
  for (const d of rows) {
    const lastSeen = parseMysqlUtc(d.last_seen);
    const lastCmd = await supabein.findOne("commands", { device_uuid: d.device_uuid }, { order: "id.desc" });

    result.push({
      device_uuid: d.device_uuid,
      hostname: d.hostname,
      platform: d.platform,
      username: d.username,
      internet_blocked: !!d.internet_blocked,
      last_seen: d.last_seen,
      online: lastSeen !== null && now - lastSeen.getTime() <= thresholdMs,
      pending_command: lastCmd && IN_FLIGHT_STATUSES.has(lastCmd.status) ? lastCmd.command : null,
      last_command_failed: lastCmd && lastCmd.status === "failed"
        ? { command: lastCmd.command, error: lastCmd.error }
        : null
    });
  }
  return { ok: true, devices: result };
};
