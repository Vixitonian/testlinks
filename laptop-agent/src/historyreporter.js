"use strict";
const supabein = require("./supabein");
const { toMysqlUtc } = require("./time");
const { collectDomainVisits } = require("./browserhistory");

/**
 * Reads Chrome/Edge history (see browserhistory.js) and upserts each
 * domain's current visit_count/last_visit_at into SupaBein's
 * browsing_history table, one row per (device_uuid, domain) — always a
 * full overwrite of that domain's row with the browser's own current
 * totals, not an incremental add, so a re-run after a missed cycle can't
 * double-count.
 */
async function reportBrowsingHistory(device, logger) {
  const domains = collectDomainVisits(logger);
  if (domains.size === 0) return;

  let applied = 0;
  for (const [domain, stats] of domains) {
    try {
      const patch = {
        visit_count: stats.visitCount,
        last_visit_at: stats.lastVisitAt ? toMysqlUtc(stats.lastVisitAt) : null
      };
      const existing = await supabein.findOne("browsing_history", { device_uuid: device.id, domain });
      if (existing) {
        await supabein.update("browsing_history", existing.id, patch);
      } else {
        await supabein.insert("browsing_history", { device_uuid: device.id, domain, ...patch });
      }
      applied += 1;
    } catch (e) {
      logger.warn(`Could not report browsing history for ${domain}: ${e.message}`);
    }
  }
  logger.info(`Browsing history reported: ${applied}/${domains.size} domain(s).`);
}

module.exports = { reportBrowsingHistory };
