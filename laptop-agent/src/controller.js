"use strict";
const network = require("./network");
const system = require("./system");

/**
 * Single choke point for actually changing the network state. Both the
 * tray menu (local control, useful before a server exists / for testing)
 * and the WebSocket connection (remote commands from the phone app, once
 * wired up) call into this so state, logging, and the auto-revert safety
 * timer all stay consistent regardless of who issued the command.
 */
class Controller {
  constructor(state, config, logger) {
    this.state = state;
    this.config = config;
    this.logger = logger;
    this._revertTimer = null;
  }

  async init() {
    try {
      const blocked = await network.isBlocked();
      this.state.patch({ internetBlocked: blocked });
    } catch (e) {
      this.logger.warn(`Could not read initial network state: ${e.message}`);
    }
  }

  async applyCommand(command, source) {
    const normalized = String(command).toUpperCase();
    this.logger.info(`Command received: ${normalized} (source: ${source})`);
    this.state.patch({ lastCommand: { command: normalized, source, at: new Date().toISOString() } });

    try {
      if (normalized === "BLOCK") {
        const target = this._getAllowTarget();
        await network.block(target);
        this.state.patch({ internetBlocked: true, lastError: null });
        this._armAutoRevert();
      } else if (normalized === "ALLOW") {
        await network.allow();
        this._clearAutoRevert();
        this.state.patch({ internetBlocked: false, lastError: null, autoRevertAt: null });
      } else if (normalized === "SHUTDOWN") {
        // Never silent: system.shutdown() always gives a grace period with
        // an on-screen warning (Windows) rather than cutting power instantly.
        await system.shutdown();
        this.state.patch({ lastError: null });
      } else {
        throw new Error(`Unknown command: ${command}`);
      }
      return { ok: true };
    } catch (e) {
      this.logger.error(`Command ${normalized} failed: ${e.message}`);
      this.state.patch({ lastError: e.message });
      return { ok: false, error: e.message };
    }
  }

  /**
   * Reads the hardcoded allow-list from config.json (see
   * scripts/resolve-server-ips.js) so BLOCK can permit that destination
   * specifically instead of cutting the agent's own connection along with
   * everything else. If it hasn't been configured yet (empty
   * serverAllowIps), falls back to a blanket block with no allow-list —
   * BLOCK still succeeds rather than erroring out, just without the
   * "still reachable remotely" property, relying solely on the
   * auto-revert timer in that fallback case.
   */
  _getAllowTarget() {
    const ips = this.config.get("serverAllowIps");
    if (!Array.isArray(ips) || ips.length === 0) {
      this.logger.warn(
        "serverAllowIps is empty, falling back to a blanket block. " +
        "Run: node scripts/resolve-server-ips.js <serverBaseUrl> and add the result to config.json."
      );
      return null;
    }
    return { ips, port: Number(this.config.get("serverAllowPort")) || 443 };
  }

  /**
   * Safety net: a full network block also severs the agent's own link to
   * the control server (see README), so without this timer a laptop could
   * only be unblocked by someone physically present. We auto-lift the
   * block after configured minutes rather than leave that as a dead end.
   */
  _armAutoRevert() {
    this._clearAutoRevert();
    const minutes = Number(this.config.get("autoRevertMinutes")) || 60;
    const at = new Date(Date.now() + minutes * 60_000);
    this.state.patch({ autoRevertAt: at.toISOString() });
    this._revertTimer = setTimeout(() => {
      this.logger.info(`Auto-revert timer elapsed (${minutes}m) — lifting block automatically`);
      this.applyCommand("ALLOW", "auto-revert");
    }, minutes * 60_000);
  }

  _clearAutoRevert() {
    if (this._revertTimer) {
      clearTimeout(this._revertTimer);
      this._revertTimer = null;
    }
  }
}

module.exports = { Controller };
