"use strict";
const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");

const ICONS = {
  connected: path.join(__dirname, "..", "assets", "tray-connected.png"),
  blocked: path.join(__dirname, "..", "assets", "tray-blocked.png"),
  disconnected: path.join(__dirname, "..", "assets", "tray-disconnected.png")
};

/**
 * The primary UI for a background agent: a tray icon whose color reflects
 * current status at a glance, plus a menu for the actions the phone app
 * will eventually trigger remotely. Kept intentionally named and visible
 * ("Laptop Agent") — this is meant to be known-present on the machine,
 * never disguised as something else.
 */
function createTray({ state, controller, onOpenDashboard, onAllowRequest, onQuitRequest }) {
  const iconFor = (snap) => {
    if (snap.internetBlocked) return ICONS.blocked;
    if (snap.connectionStatus === "connected") return ICONS.connected;
    return ICONS.disconnected;
  };

  const tray = new Tray(nativeImage.createFromPath(iconFor(state.snapshot())));
  tray.setToolTip("Laptop Agent");

  function render() {
    const snap = state.snapshot();
    tray.setImage(nativeImage.createFromPath(iconFor(snap)));

    const statusLabel = snap.internetBlocked
      ? "Internet: BLOCKED"
      : "Internet: Allowed";
    const connLabel = `Server: ${snap.connectionStatus}`;

    const menu = Menu.buildFromTemplate([
      { label: `Laptop Agent — ${snap.device.hostname}`, enabled: false },
      { label: statusLabel, enabled: false },
      { label: connLabel, enabled: false },
      { type: "separator" },
      {
        label: "Block Internet",
        enabled: !snap.internetBlocked,
        click: () => controller.applyCommand("BLOCK", "tray")
      },
      {
        label: "Allow Internet (passphrase required)",
        enabled: snap.internetBlocked,
        click: onAllowRequest
      },
      { type: "separator" },
      { label: "Open Dashboard", click: onOpenDashboard },
      { label: "Quit Laptop Agent", click: onQuitRequest }
    ]);
    tray.setContextMenu(menu);
  }

  state.on("change", render);
  render();
  tray.on("click", onOpenDashboard);

  return tray;
}

module.exports = { createTray };
