"use strict";
const fs = require("fs");
const path = require("path");

// Tiny built-in .env loader (avoids adding a dependency for this). Real
// deployments should set these as actual environment variables via the
// host's dashboard — this is purely a local-dev convenience, and only
// fills in variables that aren't already set in the environment.
function loadDotEnv() {
  const file = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

module.exports = {
  port: Number(process.env.PORT) || 8080,
  supabeinBase: (process.env.SUPABEIN_BASE || "https://supabein.dxinnovationhub.com/api/v1").replace(/\/+$/, ""),
  supabeinProjectId: required("SUPABEIN_PROJECT_ID"),
  supabeinToken: required("SUPABEIN_TOKEN"),
  deviceApiKey: required("DEVICE_API_KEY"),
  adminApiKey: required("ADMIN_API_KEY"),
  onlineThresholdSeconds: Number(process.env.ONLINE_THRESHOLD_SECONDS) || 30
};
