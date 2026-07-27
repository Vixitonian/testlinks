"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const { Logger } = require("./logger");
const { Config } = require("./config");
const { loadOrCreateDevice } = require("./device");
const { AgentState } = require("./state");
const { Controller } = require("./controller");
const { Connection } = require("./connection");
const { createTray } = require("./tray");
const autostart = require("./autostart");

// Only one instance of the agent should ever run per user session.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let logger, config, device, state, controller, connection, tray;
let dashboardWin = null;
let promptWin = null;
let quitApproved = false;
let promptPurpose = null; // "quit" | "allow" — which action the open passphrase prompt is for

app.on("second-instance", () => {
  openDashboard();
});

app.whenReady().then(async () => {
  const userDataDir = app.getPath("userData");
  logger = new Logger(path.join(userDataDir, "logs"));
  logger.info("Laptop Agent starting");

  config = new Config(userDataDir);
  device = loadOrCreateDevice(userDataDir);
  logger.info(`Device identity: ${device.id} (${device.hostname}, ${device.platform})`);

  state = new AgentState(device);
  controller = new Controller(state, config, logger);
  await controller.init();

  connection = new Connection({
    device,
    state,
    controller,
    config,
    logger,
    pollIntervalMs: config.get("pollIntervalMs")
  });
  connection.start();

  if (process.platform === "darwin" && app.dock) {
    app.dock.hide(); // background utility — no dock icon, but process name stays "Laptop Agent"
  }

  autostart.enable(app);

  tray = createTray({
    state,
    controller,
    onOpenDashboard: openDashboard,
    onAllowRequest: () => openPassphrasePrompt("allow"),
    onQuitRequest: () => openPassphrasePrompt("quit")
  });

  // Forward every state change to any open renderer windows.
  state.on("change", (snap) => {
    if (dashboardWin && !dashboardWin.isDestroyed()) {
      dashboardWin.webContents.send("state:changed", snap);
    }
  });

  registerIpcHandlers();

  logger.info("Laptop Agent ready");
});

function registerIpcHandlers() {
  ipcMain.handle("state:get", () => state.snapshot());
  // Block is never passphrase-gated — restricting internet needs no
  // confirmation, only lifting a restriction does (see requestAllow below).
  ipcMain.handle("action:block", () => controller.applyCommand("BLOCK", "dashboard"));
  ipcMain.handle("passphrase:verify", (_evt, pass) => ({ ok: config.checkPassphrase(pass) }));
  ipcMain.handle("prompt:getPurpose", () => promptPurpose);

  // Dashboard's Allow button doesn't apply ALLOW directly — it opens the
  // same passphrase prompt the tray menu uses.
  ipcMain.on("action:requestAllow", () => openPassphrasePrompt("allow"));

  // Fired only after prompt.js has already confirmed the passphrase via
  // passphrase:verify above — this handler trusts that check happened in
  // this same trusted main process, not the renderer.
  ipcMain.on("action:confirmed", () => {
    if (promptPurpose === "quit") {
      quitApproved = true;
      logger.info("Quit approved via passphrase prompt");
      app.quit();
    } else if (promptPurpose === "allow") {
      logger.info("Allow approved via passphrase prompt");
      controller.applyCommand("ALLOW", "dashboard-passphrase");
      if (promptWin && !promptWin.isDestroyed()) promptWin.close();
    }
  });

  ipcMain.on("window:close", (evt) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    if (win) win.close();
  });
}

function openDashboard() {
  if (dashboardWin && !dashboardWin.isDestroyed()) {
    dashboardWin.show();
    dashboardWin.focus();
    return;
  }
  dashboardWin = new BrowserWindow({
    width: 380,
    height: 560,
    resizable: false,
    title: "Laptop Agent",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  dashboardWin.setMenuBarVisibility(false);
  dashboardWin.loadFile(path.join(__dirname, "ui", "dashboard.html"));
  dashboardWin.on("closed", () => { dashboardWin = null; });
}

function openPassphrasePrompt(purpose) {
  promptPurpose = purpose;
  if (promptWin && !promptWin.isDestroyed()) {
    promptWin.webContents.send("prompt:purposeChanged", purpose);
    promptWin.show();
    promptWin.focus();
    return;
  }
  promptWin = new BrowserWindow({
    width: 340,
    height: 260,
    resizable: false,
    title: purpose === "quit" ? "Confirm Quit" : "Confirm Allow Internet",
    parent: dashboardWin || undefined,
    modal: !!dashboardWin,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  promptWin.setMenuBarVisibility(false);
  promptWin.loadFile(path.join(__dirname, "ui", "prompt.html"));
  promptWin.on("closed", () => { promptWin = null; promptPurpose = null; });
}

// Background agents must survive their windows closing — only the
// approved quit path (passphrase prompt) should end the process.
app.on("window-all-closed", (evt) => {
  if (!quitApproved) evt?.preventDefault?.();
});

app.on("before-quit", () => {
  if (!quitApproved) {
    // A quit was triggered some other way (OS shutdown, Cmd+Q, etc).
    // Allow it — passphrase-gating is meant to stop casual tampering
    // via the tray menu, not to fight the OS itself.
    logger?.info("Quitting (system-initiated or approved)");
  }
});
