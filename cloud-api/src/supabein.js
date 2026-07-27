"use strict";
const config = require("./config");

/**
 * Thin client for SupaBein's Data API, authenticated with a project
 * owner token (bypasses all row policies, same as a service_key would).
 * This is the ONLY module in this codebase that ever touches that token —
 * everything else calls these functions instead of building SupaBein
 * requests itself, so there's exactly one place to audit.
 *
 * Filter/response shapes per https://supabein.dxinnovationhub.com/docs:
 *   GET  /data/:project/:table?col=value&col2=op.value&order=col.dir&limit=N
 *        -> {data: [...], count, limit, offset}
 *   POST /data/:project/:table            -> the created row, unwrapped
 *   PATCH /data/:project/:table/:id       -> the updated row, unwrapped
 * IDs are numbers. A unique-column conflict is a 409, not a generic error.
 */

async function request(method, path, body) {
  const url = `${config.supabeinBase}/data/${config.supabeinProjectId}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.supabeinToken}`
    },
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
