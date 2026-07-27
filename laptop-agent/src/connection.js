"use strict";
const WebSocket = require("ws");

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Keeps a persistent WebSocket to the cloud server so commands arrive in
 * near-real-time rather than on a polling interval. There is no server
 * to talk to yet in this build, so this will simply retry forever with
 * backoff and report "disconnected" — the agent is fully usable via the
 * tray menu in the meantime.
 *
 * Wire protocol (for whenever the server exists):
 *   agent -> server  {"type":"hello","device":{...}}
 *   agent -> server  {"type":"status","internetBlocked":bool,"at":iso}
 *   server -> agent  {"type":"command","command":"BLOCK"|"ALLOW","id":"..."}
 *   agent -> server  {"type":"ack","id":"...","ok":bool,"error":"..."}
 */
class Connection {
  constructor({ url, device, state, controller, logger }) {
    this.url = url;
    this.device = device;
    this.state = state;
    this.controller = controller;
    this.logger = logger;
    this.ws = null;
    this.backoff = MIN_BACKOFF_MS;
    this._closedByUs = false;
  }

  start() {
    this._closedByUs = false;
    this._connect();
  }

  stop() {
    this._closedByUs = true;
    if (this.ws) this.ws.close();
  }

  _connect() {
    this.state.patch({ connectionStatus: "connecting" });
    this.logger.info(`Connecting to server: ${this.url}`);

    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.logger.warn(`Invalid server URL, will retry: ${e.message}`);
      return this._scheduleReconnect();
    }
    this.ws = ws;

    ws.on("open", () => {
      this.backoff = MIN_BACKOFF_MS;
      this.state.patch({ connectionStatus: "connected" });
      this.logger.info("Connected to server");
      this._send({ type: "hello", device: this.device });
      this._send({ type: "status", internetBlocked: this.state.internetBlocked, at: new Date().toISOString() });
    });

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        return this.logger.warn("Ignoring non-JSON message from server");
      }
      if (msg.type === "command" && msg.command) {
        const result = await this.controller.applyCommand(msg.command, "server");
        this._send({ type: "ack", id: msg.id, ...result });
        this._send({ type: "status", internetBlocked: this.state.internetBlocked, at: new Date().toISOString() });
      }
    });

    ws.on("close", () => {
      this.state.patch({ connectionStatus: "disconnected" });
      if (!this._closedByUs) this._scheduleReconnect();
    });

    ws.on("error", (e) => {
      this.logger.warn(`Server connection error: ${e.message}`);
      // "close" fires right after "error" for ws, which drives the retry.
    });
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _scheduleReconnect() {
    if (this._closedByUs) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    setTimeout(() => this._connect(), delay);
  }
}

module.exports = { Connection };
