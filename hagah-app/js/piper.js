// ES module bridge to @diffusionstudio/vits-web (Piper neural TTS via
// WebAssembly/ONNX Runtime, running entirely in this browser tab). This
// script runs as a module (deferred by the browser), so classic scripts
// must only call window.PiperTTS from inside event handlers, never at
// their own top-level, to be sure it has finished loading first.
import * as vits from "https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm";

window.PiperTTS = {
  // Runs inference, downloading + caching the voice model (in the Origin
  // Private File System) on first use for that voice. Returns a WAV Blob —
  // real audio data, computed locally, nothing to "capture" from playback.
  predict(text, voiceId, onProgress) {
    return vits.predict({ text, voiceId }, onProgress);
  },
  download(voiceId, onProgress) {
    return vits.download(voiceId, onProgress);
  },
  stored() {
    return vits.stored();
  },
  remove(voiceId) {
    return vits.remove(voiceId);
  },
};
