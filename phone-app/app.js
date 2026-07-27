"use strict";

const STORAGE_KEY = "deviceControlSettings"; // {baseUrl, apiKey} — local to this browser only
const POLL_MS = 5000;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function getSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
  catch (_) { return null; }
}
function saveSettings(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

async function apiFetch(path, opts = {}) {
  const settings = getSettings();
  if (!settings) throw new Error("Not configured");
  const res = await fetch(settings.baseUrl.replace(/\/+$/, "") + path, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Api-Key": settings.apiKey, ...(opts.headers || {}) }
  });
  let body = null;
  try { body = await res.json(); } catch (_) { /* non-JSON error page */ }
  if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status})`);
  return body;
}

function relativeTime(mysqlUtc) {
  if (!mysqlUtc) return "never";
  const then = new Date(mysqlUtc.replace(" ", "T") + "Z").getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

let currentDevices = [];
const busyDevices = new Set();
let pollTimer = null;

function cardHtml(d, i) {
  const blocked = d.internet_blocked;
  const busy = busyDevices.has(d.device_uuid) || !!d.pending_command;

  let pillClass = blocked ? "bad" : "ok";
  let pillText = blocked ? "Blocked" : "Allowed";
  if (d.pending_command) {
    pillClass = "pending";
    pillText = d.pending_command === "BLOCK" ? "Blocking…" : "Allowing…";
  }

  const failNote = d.last_command_failed
    ? `<div class="fail-note">Last command failed: ${esc(d.last_command_failed.error || "unknown error")}</div>`
    : "";

  return `
  <div class="card">
    <div class="card-top">
      <span class="dot ${d.online ? "online" : "offline"}"></span>
      <div class="card-title">
        <div class="hostname">${esc(d.hostname)}</div>
        <div class="muted small">${esc(d.platform)}${d.username ? " · " + esc(d.username) : ""}</div>
      </div>
      <span class="pill ${pillClass}">${pillText}</span>
    </div>
    <div class="card-meta muted small">
      ${d.online ? "Online" : "Offline"} · last seen ${relativeTime(d.last_seen)}
    </div>
    ${failNote}
    <button class="btn ${blocked ? "primary" : "danger"}" data-index="${i}" ${busy ? "disabled" : ""}>
      ${busy ? "Working…" : (blocked ? "Allow Internet" : "Block Internet")}
    </button>
  </div>`;
}

function render(devices) {
  currentDevices = devices;
  const list = $("deviceList");
  const empty = $("emptyState");
  if (!devices.length) {
    list.innerHTML = "";
    empty.classList.remove("hide");
    return;
  }
  empty.classList.add("hide");
  list.innerHTML = devices.map(cardHtml).join("");
  list.querySelectorAll("button[data-index]").forEach((btn) => {
    btn.addEventListener("click", () => onToggle(currentDevices[Number(btn.dataset.index)]));
  });
}

async function onToggle(d) {
  const nextAction = d.internet_blocked ? "ALLOW" : "BLOCK";
  busyDevices.add(d.device_uuid);
  render(currentDevices);
  try {
    await apiFetch("/command", {
      method: "POST",
      body: JSON.stringify({ device_uuid: d.device_uuid, command: nextAction })
    });
    hideError();
  } catch (e) {
    showError(e.message);
  } finally {
    busyDevices.delete(d.device_uuid);
    await refresh();
  }
}

async function refresh() {
  try {
    const res = await apiFetch("/devices");
    render(res.devices || []);
    hideError();
  } catch (e) {
    showError(e.message);
  }
}

function showError(msg) {
  const el = $("errorBanner");
  el.textContent = msg;
  el.classList.remove("hide");
}
function hideError() { $("errorBanner").classList.add("hide"); }

function startPolling() {
  stopPolling();
  refresh();
  pollTimer = setInterval(refresh, POLL_MS);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function showSetup() {
  $("setupScreen").classList.remove("hide");
  $("mainScreen").classList.add("hide");
  stopPolling();
}
function showMain() {
  $("setupScreen").classList.add("hide");
  $("mainScreen").classList.remove("hide");
  startPolling();
}

$("setupForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const baseUrl = $("baseUrlInput").value.trim();
  const apiKey = $("apiKeyInput").value.trim();
  if (!baseUrl || !apiKey) return;
  saveSettings({ baseUrl, apiKey });
  hideError();
  showMain();
});

$("settingsBtn").addEventListener("click", () => {
  const s = getSettings();
  if (s) {
    $("baseUrlInput").value = s.baseUrl;
    $("apiKeyInput").value = s.apiKey;
  }
  showSetup();
});

// boot
if (getSettings()) showMain(); else showSetup();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
