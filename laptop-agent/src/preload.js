"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agent", {
  getState: () => ipcRenderer.invoke("state:get"),
  onStateChange: (cb) => ipcRenderer.on("state:changed", (_evt, snap) => cb(snap)),
  // Block is ungated — restricting internet needs no confirmation.
  block: () => ipcRenderer.invoke("action:block"),
  // Allow is passphrase-gated: this opens the same prompt the tray menu
  // uses instead of applying ALLOW directly (see main.js).
  requestAllow: () => ipcRenderer.send("action:requestAllow"),
  getPromptPurpose: () => ipcRenderer.invoke("prompt:getPurpose"),
  onPromptPurposeChanged: (cb) => ipcRenderer.on("prompt:purposeChanged", (_evt, purpose) => cb(purpose)),
  verifyPassphrase: (pass) => ipcRenderer.invoke("passphrase:verify", pass),
  confirmAction: () => ipcRenderer.send("action:confirmed"),
  closeThisWindow: () => ipcRenderer.send("window:close")
});
