"use strict";
const supabein = require("../supabein");
const { nowMysqlUtc } = require("../time");

function badRequest(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}
function notFound(msg) {
  const e = new Error(msg);
  e.status = 404;
  return e;
}

/**
 * Called by the agent every pollIntervalMs. Reports status and, in the
 * same round trip, hands back at most one pending command — marking it
 * "delivered" immediately so a slow ack doesn't cause a second heartbeat
 * to redeliver the same command.
 */
module.exports = async function heartbeat(body) {
  const { device_uuid } = body;
  if (!device_uuid) throw badRequest("Missing required field: device_uuid");

  const device = await supabein.findOne("devices", { device_uuid });
  if (!device) throw notFound("Device not registered — call /register first");

  await supabein.update("devices", device.id, {
    internet_blocked: !!body.internet_blocked,
    last_seen: nowMysqlUtc()
  });

  const pending = await supabein.findOne(
    "commands",
    { device_uuid, status: "pending" },
    { order: "id.asc" }
  );
  if (!pending) return { ok: true, command: null };

  await supabein.update("commands", pending.id, { status: "delivered" });
  return { ok: true, command: { id: pending.id, command: pending.command } };
};
