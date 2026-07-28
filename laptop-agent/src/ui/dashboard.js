"use strict";
/* global agent */

const el = (id) => document.getElementById(id);

function render(snap) {
  el("hostname").textContent = snap.device.hostname || "Laptop Agent";
  el("deviceId").textContent = `id: ${snap.device.id}`;

  const dot = el("statusDot");
  dot.className = "dot " + (snap.internetBlocked ? "blocked" : snap.connectionStatus === "connected" ? "connected" : "disconnected");

  const connPill = el("connPill");
  connPill.textContent = snap.connectionStatus;
  connPill.className = "pill " + (snap.connectionStatus === "connected" ? "ok" : snap.connectionStatus === "connecting" ? "pending" : "bad");

  const blockPill = el("blockPill");
  blockPill.textContent = snap.internetBlocked ? "Blocked" : "Allowed";
  blockPill.className = "pill " + (snap.internetBlocked ? "bad" : "ok");

  el("blockBtn").disabled = snap.internetBlocked;
  el("allowBtn").disabled = !snap.internetBlocked;

  const revertRow = el("revertRow");
  if (snap.internetBlocked && snap.autoRevertAt) {
    revertRow.style.display = "";
    const mins = Math.max(0, Math.round((new Date(snap.autoRevertAt) - Date.now()) / 60000));
    el("revertAt").textContent = `auto-allows in ~${mins} min`;
  } else {
    revertRow.style.display = "none";
  }

  const lcCard = el("lastCommandCard");
  if (snap.lastCommand) {
    lcCard.style.display = "";
    el("lastCommand").textContent =
      `${snap.lastCommand.command} (via ${snap.lastCommand.source}) at ${new Date(snap.lastCommand.at).toLocaleTimeString()}`;
  }

  el("errorMsg").textContent = snap.lastError || "";
}

el("blockBtn").addEventListener("click", async () => {
  el("blockBtn").disabled = true;
  const res = await agent.block();
  if (!res.ok) el("errorMsg").textContent = res.error || "Failed to block internet";
});

el("allowBtn").addEventListener("click", () => {
  // Passphrase-gated — opens the same prompt the tray menu uses rather
  // than applying ALLOW directly. The dashboard re-renders from the
  // next state:changed event once it's actually applied.
  agent.requestAllow();
});

agent.onStateChange(render);
agent.getState().then(render);
