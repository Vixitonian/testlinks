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
    baseUrl: config.get("serverBaseUrl"),
    apiKey: config.get("apiKey"),
    device,
    state,
    controller,
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
    onQuitRequest: openQuitPrompt
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
  ipcMain.handle("action:block", () => controller.applyCommand("BLOCK", "dashboard"));
  ipcMain.handle("action:allow", () => controller.applyCommand("ALLOW", "dashboard"));
  ipcMain.handle("passphrase:verify", (_evt, pass) => ({ ok: config.checkPassphrase(pass) }));

  ipcMain.on("quit:confirmed", () => {
    quitApproved = true;
    logger.info("Quit approved via passphrase prompt");
    app.quit();
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

function openQuitPrompt() {
  if (promptWin && !promptWin.isDestroyed()) {
    promptWin.show();
    promptWin.focus();
    return;
  }
  promptWin = new BrowserWindow({
    width: 340,
    height: 260,
    resizable: false,
    title: "Confirm Quit",
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
  promptWin.on("closed", () => { promptWin = null; });
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
