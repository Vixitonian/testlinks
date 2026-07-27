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
 * Called by the agent right after attempting a delivered command. Scoped
 * to device_uuid AND id together (SupaBein filters are AND-only, which is
 * exactly what we want here) so one device can never ack another's
 * command id.
 */
module.exports = async function ack(body) {
  const { device_uuid, command_id } = body;
  if (!device_uuid || command_id === undefined || command_id === null) {
    throw badRequest("Missing required field: device_uuid, command_id");
  }

  const cmd = await supabein.findOne("commands", { device_uuid, id: command_id });
  if (!cmd) throw notFound("Command not found for this device");

  await supabein.update("commands", cmd.id, {
    status: body.ok ? "acked" : "failed",
    acked_at: nowMysqlUtc(),
    error: body.error || null
  });
  return { ok: true };
};
