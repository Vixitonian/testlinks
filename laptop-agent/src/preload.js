"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agent", {
  getState: () => ipcRenderer.invoke("state:get"),
  onStateChange: (cb) => ipcRenderer.on("state:changed", (_evt, snap) => cb(snap)),
  block: () => ipcRenderer.invoke("action:block"),
  allow: () => ipcRenderer.invoke("action:allow"),
  verifyPassphrase: (pass) => ipcRenderer.invoke("passphrase:verify", pass),
  confirmQuit: () => ipcRenderer.send("quit:confirmed"),
  closeThisWindow: () => ipcRenderer.send("window:close")
});
