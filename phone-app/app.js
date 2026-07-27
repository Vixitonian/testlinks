"use strict";
/* global supabein */

// No API base URL or admin key anymore — talks directly to SupaBein via
// supabein.js (anon access, scoped by SupaBein's own row policies to just
// the devices/commands/settings tables). See README's "Talks directly to
// SupaBein" section.
const POLL_MS = 5000;
const ONLINE_THRESHOLD_MS = 30000;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getPassphraseRow() {
  return supabein.findOne("settings", { setting_key: "passphrase_hash" });
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
    await supabein.insert("commands", { device_uuid: d.device_uuid, command: nextAction, status: "pending" });
    hideError();
  } catch (e) {
    showError(e.message);
  } finally {
    busyDevices.delete(d.device_uuid);
    await refresh();
  }
}

const IN_FLIGHT_STATUSES = new Set(["pending", "delivered"]);

async function refresh() {
  try {
    const [devices, commands] = await Promise.all([
      supabein.list("devices", {}, { order: "last_seen.desc", limit: 200 }),
      supabein.list("commands", {}, { order: "id.desc", limit: 200 })
    ]);

    const latestByDevice = new Map();
    for (const c of commands) {
      if (!latestByDevice.has(c.device_uuid)) latestByDevice.set(c.device_uuid, c);
    }

    const now = Date.now();
    const enriched = devices.map((d) => {
      const lastCmd = latestByDevice.get(d.device_uuid);
      const lastSeenMs = d.last_seen ? new Date(d.last_seen.replace(" ", "T") + "Z").getTime() : null;
      return {
        device_uuid: d.device_uuid,
        hostname: d.hostname,
        platform: d.platform,
        username: d.username,
        internet_blocked: !!d.internet_blocked,
        last_seen: d.last_seen,
        online: lastSeenMs !== null && now - lastSeenMs <= ONLINE_THRESHOLD_MS,
        pending_command: lastCmd && IN_FLIGHT_STATUSES.has(lastCmd.status) ? lastCmd.command : null,
        last_command_failed: lastCmd && lastCmd.status === "failed"
          ? { command: lastCmd.command, error: lastCmd.error }
          : null
      };
    });

    render(enriched);
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

// Passcode gate: required every time the app is opened (session-scoped,
// not remembered across launches). The passphrase itself now lives in
// SupaBein's `settings` table (shared with the laptop agent — see
// "Change passcode" below), not a hardcoded constant, so a change here
// takes effect for both apps.
function bootMainScreen() {
  $("loginScreen").classList.add("hide");
  $("mainScreen").classList.remove("hide");
  $("settingsBtn").classList.remove("hide");
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
    try {
      const [hash, row] = await Promise.all([sha256Hex(input.value), getPassphraseRow()]);
      if (row && hash === row.value) {
        sessionStorage.setItem("unlocked", "1");
        $("loginError").classList.add("hide");
        bootMainScreen();
      } else {
        $("loginError").textContent = "Incorrect passcode.";
        $("loginError").classList.remove("hide");
        input.value = "";
        input.focus();
      }
    } catch (err) {
      $("loginError").textContent = `Could not verify passcode: ${err.message}`;
      $("loginError").classList.remove("hide");
    }
  });
}

function initSettingsScreen() {
  const screen = $("settingsScreen");
  const form = $("settingsForm");
  const errEl = $("settingsError");
  const okEl = $("settingsSuccess");

  function resetMessages() {
    errEl.classList.add("hide");
    okEl.classList.add("hide");
  }

  $("settingsBtn").addEventListener("click", () => {
    resetMessages();
    form.reset();
    screen.classList.remove("hide");
  });
  $("settingsCancel").addEventListener("click", () => {
    screen.classList.add("hide");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetMessages();
    const current = $("currentPasscodeInput").value;
    const next = $("newPasscodeInput").value;
    const confirmVal = $("confirmPasscodeInput").value;

    if (!next) {
      errEl.textContent = "Enter a new passcode.";
      errEl.classList.remove("hide");
      return;
    }
    if (next !== confirmVal) {
      errEl.textContent = "New passcodes don't match.";
      errEl.classList.remove("hide");
      return;
    }

    try {
      const row = await getPassphraseRow();
      const currentHash = await sha256Hex(current);
      if (!row || currentHash !== row.value) {
        errEl.textContent = "Current passcode is incorrect.";
        errEl.classList.remove("hide");
        return;
      }
      const newHash = await sha256Hex(next);
      await supabein.update("settings", row.id, { value: newHash });
      okEl.classList.remove("hide");
      form.reset();
    } catch (err) {
      errEl.textContent = `Could not update passcode: ${err.message}`;
      errEl.classList.remove("hide");
    }
  });
}

initLoginGate();
initSettingsScreen();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
