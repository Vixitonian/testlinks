"use strict";
const http = require("http");
const https = require("https");
const { URL } = require("url");

/**
 * Talks to whatever cloud server is configured (any HTTP API reachable
 * via fetch/plain HTTP — a serverless function, a small Express app,
 * anything) by polling on an interval rather than holding a socket open.
 * Every tick:
 *   1. register (once, lazily, retried until it succeeds)
 *   2. heartbeat — reports current status, receives at most one pending
 *      command in the same response
 *   3. if a command came back: apply it via Controller, then ack it
 *
 * Endpoint contract the server must implement — see README's "Cloud
 * server contract" section for full request/response shapes:
 *   POST {base}/register   {device_uuid, hostname, platform, ...}   -> {ok}
 *   POST {base}/heartbeat  {device_uuid, internet_blocked}          -> {ok, command: {id, command} | null}
 *   POST {base}/ack        {device_uuid, command_id, ok, error?}    -> {ok}
 * All requests carry an X-Api-Key header matching the server's device key.
 */
class Connection {
  constructor({ baseUrl, apiKey, device, state, controller, logger, pollIntervalMs }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.device = device;
    this.state = state;
    this.controller = controller;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs || 10000;
    this._timer = null;
    this._stopped = true;
    this._registered = false;
  }

  start() {
    this._stopped = false;
    this._tick(); // fire immediately, then reschedule after each tick completes
  }

  stop() {
    this._stopped = true;
    if (this._timer) clearTimeout(this._timer);
  }

  async _tick() {
    if (this._stopped) return;
    this.state.patch({ connectionStatus: "connecting" });

    try {
      if (!this._registered) {
        await this._post("/register", {
          device_uuid: this.device.id,
          hostname: this.device.hostname,
          platform: this.device.platform,
          osRelease: this.device.osRelease,
          username: this.device.username
        });
        this._registered = true;
      }

      const res = await this._post("/heartbeat", {
        device_uuid: this.device.id,
        internet_blocked: this.state.internetBlocked
      });
      this.state.patch({ connectionStatus: "connected", lastError: null });

      if (res.command) {
        this.logger.info(`Server has a command waiting: ${res.command.command} (id ${res.command.id})`);
        const result = await this.controller.applyCommand(res.command.command, "server");
        await this._post("/ack", {
          device_uuid: this.device.id,
          command_id: res.command.id,
          ok: result.ok,
          error: result.error || null
        });
      }
    } catch (e) {
      this.logger.warn(`Server poll failed: ${e.message}`);
      this.state.patch({ connectionStatus: "disconnected" });
      // A failed register this tick just gets retried next tick.
    } finally {
      if (!this._stopped) {
        this._timer = setTimeout(() => this._tick(), this.pollIntervalMs);
      }
    }
  }

  _post(path, body) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(this.baseUrl + path);
      } catch (e) {
        return reject(new Error(`Invalid serverBaseUrl: ${e.message}`));
      }
      const payload = JSON.stringify(body);
      const lib = url.protocol === "https:" ? https : http;

      const req = lib.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "X-Api-Key": this.apiKey
          },
          timeout: 15000
        },
        (resp) => {
          let data = "";
          resp.on("data", (chunk) => { data += chunk; });
          resp.on("end", () => {
            if (resp.statusCode < 200 || resp.statusCode >= 300) {
              return reject(new Error(`HTTP ${resp.statusCode} from ${path}: ${data.slice(0, 200)}`));
            }
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Invalid JSON from ${path}: ${e.message}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error(`Request to ${path} timed out`)));
      req.write(payload);
      req.end();
    });
  }
}

module.exports = { Connection };
