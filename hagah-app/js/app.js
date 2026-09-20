(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements ----
  const tabCreate = $("tabCreate");
  const tabLibrary = $("tabLibrary");
  const createView = $("createView");
  const libraryView = $("libraryView");

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
  const addVerseBtn = $("addVerseBtn");
  const verseListEl = $("verseList");
  const combinedTextCard = $("combinedTextCard");
  const combinedTextEl = $("combinedText");

  const narrationSourceRadios = document.getElementsByName("narrationSource");
  const micSource = $("micSource");
  const voiceSource = $("voiceSource");

  const voiceSelect = $("voiceSelect");
  const generateVoiceBtn = $("generateVoiceBtn");
  const generateVoiceStatus = $("generateVoiceStatus");
  const generateVoiceProgress = $("generateVoiceProgress");
  const generateVoiceProgressFill = $("generateVoiceProgressFill");

  const recordBtn = $("recordBtn");
  const stopRecordBtn = $("stopRecordBtn");
  const recordStatus = $("recordStatus");
  const narrationPlayer = $("narrationPlayer");

  const musicFile = $("musicFile");
  const narrationVolume = $("narrationVolume");
  const musicVolume = $("musicVolume");

  const previewBtn = $("previewBtn");
  const stopPreviewBtn = $("stopPreviewBtn");
  const previewHint = $("previewHint");

  const saveBtn = $("saveBtn");
  const saveStatus = $("saveStatus");
  const saveHint = $("saveHint");

  const refreshLibraryBtn = $("refreshLibraryBtn");
  const libraryGrid = $("libraryGrid");
  const libraryHint = $("libraryHint");

  // ---- State ----
  let verseList = []; // { book, chapter, verseStart, verseEnd, reference, text }
  let narrationBlob = null;

  // ---- Tabs ----
  function setView(view) {
    createView.classList.toggle("hidden", view !== "create");
    libraryView.classList.toggle("hidden", view !== "library");
    tabCreate.classList.toggle("active", view === "create");
    tabLibrary.classList.toggle("active", view === "library");
    if (view === "library") loadLibrary();
  }
  tabCreate.addEventListener("click", () => setView("create"));
  tabLibrary.addEventListener("click", () => setView("library"));

  // ---- Settings ----
  function refreshConnectionStatus() {
    const cfg = Supabein.getConfig();
    if (cfg.projectId && cfg.token) {
      connectionStatus.textContent = `Connected to project ${cfg.projectId}`;
      projectIdInput.value = cfg.projectId;
    } else {
      connectionStatus.textContent = "Not connected";
    }
    libraryHint.classList.toggle("hidden", Supabein.isConfigured());
    updateSaveState();
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
      refreshConnectionStatus();
      if (!libraryView.classList.contains("hidden")) loadLibrary();
    } catch (err) {
      connectionStatus.textContent = `Connection failed: ${err.message}`;
      Supabein.clearConfig();
    }
  });

  disconnectBtn.addEventListener("click", () => {
    Supabein.clearConfig();
    refreshConnectionStatus();
    libraryGrid.innerHTML = "";
  });

  // ---- Verse builder ----
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

  function renderVerseList() {
    verseListEl.innerHTML = "";
    verseList.forEach((v, i) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = v.reference;
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.title = "Remove";
      removeBtn.addEventListener("click", () => {
        verseList.splice(i, 1);
        renderVerseList();
      });
      li.append(label, removeBtn);
      verseListEl.appendChild(li);
    });
    if (verseList.length) {
      combinedTextEl.textContent = verseList.map((v) => v.text).join("\n\n");
      combinedTextCard.classList.remove("hidden");
    } else {
      combinedTextCard.classList.add("hidden");
    }
    updateSaveState();
  }

  function combinedText() {
    return verseList.map((v) => v.text).join("\n\n");
  }

  function combinedReference() {
    return verseList.map((v) => v.reference).join("; ");
  }

  addVerseBtn.addEventListener("click", async () => {
    addVerseBtn.disabled = true;
    addVerseBtn.textContent = "Adding...";
    try {
      const book = bookSelect.value;
      const chapter = Number(chapterSelect.value);
      const vStart = Number(verseStart.value);
      const vEnd = verseEnd.value ? Number(verseEnd.value) : vStart;
      const passage = await Bible.fetchPassage(book, chapter, vStart, vEnd);
      verseList.push({
        book,
        chapter,
        verseStart: vStart,
        verseEnd: vEnd,
        reference: passage.reference,
        text: passage.text,
      });
      renderVerseList();
    } catch (err) {
      alert(err.message);
    } finally {
      addVerseBtn.disabled = false;
      addVerseBtn.textContent = "+ Add verse";
    }
  });

  // ---- Narration source toggle ----
  function setNarrationSource(source) {
    micSource.classList.toggle("hidden", source !== "mic");
    voiceSource.classList.toggle("hidden", source !== "voice");
  }
  narrationSourceRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => setNarrationSource(e.target.value));
  });

  function setNarration(blob, statusEl, statusText) {
    narrationBlob = blob;
    narrationPlayer.src = URL.createObjectURL(blob);
    narrationPlayer.classList.remove("hidden");
    if (statusEl) statusEl.textContent = statusText;
    updateSaveState();
  }

  function updateSaveState() {
    const ready = verseList.length > 0 && Boolean(narrationBlob);
    saveBtn.disabled = !ready;
    if (!verseList.length) {
      saveHint.textContent = "Add a verse and narrate it to enable saving.";
    } else if (!narrationBlob) {
      saveHint.textContent = "Narrate your passage above to enable saving.";
    } else if (!Supabein.isConfigured()) {
      saveHint.textContent = "Connect to Supabein (⚙ Settings) to save your creation.";
    } else {
      saveHint.textContent = "Ready to save.";
    }
  }

  // ---- Voice list (English-only local Piper neural voices) ----
  function populateVoices() {
    voiceSelect.innerHTML = "";
    ENGLISH_VOICES.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.label;
      voiceSelect.appendChild(opt);
    });
  }

  generateVoiceBtn.addEventListener("click", async () => {
    if (!verseList.length) return alert("Add at least one verse first.");
    if (!window.PiperTTS) {
      return alert("The narration engine is still loading — wait a moment and try again.");
    }
    generateVoiceBtn.disabled = true;
    generateVoiceStatus.textContent = "Loading voice model...";
    generateVoiceProgress.classList.remove("hidden");
    generateVoiceProgressFill.style.width = "0%";
    try {
      const blob = await window.PiperTTS.predict(combinedText(), voiceSelect.value, (progress) => {
        if (progress.total) {
          const pct = Math.round((progress.loaded * 100) / progress.total);
          generateVoiceProgressFill.style.width = `${pct}%`;
          generateVoiceStatus.textContent = pct < 100 ? `Downloading voice model... ${pct}%` : "Synthesizing...";
        }
      });
      setNarration(blob, generateVoiceStatus, "Narration generated.");
    } catch (err) {
      generateVoiceStatus.textContent = `Failed: ${err.message}`;
      console.error(err);
    } finally {
      generateVoiceBtn.disabled = false;
      generateVoiceProgress.classList.add("hidden");
    }
  });

  // ---- Recording ----
  recordBtn.addEventListener("click", async () => {
    if (!verseList.length) return alert("Add at least one verse first so you know what to read.");
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
    const blob = await HagahAudio.stopRecording();
    recordBtn.disabled = false;
    stopRecordBtn.disabled = true;
    setNarration(blob, recordStatus, "Recorded.");
  });

  // ---- Preview: hear the narration + background music together ----
  previewBtn.addEventListener("click", async () => {
    if (!narrationBlob) return alert("Narrate your passage first.");
    const music = musicFile.files[0] || null;
    try {
      previewHint.textContent = "Playing...";
      const duration = await HagahAudio.previewMix(narrationBlob, music, {
        narrationGain: Number(narrationVolume.value),
        musicGain: Number(musicVolume.value),
      });
      setTimeout(() => {
        previewHint.textContent = "Preview finished. Adjust the volumes above and preview again, or save below.";
      }, duration * 1000);
    } catch (err) {
      previewHint.textContent = `Preview failed: ${err.message}`;
      console.error(err);
    }
  });

  stopPreviewBtn.addEventListener("click", () => HagahAudio.stopPreview());

  // ---- Save ----
  saveBtn.addEventListener("click", async () => {
    if (!narrationBlob || !verseList.length) return;
    if (!Supabein.isConfigured()) {
      settingsPanel.classList.remove("hidden");
      return alert("Connect to Supabein in Settings first.");
    }
    HagahAudio.stopPreview();
    saveBtn.disabled = true;
    saveStatus.textContent = "Mixing...";
    try {
      const narrationBuffer = await HagahAudio.decodeBlob(narrationBlob);
      let musicBuffer = null;
      if (musicFile.files[0]) {
        try {
          musicBuffer = await HagahAudio.decodeBlob(musicFile.files[0]);
        } catch (musicErr) {
          console.error("Background music failed to decode, saving narration only:", musicErr);
          saveStatus.textContent = "Couldn't read that music file — saving your voice only...";
          musicBuffer = null;
        }
      }
      saveStatus.textContent = "Mixing...";
      const mixed = await HagahAudio.mixNarrationWithMusic(narrationBuffer, musicBuffer, {
        narrationGain: Number(narrationVolume.value),
        musicGain: Number(musicVolume.value),
      });
      saveStatus.textContent = "Encoding...";
      const mp3Blob = HagahAudio.encodeMp3(mixed);

      saveStatus.textContent = "Uploading...";
      const reference = combinedReference();
      const filename = `${Date.now()}_${reference.replace(/[^a-z0-9]+/gi, "_").slice(0, 80)}.mp3`;
      const audioUrl = await Supabein.uploadAudio(mp3Blob, filename);
      await Supabein.insertRecording({
        verse_ref: reference,
        verse_text: combinedText(),
        verses_json: verseList.map((v) => ({
          book: v.book,
          chapter: v.chapter,
          verse_start: v.verseStart,
          verse_end: v.verseEnd,
          reference: v.reference,
        })),
        background_track: musicFile.files[0] ? musicFile.files[0].name : null,
        audio_url: audioUrl,
      });
      saveStatus.textContent = "Saved!";
      setView("library");
    } catch (err) {
      saveStatus.textContent = `Failed: ${err.message}`;
      console.error(err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ---- Library ----
  async function loadLibrary() {
    if (!Supabein.isConfigured()) {
      libraryGrid.innerHTML = "";
      return;
    }
    libraryGrid.innerHTML = "<p class='hint'>Loading...</p>";
    try {
      const { data } = await Supabein.listRecordings();
      if (!data.length) {
        libraryGrid.innerHTML = "<p class='hint'>No creations saved yet.</p>";
        return;
      }
      libraryGrid.innerHTML = "";
      data.forEach((row) => {
        const card = document.createElement("div");
        card.className = "creation-card";

        const title = document.createElement("p");
        title.className = "title";
        title.textContent = row.verse_ref;

        const meta = document.createElement("p");
        meta.className = "meta";
        meta.textContent = `${new Date(row.created_at).toLocaleString()}${row.background_track ? " · " + row.background_track : ""}`;

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = row.audio_url;

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const loopLabel = document.createElement("label");
        loopLabel.className = "loop-label";
        const loopCheckbox = document.createElement("input");
        loopCheckbox.type = "checkbox";
        loopCheckbox.addEventListener("change", () => {
          audio.loop = loopCheckbox.checked;
        });
        loopLabel.append(loopCheckbox, document.createTextNode("Loop"));

        const delBtn = document.createElement("button");
        delBtn.className = "btn ghost";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", async () => {
          const filename = row.audio_url.split("/").pop();
          await Supabein.deleteRecording(row.id);
          await Supabein.deleteAudio(filename).catch(() => {});
          loadLibrary();
        });

        actions.append(loopLabel, delBtn);
        card.append(title, meta, audio, actions);
        libraryGrid.appendChild(card);
      });
    } catch (err) {
      libraryGrid.innerHTML = `<p class="hint">Failed to load: ${err.message}</p>`;
    }
  }

  refreshLibraryBtn.addEventListener("click", loadLibrary);

  // ---- Init ----
  populateBooks();
  populateVoices();
  refreshConnectionStatus();
})();
