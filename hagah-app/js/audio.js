// Microphone recording, background-music mixing, and MP3 encoding.
// All processing happens locally in the browser (Web Audio API + lamejs).
const HagahAudio = (() => {
  let audioCtx = null;
  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // ---- Live preview: hear narration + background music together before saving ----
  let previewSources = [];

  function stopPreview() {
    previewSources.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    previewSources = [];
  }

  // Preview of the actual narration (mic recording or generated voice) mixed
  // live with the music file, at the same volumes used when saving.
  async function previewMix(narrationBlob, musicFile, { narrationGain = 1, musicGain = 0.25 } = {}) {
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

  // ---- Microphone recording (one of the two narration sources) ----
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
    startRecording,
    stopRecording,
    isRecording,
    decodeBlob,
    mixNarrationWithMusic,
    encodeMp3,
    previewMix,
    stopPreview,
  };
})();
