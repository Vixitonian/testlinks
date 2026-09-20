// Speech preview, microphone recording, background-music mixing, and MP3 export.
// All processing happens locally in the browser (Web Audio API + lamejs).
const HagahAudio = (() => {
  let audioCtx = null;
  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // ---- Text-to-speech preview (listen only, not exportable to a file) ----
  function listVoices() {
    return new Promise((resolve) => {
      const existing = speechSynthesis.getVoices();
      if (existing.length) return resolve(existing);
      speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    });
  }

  function speak(text, { rate = 1, pitch = 1, voiceURI } = {}) {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    if (voiceURI) {
      const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI);
      if (voice) utter.voice = voice;
    }
    speechSynthesis.speak(utter);
    return utter;
  }

  function stopSpeaking() {
    speechSynthesis.cancel();
  }

  // ---- Live preview: hear narration + background music together before exporting ----
  let previewSources = [];
  let previewMusicEl = null;

  function stopPreview() {
    speechSynthesis.cancel();
    previewSources.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    previewSources = [];
    if (previewMusicEl) {
      previewMusicEl.pause();
      URL.revokeObjectURL(previewMusicEl.src);
      previewMusicEl = null;
    }
  }

  // Real preview of the actual recorded narration mixed live with the music file,
  // at the same volumes that will be used for export.
  async function previewRecordedMix(narrationBlob, musicFile, { narrationGain = 1, musicGain = 0.25 } = {}) {
    stopPreview();
    await ctx().resume();
    const narrationBuffer = await decodeBlob(narrationBlob);

    const narrationSource = ctx().createBufferSource();
    narrationSource.buffer = narrationBuffer;
    const narrationNode = ctx().createGain();
    narrationNode.gain.value = narrationGain;
    narrationSource.connect(narrationNode).connect(ctx().destination);
    narrationSource.start(0);
    previewSources.push(narrationSource);

    if (musicFile) {
      const musicBuffer = await decodeBlob(musicFile);
      const musicSource = ctx().createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = musicBuffer.duration < narrationBuffer.duration;
      const musicNode = ctx().createGain();
      musicNode.gain.value = musicGain;
      musicSource.connect(musicNode).connect(ctx().destination);
      musicSource.start(0);
      musicSource.stop(ctx().currentTime + narrationBuffer.duration);
      previewSources.push(musicSource);
    }

    narrationSource.onended = () => stopPreview();
    return narrationBuffer.duration;
  }

  // Approximate preview using the device voice (Web Speech can't be routed into
  // the Web Audio graph, so the music plays back separately alongside it).
  function previewSpeechWithMusic(text, musicFile, { rate = 1, pitch = 1, voiceURI, musicGain = 0.25 } = {}) {
    stopPreview();
    if (musicFile) {
      previewMusicEl = new Audio(URL.createObjectURL(musicFile));
      previewMusicEl.loop = true;
      previewMusicEl.volume = Math.min(1, Math.max(0, musicGain));
      previewMusicEl.play().catch(() => {});
    }
    const utter = speak(text, { rate, pitch, voiceURI });
    utter.onend = () => stopPreview();
    utter.onerror = () => stopPreview();
  }

  // ---- Microphone recording (the source used for MP3 export) ----
  let mediaRecorder = null;
  let recordedChunks = [];
  let micStream = null;

  async function startRecording() {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/ogg";
    mediaRecorder = new MediaRecorder(micStream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start();
  }

  function stopRecording() {
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        micStream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  function isRecording() {
    return Boolean(mediaRecorder && mediaRecorder.state === "recording");
  }

  // ---- Capture a preloaded (device) voice as a real, exportable recording ----
  // SpeechSynthesis can't be piped into the Web Audio graph directly, but a
  // Chromium tab-audio share (getDisplayMedia) can capture whatever the tab
  // plays, including synthesized speech, as a genuine MediaStream to record.
  function isTabAudioCaptureSupported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  let captureStream = null;
  let captureRecorder = null;

  function recordSpeechAsBlob(text, { rate = 1, pitch = 1, voiceURI } = {}) {
    if (!isTabAudioCaptureSupported()) {
      return Promise.reject(
        new Error("This browser can't capture tab audio. Try Chrome/Edge, or record your own voice instead.")
      );
    }
    return navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: "include" })
      .then((stream) => {
        captureStream = stream;
        const audioTracks = stream.getAudioTracks();
        stream.getVideoTracks().forEach((t) => t.stop());
        if (!audioTracks.length) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error('No tab audio was shared — choose "This Tab" and check "Share tab audio" when prompted.');
        }
        const audioOnlyStream = new MediaStream(audioTracks);
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
        captureRecorder = new MediaRecorder(audioOnlyStream, { mimeType });
        const chunks = [];
        captureRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve, reject) => {
          captureRecorder.onstop = () => {
            audioOnlyStream.getTracks().forEach((t) => t.stop());
            resolve(new Blob(chunks, { type: captureRecorder.mimeType }));
          };
          captureRecorder.start();
          // small lead-in so the recorder is fully live before speech starts
          setTimeout(() => {
            const utter = speak(text, { rate, pitch, voiceURI });
            utter.onend = () => setTimeout(() => captureRecorder.state === "recording" && captureRecorder.stop(), 300);
            utter.onerror = (e) => {
              if (captureRecorder.state === "recording") captureRecorder.stop();
              reject(new Error("Speech synthesis failed: " + e.error));
            };
          }, 250);
        });
      });
  }

  function cancelSpeechCapture() {
    speechSynthesis.cancel();
    if (captureRecorder && captureRecorder.state === "recording") captureRecorder.stop();
    if (captureStream) captureStream.getTracks().forEach((t) => t.stop());
  }

  // ---- Decoding & mixing ----
  async function decodeBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    return ctx().decodeAudioData(arrayBuffer);
  }

  async function mixNarrationWithMusic(narrationBuffer, musicBuffer, { narrationGain = 1, musicGain = 0.25 } = {}) {
    const sampleRate = narrationBuffer.sampleRate;
    const duration = narrationBuffer.duration;
    const channels = 2;
    const offline = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

    const narrationSource = offline.createBufferSource();
    narrationSource.buffer = narrationBuffer;
    const narrationNode = offline.createGain();
    narrationNode.gain.value = narrationGain;
    narrationSource.connect(narrationNode).connect(offline.destination);
    narrationSource.start(0);

    if (musicBuffer) {
      const musicSource = offline.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = musicBuffer.duration < duration;
      const musicNode = offline.createGain();
      musicNode.gain.value = musicGain;
      // fade out the last second of music so it doesn't cut off abruptly
      const fadeStart = Math.max(0, duration - 1);
      musicNode.gain.setValueAtTime(musicGain, 0);
      musicNode.gain.setValueAtTime(musicGain, fadeStart);
      musicNode.gain.linearRampToValueAtTime(0, duration);
      musicSource.connect(musicNode).connect(offline.destination);
      musicSource.start(0);
      musicSource.stop(duration);
    }

    narrationSource.stop(duration);
    return offline.startRendering();
  }

  // ---- MP3 encoding via lamejs ----
  function floatTo16BitPCM(float32Array) {
    const out = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function encodeMp3(audioBuffer, kbps = 128) {
    if (typeof lamejs === "undefined") {
      throw new Error("MP3 encoder failed to load (vendor/lame.min.js). Check your connection and reload.");
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Nothing to encode — the recording appears to be empty.");
    }
    const channels = audioBuffer.numberOfChannels >= 2 ? 2 : 1;
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
    const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
    const right = channels === 2 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

    const blockSize = 1152;
    const mp3Data = [];
    for (let i = 0; i < left.length; i += blockSize) {
      const leftChunk = left.subarray(i, i + blockSize);
      const mp3buf = right
        ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize))
        : encoder.encodeBuffer(leftChunk);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
    const end = encoder.flush();
    if (end.length > 0) mp3Data.push(end);
    return new Blob(mp3Data, { type: "audio/mp3" });
  }

  return {
    listVoices,
    speak,
    stopSpeaking,
    startRecording,
    stopRecording,
    isRecording,
    isTabAudioCaptureSupported,
    recordSpeechAsBlob,
    cancelSpeechCapture,
    decodeBlob,
    mixNarrationWithMusic,
    encodeMp3,
    previewRecordedMix,
    previewSpeechWithMusic,
    stopPreview,
  };
})();
