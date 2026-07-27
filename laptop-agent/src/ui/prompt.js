"use strict";
/* global agent */

const passInput = document.getElementById("pass");
const errEl = document.getElementById("err");

document.getElementById("cancel").addEventListener("click", () => {
  agent.closeThisWindow();
});

async function submit() {
  const { ok } = await agent.verifyPassphrase(passInput.value);
  if (ok) {
    agent.confirmQuit();
  } else {
    errEl.textContent = "Incorrect passphrase.";
    passInput.value = "";
    passInput.focus();
  }
}

document.getElementById("confirm").addEventListener("click", submit);
passInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
});
