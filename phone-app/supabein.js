"use strict";

/**
 * Thin browser client for SupaBein's Data API, called directly (no
 * cloud-api middle server — see README's "Talks directly to SupaBein"
 * section). No Authorization header: `devices`, `commands`,
 * `site_blocks`, `browsing_history`, and `settings` were each granted
 * only the anon operations this app and the laptop agent actually need
 * (see ../laptop-agent/README.md's "Talks directly to SupaBein" section
 * for the exact policy per table) — remove() below will 403 on any table
 * where anon DELETE wasn't explicitly granted, same as any other denied
 * operation would. Every other table in this SupaBein project has no
 * policies at all, so anon access here can't reach anything beyond these.
 */
const SUPABEIN_PROJECT_ID = 79;
const SUPABEIN_BASE = "https://supabein.dxinnovationhub.com/api/v1";

async function supabeinRequest(method, path, body) {
  const res = await fetch(`${SUPABEIN_BASE}/data/${SUPABEIN_PROJECT_ID}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = {};
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON from SupaBein ${method} ${path}: ${text.slice(0, 200)}`);
    }
  }
  if (!res.ok) throw new Error(json.error || `SupaBein ${method} ${path} failed (${res.status})`);
  return json;
}

function supabeinQuery(filters, opts) {
  const parts = [];
  for (const [k, v] of Object.entries(filters || {})) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  if (opts && opts.order) parts.push(`order=${encodeURIComponent(opts.order)}`);
  if (opts && opts.limit) parts.push(`limit=${opts.limit}`);
  return parts.join("&");
}

const supabein = {
  async list(table, filters, opts) {
    const qs = supabeinQuery(filters, opts);
    const res = await supabeinRequest("GET", `/${table}${qs ? `?${qs}` : ""}`);
    return res.data || [];
  },
  async findOne(table, filters, opts) {
    const rows = await supabein.list(table, filters, { ...opts, limit: 1 });
    return rows[0] || null;
  },
  insert(table, row) {
    return supabeinRequest("POST", `/${table}`, row);
  },
  update(table, id, patch) {
    return supabeinRequest("PATCH", `/${table}/${id}`, patch);
  },
  remove(table, id) {
    return supabeinRequest("DELETE", `/${table}/${id}`);
  }
};
