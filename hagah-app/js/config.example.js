// Copy this file to js/config.js (gitignored) and fill in your own
// project-scoped Supabein PAT. js/config.js is never committed — the app
// bakes it into the deployed static site so there's no settings screen.
const HAGAH_CONFIG = {
  projectId: "127",
  token: "sb_pat_...",
  // Token for the edge-tts narration service at
  // https://supabein.dxinnovationhub.com/tts/docs — ask the service owner
  // for one. Only works when the app is served from the same origin
  // (supabein.dxinnovationhub.com); local dev will hit a CORS error.
  edgeTtsToken: "",
};
