"use strict";
const { EventEmitter } = require("events");

/**
 * Single source of truth for what the tray icon, dashboard window, and
 * server connection all need to agree on. Emits "change" whenever any
 * field is updated so UI layers can just re-render.
 */
class AgentState extends EventEmitter {
  constructor(device) {
    super();
    this.device = device;
    this.connectionStatus = "disconnected"; // disconnected | connecting | connected
    this.internetBlocked = false;
    this.lastCommand = null;       // { command, source, at }
    this.lastError = null;
    this.autoRevertAt = null;      // ISO timestamp, or null
  }

  patch(fields) {
    Object.assign(this, fields);
    this.emit("change", this.snapshot());
  }

  snapshot() {
    return {
      device: this.device,
      connectionStatus: this.connectionStatus,
      internetBlocked: this.internetBlocked,
      lastCommand: this.lastCommand,
      lastError: this.lastError,
      autoRevertAt: this.autoRevertAt
    };
  }
}

module.exports = { AgentState };
