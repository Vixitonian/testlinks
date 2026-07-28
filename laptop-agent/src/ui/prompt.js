"use strict";
/* global agent */

const passInput = document.getElementById("pass");
const errEl = document.getElementById("err");
const titleEl = document.getElementById("title");
const descEl = document.getElementById("desc");
const confirmBtn = document.getElementById("confirm");

const COPY = {
  quit: {
    title: "Quit Laptop Agent?",
    desc: "Enter the passphrase to quit. This prevents the monitored user from silently disabling the agent — it is not a substitute for the server-side controls.",
    confirmLabel: "Quit"
  },
  allow: {
    title: "Allow Internet?",
    desc: "Enter the passphrase to lift the block. Blocking itself needs no passphrase — only restoring internet access does.",
    confirmLabel: "Allow Internet"
  }
};

function applyPurpose(purpose) {
  const copy = COPY[purpose] || COPY.quit;
  titleEl.textContent = copy.title;
  descEl.textContent = copy.desc;
  confirmBtn.textContent = copy.confirmLabel;
}

document.getElementById("cancel").addEventListener("click", () => {
  agent.closeThisWindow();
});

async function submit() {
  const { ok } = await agent.verifyPassphrase(passInput.value);
  if (ok) {
    errEl.textContent = "";
    agent.confirmAction();
  } else {
    errEl.textContent = "Incorrect passphrase.";
    passInput.value = "";
    passInput.focus();
  }
}

confirmBtn.addEventListener("click", submit);
passInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
});

agent.onPromptPurposeChanged((purpose) => {
  applyPurpose(purpose);
  passInput.value = "";
  errEl.textContent = "";
  passInput.focus();
});
agent.getPromptPurpose().then(applyPurpose);
