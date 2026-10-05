// Client for the first-party edge-tts narration service hosted at
// https://supabein.dxinnovationhub.com/tts/docs — operated by the same
// team as this project's Supabein backend, via a token they issued.
// Called directly (not through Supabein's generic integration proxy,
// which mangles binary responses like MP3 into corrupted text/JSON).
// This works with no CORS issues because the deployed app and this
// service share an origin (supabein.dxinnovationhub.com); it will fail
// with a CORS error when run from a different origin (e.g. local dev
// on localhost), which is expected there.
const EdgeTTS = (() => {
  const BASE = "https://supabein.dxinnovationhub.com/tts/";

  async function synthesize(text, voice) {
    const token = typeof HAGAH_CONFIG !== "undefined" && HAGAH_CONFIG.edgeTtsToken;
    if (!token) throw new Error("Missing edgeTtsToken in js/config.js.");
    if (!text || text.length > 5000) {
      throw new Error("This passage is too long for one narration request (5000 character limit) — try fewer verses.");
    }
    const res = await fetch(`${BASE}speak`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, voice, token }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`TTS error ${res.status}${msg ? `: ${msg}` : ""}`);
    }
    return res.blob();
  }

  return { synthesize };
})();
