"use strict";

/**
 * Thin client for SupaBein's Data API, called directly (no cloud-api
 * middle server — see README's "Talks directly to SupaBein" section).
 * Uses no Authorization header at all: the `devices` and `commands`
 * tables were granted anon SELECT/INSERT/UPDATE (no DELETE) specifically
 * so this agent and the phone app can both read/write them with zero
 * embedded credential. Every other table in this SupaBein project has no
 * policies at all, so anon access here can't reach anything beyond these
 * two tables regardless.
 *
 * Filter/response shapes per https://supabein.dxinnovationhub.com/docs:
 *   GET  /data/:project/:table?col=value&order=col.dir&limit=N -> {data: [...], count, limit, offset}
 *   POST /data/:project/:table      -> the created row, unwrapped
 *   PATCH /data/:project/:table/:id -> the updated row, unwrapped
 */

const PROJECT_ID = 79;
const BASE = "https://supabein.dxinnovationhub.com/api/v1";

async function request(method, path, body) {
  const res = await fetch(`${BASE}/data/${PROJECT_ID}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON from SupaBein ${method} ${path}: ${text.slice(0, 200)}`);
    }
  }
  if (!res.ok) {
    const err = new Error(json.error || `SupaBein ${method} ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function buildQuery(filters, opts) {
  const parts = [];
  for (const [k, v] of Object.entries(filters || {})) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  if (opts && opts.order) parts.push(`order=${encodeURIComponent(opts.order)}`);
  if (opts && opts.limit) parts.push(`limit=${opts.limit}`);
  return parts.join("&");
}

async function list(table, filters, opts) {
  const qs = buildQuery(filters, opts);
  const res = await request("GET", `/${table}${qs ? `?${qs}` : ""}`);
  return res.data || [];
}

async function findOne(table, filters, opts) {
  const rows = await list(table, filters, { ...opts, limit: 1 });
  return rows[0] || null;
}

function insert(table, row) {
  return request("POST", `/${table}`, row);
}

function update(table, id, patch) {
  return request("PATCH", `/${table}/${id}`, patch);
}

module.exports = { list, findOne, insert, update };
