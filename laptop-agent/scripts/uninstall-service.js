"use strict";
/**
 * Uninstalls the Windows Service installed by install-service.js. Requires
 * admin credentials, same as install — a standard user account cannot run
 * this successfully, which is the point.
 */
const path = require("path");

if (process.platform !== "win32") {
  console.error("uninstall-service.js removes a Windows Service — run it on Windows.");
  process.exit(1);
}

const SERVICE_NAME = "Laptop Agent";

let Service;
try {
  Service = require("node-windows").Service;
} catch (_) {
  console.error(
    "node-windows isn't installed. From an elevated terminal, run:\n" +
    "  npm install node-windows --no-save\n" +
    "then re-run this script."
  );
  process.exit(1);
}

const svc = new Service({
  name: SERVICE_NAME,
  script: path.join(__dirname, "..", "src", "service-main.js")
});

svc.on("uninstall", () => {
  console.log(`Service "${SERVICE_NAME}" uninstalled.`);
  console.log(
    "Note: the ProgramData\\Laptop Agent folder (config.json, device.json, logs) was left in " +
    "place. Delete it manually (as Administrator) if you want to fully remove all traces."
  );
  process.exit(0);
});

svc.on("alreadyuninstalled", () => {
  console.log(`Service "${SERVICE_NAME}" was not installed — nothing to do.`);
  process.exit(0);
});

svc.on("error", (err) => {
  console.error("node-windows reported an error:", err);
  process.exit(1);
});

console.log(`Uninstalling "${SERVICE_NAME}" (requires admin)...`);
svc.uninstall();
