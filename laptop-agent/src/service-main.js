"use strict";
const path = require("path");
const os = require("os");

const { Logger } = require("./logger");
const { Config } = require("./config");
const { loadOrCreateDevice } = require("./device");
const { AgentState } = require("./state");
const { Controller } = require("./controller");
const { Connection } = require("./connection");

/**
 * Headless entry point for running as a genuine Windows Service (see
 * scripts/install-service.js), instead of the per-user Electron app
 * (src/main.js). No tray icon, no dashboard window, no passphrase-gated
 * quit UI — a service in Session 0 can't show any of that anyway, and a
 * standard user account has no way to stop a SYSTEM-owned service without
 * admin credentials, so none of that per-user tamper-deterrence is needed
 * here. Reuses every core module unchanged from the Electron build.
 */
function getDataDir() {
  if (process.platform === "win32") {
    return path.join(process.env.ProgramData || "C:\\ProgramData", "Laptop Agent");
  }
  // Non-Windows fallback, for running/testing this entry point outside a
  // real Windows Service. The actual service install always uses
  // ProgramData above.
  return path.join(os.homedir(), ".laptop-agent-service");
}

async function main() {
  const dataDir = getDataDir();
  const logger = new Logger(path.join(dataDir, "logs"));
  logger.info("Laptop Agent service starting");

  const config = new Config(dataDir);
  const device = loadOrCreateDevice(dataDir);
  logger.info(`Device identity: ${device.id} (${device.hostname}, ${device.platform})`);

  const state = new AgentState(device);
  const controller = new Controller(state, config, logger);
  await controller.init();

  const connection = new Connection({
    device,
    state,
    controller,
    config,
    logger,
    pollIntervalMs: config.get("pollIntervalMs")
  });
  connection.start();

  logger.info("Laptop Agent service ready");

  const shutdown = () => {
    logger.info("Laptop Agent service stopping");
    connection.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("Fatal error starting Laptop Agent service:", e);
  process.exit(1);
});
