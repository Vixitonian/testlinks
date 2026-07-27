"use strict";
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

const config = require("./src/config");
const register = require("./src/handlers/register");
const heartbeat = require("./src/handlers/heartbeat");
const ack = require("./src/handlers/ack");
const devices = require("./src/handlers/devices");
const command = require("./src/handlers/command");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key"
};

/** Fixed-length digest comparison so response timing can't leak key
 *  length/prefix the way a plain === would. */
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(Object.assign(new Error("Request body must be valid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS_HEADERS });
  res.end(JSON.stringify(obj));
}

// device-facing endpoints (agent) vs admin-facing endpoints (future phone
// app) use different keys, so a leaked agent config can't command other
// devices.
const ROUTES = {
  "POST /register": { role: "device", handler: register },
  "POST /heartbeat": { role: "device", handler: heartbeat },
  "POST /ack": { role: "device", handler: ack },
  "GET /devices": { role: "admin", handler: devices },
  "POST /command": { role: "admin", handler: command }
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");
  const route = ROUTES[`${req.method} ${url.pathname}`];
  if (!route) return send(res, 404, { ok: false, error: "Not found" });

  const providedKey = req.headers["x-api-key"] || "";
  const expectedKey = route.role === "admin" ? config.adminApiKey : config.deviceApiKey;
  if (!providedKey || !safeEqual(providedKey, expectedKey)) {
    return send(res, 401, { ok: false, error: "Unauthorized" });
  }

  try {
    const body = req.method === "POST" ? await readJsonBody(req) : {};
    const result = await route.handler(body);
    send(res, 200, result);
  } catch (e) {
    send(res, e.status || 500, { ok: false, error: e.message });
  }
});

server.listen(config.port, () => {
  console.log(`cloud-api listening on :${config.port}`);
});
