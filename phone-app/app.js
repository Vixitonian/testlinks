"use strict";

// Hardcoded rather than entered via a setup screen — this app is served
// as public static files, so these values are effectively public the
// moment they're deployed (anyone can view-source them). ADMIN_KEY is a
// key minted specifically for that assumption (not the same value ever
// used in a "type this in by hand and keep it private" flow) and only
// grants listing devices + sending Block/Allow on this one deployment —
// see ../cloud-api/README.md for the full threat-model note.
const API_BASE = "https://device-control-cloud-api.onrender.com";
const ADMIN_KEY = "189cafb0dd0ed74dd5709fe915ed7049e9395dccb018a30eac8ce7c0c7033427";

// SHA-256 of the app passcode — same passcode as the laptop agent's quit
// passphrase. This is a client-side lock screen only (same class of
// deterrent as the tray app's quit passphrase, not a real security
// boundary): the hash lives in this public file and anyone with dev tools
// could skip straight to calling refresh()/onToggle() themselves. It's
// meant to stop someone picking up an unlocked phone and casually opening
// the app, not to withstand a determined attacker — ADMIN_KEY above is
// still the actual credential guarding the API itself.
const PASSCODE_HASH = "a9d2e534f6f208c4e2895a88f4440accea7dd45d314b79ea5fab615f51aed1f0";

const POLL_MS = 5000;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function apiFetch(path, opts = {}) {
  const res = await fetch(API_BASE.replace(/\/+$/, "") + path, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Api-Key": ADMIN_KEY, ...(opts.headers || {}) }
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

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Passcode gate: required every time the app is opened (session-scoped,
// not remembered across launches — see PASSCODE_HASH note above). Once
// unlocked, boots straight into the device list — empty state handles
// "nothing registered yet" on its own, no setup step beyond the passcode.
function bootMainScreen() {
  $("loginScreen").classList.add("hide");
  $("mainScreen").classList.remove("hide");
  refresh();
  setInterval(refresh, POLL_MS);
}

function initLoginGate() {
  if (sessionStorage.getItem("unlocked") === "1") {
    bootMainScreen();
    return;
  }
  $("loginScreen").classList.remove("hide");
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("passcodeInput");
    const hash = await sha256Hex(input.value);
    if (hash === PASSCODE_HASH) {
      sessionStorage.setItem("unlocked", "1");
      $("loginError").classList.add("hide");
      bootMainScreen();
    } else {
      $("loginError").classList.remove("hide");
      input.value = "";
      input.focus();
    }
  });
}

initLoginGate();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
