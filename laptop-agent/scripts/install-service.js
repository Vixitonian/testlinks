"use strict";
/**
 * Installs the Laptop Agent as a genuine Windows Service — SYSTEM-level,
 * starts at boot (before anyone logs in), and requires admin credentials
 * to stop/uninstall via the Services Control Manager. This is the
 * tamper-resistant install path for a standard (non-admin) child account:
 * unlike the per-user Electron app (src/main.js), a service isn't tied to
 * a login session, so it can't be avoided by simply not launching it, and
 * a standard user has no permission to stop or remove it.
 *
 * It stays honestly named and fully visible: "Laptop Agent" in
 * services.msc, Task Manager's Services tab, and `sc query`. Nothing
 * about this hides the service or disguises what it is — only the
 * ProgramData config/log folder's permissions are locked down (below), so
 * a standard user can't hand-edit config.json to defeat it.
 *
 * Must be run from an elevated (Run as Administrator) terminal.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

if (process.platform !== "win32") {
  console.error("install-service.js installs a Windows Service — run it on Windows.");
  process.exit(1);
}

const SERVICE_NAME = "Laptop Agent";
const DATA_DIR = path.join(process.env.ProgramData || "C:\\ProgramData", "Laptop Agent");

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
  description:
    "Identifies this device, connects directly to SupaBein, and applies Block/Allow " +
    "internet commands. Visible in Services and Task Manager as \"Laptop Agent\".",
  script: path.join(__dirname, "..", "src", "service-main.js")
});

svc.on("install", () => {
  console.log(`Service "${SERVICE_NAME}" installed.`);
  hardenDataDir();
  svc.start();
});

svc.on("start", () => {
  console.log(`Service "${SERVICE_NAME}" started. Check services.msc to confirm — it should show as "Running".`);
  process.exit(0);
});

svc.on("alreadyinstalled", () => {
  console.log(`Service "${SERVICE_NAME}" is already installed.`);
  hardenDataDir();
  process.exit(0);
});

svc.on("invalidinstallation", () => {
  console.error(`Service "${SERVICE_NAME}" has a broken/partial prior installation. Run uninstall-service.js first.`);
  process.exit(1);
});

svc.on("error", (err) => {
  console.error("node-windows reported an error:", err);
  process.exit(1);
});

console.log(`Installing "${SERVICE_NAME}" as a Windows Service (requires admin)...`);
svc.install();

/**
 * Removes inherited permissions on the ProgramData config/log folder and
 * grants access only to SYSTEM (the account the service runs as) and
 * Administrators. A standard user account then gets Access Denied trying
 * to open, read, or edit config.json/device.json/logs — they can see the
 * folder exists (nothing here hides it), just not touch what's inside.
 * Uses well-known SIDs (S-1-5-18 = SYSTEM, S-1-5-32-544 = Administrators)
 * instead of localized group names so this works on non-English Windows too.
 */
function hardenDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    execFileSync("icacls", [DATA_DIR, "/inheritance:r"], { stdio: "inherit" });
    execFileSync(
      "icacls",
      [DATA_DIR, "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F"],
      { stdio: "inherit" }
    );
    console.log(`Locked down ${DATA_DIR} to SYSTEM + Administrators only.`);
  } catch (e) {
    console.error(`Warning: could not harden permissions on ${DATA_DIR}: ${e.message}`);
    console.error("The service will still run, but a standard user may be able to edit its config.");
  }
}
