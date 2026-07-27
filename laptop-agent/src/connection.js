"use strict";
const supabein = require("./supabein");
const { nowMysqlUtc } = require("./time");

/**
 * Talks directly to SupaBein's Data API (see supabein.js) by polling on
 * an interval rather than holding a socket open. No cloud-api middle
 * server — see README's "Talks directly to SupaBein" section for why.
 * Every tick:
 *   1. register (once, lazily, retried until it succeeds) — upsert this
 *      device's row in `devices` keyed on device_uuid
 *   2. heartbeat — update `devices` with current status
 *   3. sync the shared quit/unblock passphrase from `settings` — lets the
 *      phone app change it centrally (see README's "Shared passphrase"
 *      section) and have it take effect here within one poll interval
 *   4. check `commands` for a pending row for this device; if found, mark
 *      it delivered, apply it via Controller, then mark it acked/failed
 */
class Connection {
  constructor({ device, state, controller, config, logger, pollIntervalMs }) {
    this.device = device;
    this.state = state;
    this.controller = controller;
    this.config = config;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs || 10000;
    this._timer = null;
    this._stopped = true;
    this._registered = false;
    this._deviceRowId = null;
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
        await this._register();
        this._registered = true;
      }

      await this._heartbeat();
      this.state.patch({ connectionStatus: "connected", lastError: null });

      await this._syncPassphrase();

      const pending = await supabein.findOne(
        "commands",
        { device_uuid: this.device.id, status: "pending" },
        { order: "id.asc" }
      );
      if (pending) {
        this.logger.info(`SupaBein has a command waiting: ${pending.command} (id ${pending.id})`);
        await supabein.update("commands", pending.id, { status: "delivered" });
        const result = await this.controller.applyCommand(pending.command, "server");
        await supabein.update("commands", pending.id, {
          status: result.ok ? "acked" : "failed",
          acked_at: nowMysqlUtc(),
          error: result.error || null
        });
      }
    } catch (e) {
      this.logger.warn(`SupaBein poll failed: ${e.message}`);
      this.state.patch({ connectionStatus: "disconnected" });
      // A failed register/heartbeat this tick just gets retried next tick.
    } finally {
      if (!this._stopped) {
        this._timer = setTimeout(() => this._tick(), this.pollIntervalMs);
      }
    }
  }

  async _register() {
    const patch = {
      hostname: this.device.hostname,
      platform: this.device.platform,
      os_release: this.device.osRelease || "",
      username: this.device.username || "",
      last_seen: nowMysqlUtc()
    };
    const existing = await supabein.findOne("devices", { device_uuid: this.device.id });
    if (existing) {
      this._deviceRowId = existing.id;
      await supabein.update("devices", existing.id, patch);
    } else {
      const row = await supabein.insert("devices", {
        device_uuid: this.device.id,
        internet_blocked: false,
        ...patch
      });
      this._deviceRowId = row.id;
    }
  }

  async _syncPassphrase() {
    if (!this.config) return;
    const row = await supabein.findOne("settings", { setting_key: "passphrase_hash" });
    if (row && row.value && row.value !== this.config.get("quitPassphraseHash")) {
      this.config.set("quitPassphraseHash", row.value);
      this.logger.info("Quit/unblock passphrase updated from SupaBein");
    }
  }

  async _heartbeat() {
    if (this._deviceRowId == null) {
      // Row may have gone missing since register() (e.g. deleted directly
      // in SupaBein) — re-register instead of updating a nonexistent id.
      await this._register();
      return;
    }
    await supabein.update("devices", this._deviceRowId, {
      internet_blocked: this.state.internetBlocked,
      last_seen: nowMysqlUtc()
    });
  }
}

module.exports = { Connection };
