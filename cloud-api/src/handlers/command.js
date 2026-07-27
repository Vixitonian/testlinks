"use strict";
const supabein = require("../supabein");

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

const ALLOWED_COMMANDS = ["BLOCK", "ALLOW"];

/** For the phone app: enqueues a command for a device's next heartbeat to pick up. */
module.exports = async function command(body) {
  const { device_uuid } = body;
  const cmd = String(body.command || "").toUpperCase();

  if (!device_uuid || !ALLOWED_COMMANDS.includes(cmd)) {
    throw badRequest(`device_uuid is required and command must be one of: ${ALLOWED_COMMANDS.join(", ")}`);
  }

  const device = await supabein.findOne("devices", { device_uuid });
  if (!device) throw notFound("Unknown device_uuid");

  const row = await supabein.insert("commands", { device_uuid, command: cmd, status: "pending" });
  return { ok: true, id: row.id };
};
