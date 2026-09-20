(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements ----
  const settingsToggle = $("settingsToggle");
  const settingsPanel = $("settingsPanel");
  const projectIdInput = $("projectIdInput");
  const tokenInput = $("tokenInput");
  const connectBtn = $("connectBtn");
  const disconnectBtn = $("disconnectBtn");
  const connectionStatus = $("connectionStatus");

  const bookSelect = $("bookSelect");
  const chapterSelect = $("chapterSelect");
  const verseStart = $("verseStart");
  const verseEnd = $("verseEnd");
  const loadVerseBtn = $("loadVerseBtn");
  const verseCard = $("verseCard");
  const verseReference = $("verseReference");
  const verseText = $("verseText");
  const verseTranslation = $("verseTranslation");

  const voiceSelect = $("voiceSelect");
  const rateRange = $("rateRange");
  const speakBtn = $("speakBtn");
  const stopSpeakBtn = $("stopSpeakBtn");

  const recordBtn = $("recordBtn");
  const stopRecordBtn = $("stopRecordBtn");
  const recordStatus = $("recordStatus");
  const narrationPlayer = $("narrationPlayer");

  const musicFile = $("musicFile");
  const narrationVolume = $("narrationVolume");
  const musicVolume = $("musicVolume");

  const exportBtn = $("exportBtn");
  const exportStatus = $("exportStatus");
  const exportResult = $("exportResult");
  const mixPlayer = $("mixPlayer");
  const downloadLink = $("downloadLink");
  const saveToLibraryBtn = $("saveToLibraryBtn");

  const refreshLibraryBtn = $("refreshLibraryBtn");
  const libraryList = $("libraryList");

  // ---- State ----
  let currentVerse = null;
  let narrationBlob = null;
  let mixedMp3Blob = null;

  // ---- Settings ----
  function refreshConnectionStatus() {
    const cfg = Supabein.getConfig();
    if (cfg.projectId && cfg.token) {
      connectionStatus.textContent = `Connected to project ${cfg.projectId}`;
      projectIdInput.value = cfg.projectId;
    } else {
      connectionStatus.textContent = "Not connected";
    }
  }

  settingsToggle.addEventListener("click", () => settingsPanel.classList.toggle("hidden"));

  connectBtn.addEventListener("click", async () => {
    const projectId = projectIdInput.value.trim();
    const token = tokenInput.value.trim();
    if (!projectId || !token) {
      connectionStatus.textContent = "Enter both project ID and token.";
      return;
    }
    Supabein.setConfig({ projectId, token });
    try {
      const me = await Supabein.whoAmI();
      connectionStatus.textContent = `Connected as ${me.email} (project ${me.project_id || projectId})`;
      tokenInput.value = "";
      loadLibrary();
    } catch (err) {
      connectionStatus.textContent = `Connection failed: ${err.message}`;
      Supabein.clearConfig();
    }
  });

  disconnectBtn.addEventListener("click", () => {
    Supabein.clearConfig();
    refreshConnectionStatus();
    libraryList.innerHTML = "";
  });

  // ---- Verse picker ----
  function populateBooks() {
    BIBLE_BOOKS.forEach(([name]) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      bookSelect.appendChild(opt);
    });
    populateChapters();
  }

  function populateChapters() {
    const book = BIBLE_BOOKS.find(([name]) => name === bookSelect.value);
    const count = book ? book[1] : 1;
    chapterSelect.innerHTML = "";
    for (let i = 1; i <= count; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Chapter ${i}`;
      chapterSelect.appendChild(opt);
    }
  }

  bookSelect.addEventListener("change", populateChapters);

  loadVerseBtn.addEventListener("click", async () => {
    loadVerseBtn.disabled = true;
    loadVerseBtn.textContent = "Loading...";
    try {
      const passage = await Bible.fetchPassage(
        bookSelect.value,
        Number(chapterSelect.value),
        Number(verseStart.value),
        verseEnd.value ? Number(verseEnd.value) : Number(verseStart.value)
      );
      currentVerse = {
        book: bookSelect.value,
        chapter: Number(chapterSelect.value),
        verseStart: Number(verseStart.value),
        verseEnd: verseEnd.value ? Number(verseEnd.value) : Number(verseStart.value),
        text: passage.text,
        reference: passage.reference,
      };
      verseReference.textContent = passage.reference;
      verseText.textContent = passage.text;
      verseTranslation.textContent = passage.translation;
      verseCard.classList.remove("hidden");
    } catch (err) {
      alert(err.message);
    } finally {
      loadVerseBtn.disabled = false;
      loadVerseBtn.textContent = "Load verse";
    }
  });

  // ---- Speech preview ----
  async function populateVoices() {
    const voices = await HagahAudio.listVoices();
    voiceSelect.innerHTML = "";
    voices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    });
  }

  speakBtn.addEventListener("click", () => {
    if (!currentVerse) return alert("Load a verse first.");
    HagahAudio.speak(currentVerse.text, {
      rate: Number(rateRange.value),
      voiceURI: voiceSelect.value,
    });
  });

  stopSpeakBtn.addEventListener("click", () => HagahAudio.stopSpeaking());

  // ---- Recording ----
  recordBtn.addEventListener("click", async () => {
    if (!currentVerse) return alert("Load a verse first so you know what to read.");
    try {
      await HagahAudio.startRecording();
      recordBtn.disabled = true;
      stopRecordBtn.disabled = false;
      recordStatus.textContent = "Recording...";
    } catch (err) {
      alert(`Could not access microphone: ${err.message}`);
    }
  });

  stopRecordBtn.addEventListener("click", async () => {
    narrationBlob = await HagahAudio.stopRecording();
    recordBtn.disabled = false;
    stopRecordBtn.disabled = true;
    recordStatus.textContent = "Recorded.";
    narrationPlayer.src = URL.createObjectURL(narrationBlob);
    narrationPlayer.classList.remove("hidden");
    exportBtn.disabled = false;
  });

  // ---- Export ----
  exportBtn.addEventListener("click", async () => {
    if (!narrationBlob) return alert("Record your voice first.");
    exportBtn.disabled = true;
    exportStatus.textContent = "Decoding audio...";
    try {
      const narrationBuffer = await HagahAudio.decodeBlob(narrationBlob);
      let musicBuffer = null;
      if (musicFile.files[0]) {
        musicBuffer = await HagahAudio.decodeBlob(musicFile.files[0]);
      }
      exportStatus.textContent = "Mixing...";
      const mixed = await HagahAudio.mixNarrationWithMusic(narrationBuffer, musicBuffer, {
        narrationGain: Number(narrationVolume.value),
        musicGain: Number(musicVolume.value),
      });
      exportStatus.textContent = "Encoding MP3...";
      mixedMp3Blob = HagahAudio.encodeMp3(mixed);
      const url = URL.createObjectURL(mixedMp3Blob);
      mixPlayer.src = url;
      downloadLink.href = url;
      const safeName = currentVerse ? currentVerse.reference.replace(/[^a-z0-9]+/gi, "_") : "hagah";
      downloadLink.download = `${safeName}.mp3`;
      exportResult.classList.remove("hidden");
      exportStatus.textContent = "Done.";
    } catch (err) {
      exportStatus.textContent = `Failed: ${err.message}`;
    } finally {
      exportBtn.disabled = false;
    }
  });

  saveToLibraryBtn.addEventListener("click", async () => {
    if (!mixedMp3Blob || !currentVerse) return;
    if (!Supabein.isConfigured()) return alert("Connect to Supabein in Settings first.");
    saveToLibraryBtn.disabled = true;
    saveToLibraryBtn.textContent = "Saving...";
    try {
      const filename = `${Date.now()}_${currentVerse.reference.replace(/[^a-z0-9]+/gi, "_")}.mp3`;
      const audioUrl = await Supabein.uploadAudio(mixedMp3Blob, filename);
      await Supabein.insertRecording({
        verse_ref: currentVerse.reference,
        book: currentVerse.book,
        chapter: currentVerse.chapter,
        verse_start: currentVerse.verseStart,
        verse_end: currentVerse.verseEnd,
        verse_text: currentVerse.text,
        background_track: musicFile.files[0] ? musicFile.files[0].name : null,
        audio_url: audioUrl,
      });
      saveToLibraryBtn.textContent = "Saved!";
      loadLibrary();
    } catch (err) {
      alert(`Could not save: ${err.message}`);
      saveToLibraryBtn.textContent = "Save to my library";
    } finally {
      saveToLibraryBtn.disabled = false;
    }
  });

  // ---- Library ----
  async function loadLibrary() {
    if (!Supabein.isConfigured()) return;
    libraryList.innerHTML = "<li>Loading...</li>";
    try {
      const { data } = await Supabein.listRecordings();
      if (!data.length) {
        libraryList.innerHTML = "<li>No recordings saved yet.</li>";
        return;
      }
      libraryList.innerHTML = "";
      data.forEach((row) => {
        const li = document.createElement("li");
        const info = document.createElement("div");
        info.innerHTML = `<strong>${row.verse_ref}</strong><br><span class="meta">${new Date(row.created_at).toLocaleString()}${row.background_track ? " · " + row.background_track : ""}</span>`;
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = row.audio_url;
        const delBtn = document.createElement("button");
        delBtn.className = "btn ghost";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", async () => {
          const filename = row.audio_url.split("/").pop();
          await Supabein.deleteRecording(row.id);
          await Supabein.deleteAudio(filename).catch(() => {});
          loadLibrary();
        });
        li.append(info, audio, delBtn);
        libraryList.appendChild(li);
      });
    } catch (err) {
      libraryList.innerHTML = `<li>Failed to load: ${err.message}</li>`;
    }
  }

  refreshLibraryBtn.addEventListener("click", loadLibrary);

  // ---- Init ----
  populateBooks();
  populateVoices();
  refreshConnectionStatus();
  if (Supabein.isConfigured()) loadLibrary();
})();
