"use strict";
const supabein = require("../supabein");
const { nowMysqlUtc } = require("../time");

function badRequest(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

/**
 * Called once by the agent at startup. Upsert keyed on device_uuid — the
 * agent calls this every launch, so this must stay safe to repeat.
 */
module.exports = async function register(body) {
  const { device_uuid, hostname, platform } = body;
  if (!device_uuid || !hostname || !platform) {
    throw badRequest("Missing required field: device_uuid, hostname, platform");
  }

  const patch = {
    hostname,
    platform,
    os_release: body.osRelease || "",
    username: body.username || "",
    last_seen: nowMysqlUtc()
  };

  const existing = await supabein.findOne("devices", { device_uuid });
  if (existing) {
    await supabein.update("devices", existing.id, patch);
  } else {
    await supabein.insert("devices", { device_uuid, internet_blocked: false, ...patch });
  }
  return { ok: true };
};
