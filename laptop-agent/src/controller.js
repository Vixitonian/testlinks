"use strict";
const network = require("./network");
const { resolveAllowTarget } = require("./network/target");

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
        const target = await this._resolveAllowTarget();
        await network.block(target);
        this.state.patch({ internetBlocked: true, lastError: null });
        this._armAutoRevert();
      } else if (normalized === "ALLOW") {
        await network.allow();
        this._clearAutoRevert();
        this.state.patch({ internetBlocked: false, lastError: null, autoRevertAt: null });
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
   * Resolves the control server's current IP(s) so BLOCK can allow-list
   * it specifically instead of cutting the agent's own connection along
   * with everything else. If resolution fails (bad serverBaseUrl, DNS
   * hiccup, no server configured yet), falls back to a blanket block with
   * no allow-list — BLOCK still succeeds rather than erroring out, just
   * without the "still reachable remotely" property, relying solely on
   * the auto-revert timer in that fallback case.
   */
  async _resolveAllowTarget() {
    try {
      return await resolveAllowTarget(this.config.get("serverBaseUrl"));
    } catch (e) {
      this.logger.warn(`Could not resolve server address for allow-listing, falling back to a blanket block: ${e.message}`);
      return null;
    }
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
