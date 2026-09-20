(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements ----
  const listView = $("listView");
  const notesList = $("notesList");
  const listHint = $("listHint");
  const addNoteBtn = $("addNoteBtn");

  const editView = $("editView");
  const backBtn = $("backBtn");
  const editTitle = $("editTitle");
  const deleteNoteBtn = $("deleteNoteBtn");

  const bookSelect = $("bookSelect");
  const chapterSelect = $("chapterSelect");
  const verseStart = $("verseStart");
  const verseEnd = $("verseEnd");
  const addVerseBtn = $("addVerseBtn");
  const verseListEl = $("verseList");
  const combinedTextCard = $("combinedTextCard");
  const combinedTextEl = $("combinedText");

  const currentAudioBlock = $("currentAudioBlock");
  const currentAudioPlayer = $("currentAudioPlayer");
  const currentAudioLoop = $("currentAudioLoop");

  const voiceSelect = $("voiceSelect");
  const rateRange = $("rateRange");
  const speakBtn = $("speakBtn");
  const stopSpeakBtn = $("stopSpeakBtn");

  const recordBtn = $("recordBtn");
  const stopRecordBtn = $("stopRecordBtn");
  const recordStatus = $("recordStatus");
  const narrationPlayer = $("narrationPlayer");

  const musicChoice = $("musicChoice");
  const musicFile = $("musicFile");
  const narrationVolume = $("narrationVolume");
  const musicVolume = $("musicVolume");

  const previewBtn = $("previewBtn");
  const stopPreviewBtn = $("stopPreviewBtn");
  const previewHint = $("previewHint");

  const saveBtn = $("saveBtn");
  const saveStatus = $("saveStatus");
  const saveHint = $("saveHint");

  const DEFAULT_MUSIC_URL = "assets/meditation-bg.mp3";

  // ---- State ----
  let verseList = []; // { book, chapter, verseStart, verseEnd, reference, text }
  let narrationBlob = null;
  let editingRow = null; // the saved row being edited, or null when creating new

  // ---- Navigation ----
  function showList() {
    editView.classList.add("hidden");
    listView.classList.remove("hidden");
    loadNotes();
  }

  function showEditor(row) {
    editingRow = row || null;
    verseList = [];
    narrationBlob = null;
    narrationPlayer.src = "";
    narrationPlayer.classList.add("hidden");
    recordStatus.textContent = "";
    musicChoice.value = "default";
    musicFile.value = "";
    musicFile.classList.add("hidden");
    narrationVolume.value = 1;
    musicVolume.value = 0.25;
    previewHint.textContent = "Record your voice above, then preview it mixed with music here.";

    if (row) {
      editTitle.textContent = "Edit creation";
      deleteNoteBtn.classList.remove("hidden");
      currentAudioBlock.classList.remove("hidden");
      currentAudioPlayer.src = row.audio_url;
      currentAudioLoop.checked = false;
      currentAudioPlayer.loop = false;
      const refs = (row.verses_json || []).length ? row.verses_json : null;
      const texts = (row.verse_text || "").split("\n\n");
      if (refs) {
        refs.forEach((v, i) => {
          verseList.push({
            book: v.book,
            chapter: v.chapter,
            verseStart: v.verse_start,
            verseEnd: v.verse_end,
            reference: v.reference,
            text: texts[i] || "",
          });
        });
      }
    } else {
      editTitle.textContent = "New creation";
      deleteNoteBtn.classList.add("hidden");
      currentAudioBlock.classList.add("hidden");
      currentAudioPlayer.src = "";
    }

    renderVerseList();
    listView.classList.add("hidden");
    editView.classList.remove("hidden");
  }

  addNoteBtn.addEventListener("click", () => showEditor(null));
  backBtn.addEventListener("click", () => {
    HagahAudio.stopPreview();
    HagahAudio.stopSpeaking();
    showList();
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

  // ---- Listen (device voice, preview only) ----
  async function populateVoices() {
    const voices = await HagahAudio.listVoices();
    const english = voices.filter((v) => v.lang.startsWith("en"));
    voiceSelect.innerHTML = "";
    (english.length ? english : voices).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    });
  }

  speakBtn.addEventListener("click", () => {
    if (!verseList.length) return alert("Add at least one verse first.");
    HagahAudio.speak(combinedText(), {
      rate: Number(rateRange.value),
      voiceURI: voiceSelect.value,
    });
  });

  stopSpeakBtn.addEventListener("click", () => HagahAudio.stopSpeaking());

  // ---- Recording ----
  function setNarration(blob, statusText) {
    narrationBlob = blob;
    narrationPlayer.src = URL.createObjectURL(blob);
    narrationPlayer.classList.remove("hidden");
    recordStatus.textContent = statusText;
    updateSaveState();
  }

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
    setNarration(blob, "Recorded.");
  });

  function updateSaveState() {
    const ready = verseList.length > 0 && (Boolean(narrationBlob) || Boolean(editingRow));
    saveBtn.disabled = !ready;
    if (!verseList.length) {
      saveHint.textContent = "Add a verse and narrate it to enable saving.";
    } else if (!narrationBlob && !editingRow) {
      saveHint.textContent = "Record your voice above to enable saving.";
    } else if (!narrationBlob && editingRow) {
      saveHint.textContent = "Ready — will keep the current recording unless you record a new one.";
    } else {
      saveHint.textContent = "Ready to save.";
    }
  }

  // ---- Background music ----
  musicChoice.addEventListener("change", () => {
    musicFile.classList.toggle("hidden", musicChoice.value !== "custom");
  });

  async function getMusicBlob() {
    if (musicChoice.value === "none") return null;
    if (musicChoice.value === "custom") return musicFile.files[0] || null;
    const res = await fetch(DEFAULT_MUSIC_URL);
    return res.blob();
  }

  // ---- Preview ----
  previewBtn.addEventListener("click", async () => {
    if (!narrationBlob) return alert("Record your voice first — the current saved recording can't be previewed here.");
    try {
      previewHint.textContent = "Playing...";
      const music = await getMusicBlob();
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

  currentAudioLoop.addEventListener("change", () => {
    currentAudioPlayer.loop = currentAudioLoop.checked;
  });

  // ---- Save ----
  saveBtn.addEventListener("click", async () => {
    if (!verseList.length) return;
    if (!narrationBlob && !editingRow) return;
    HagahAudio.stopPreview();
    saveBtn.disabled = true;
    const reference = combinedReference();
    const metadata = {
      verse_ref: reference,
      verse_text: combinedText(),
      verses_json: verseList.map((v) => ({
        book: v.book,
        chapter: v.chapter,
        verse_start: v.verseStart,
        verse_end: v.verseEnd,
        reference: v.reference,
      })),
    };

    try {
      if (narrationBlob) {
        saveStatus.textContent = "Mixing...";
        const narrationBuffer = await HagahAudio.decodeBlob(narrationBlob);
        let musicBuffer = null;
        const music = await getMusicBlob();
        if (music) {
          try {
            musicBuffer = await HagahAudio.decodeBlob(music);
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
        const filename = `${Date.now()}_${reference.replace(/[^a-z0-9]+/gi, "_").slice(0, 80)}.mp3`;
        const audioUrl = await Supabein.uploadAudio(mp3Blob, filename);
        metadata.audio_url = audioUrl;
        metadata.background_track = musicChoice.value === "none" ? null : musicChoice.value === "default" ? "meditation-bg.mp3" : musicFile.files[0].name;

        if (editingRow) {
          await Supabein.updateRecording(editingRow.id, metadata);
          const oldFilename = editingRow.audio_url.split("/").pop();
          await Supabein.deleteAudio(oldFilename).catch(() => {});
        } else {
          await Supabein.insertRecording(metadata);
        }
      } else {
        saveStatus.textContent = "Saving...";
        await Supabein.updateRecording(editingRow.id, metadata);
      }
      saveStatus.textContent = "Saved!";
      showList();
    } catch (err) {
      saveStatus.textContent = `Failed: ${err.message}`;
      console.error(err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  deleteNoteBtn.addEventListener("click", async () => {
    if (!editingRow) return;
    if (!confirm("Delete this creation? This can't be undone.")) return;
    try {
      const filename = editingRow.audio_url.split("/").pop();
      await Supabein.deleteRecording(editingRow.id);
      await Supabein.deleteAudio(filename).catch(() => {});
      showList();
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  });

  // ---- List ----
  async function loadNotes() {
    if (!Supabein.isConfigured()) {
      listHint.textContent = "Missing js/config.js — see js/config.example.js.";
      listHint.classList.remove("hidden");
      notesList.innerHTML = "";
      return;
    }
    listHint.textContent = "Loading...";
    listHint.classList.remove("hidden");
    notesList.innerHTML = "";
    try {
      const { data } = await Supabein.listRecordings();
      if (!data.length) {
        listHint.textContent = "No creations yet — tap + to add one.";
        return;
      }
      listHint.classList.add("hidden");
      data.forEach((row) => {
        const el = document.createElement("button");
        el.className = "note-row";
        el.type = "button";
        const main = document.createElement("div");
        main.className = "note-main";
        const title = document.createElement("p");
        title.className = "note-title";
        title.textContent = row.verse_ref;
        const meta = document.createElement("p");
        meta.className = "note-meta";
        meta.textContent = new Date(row.created_at).toLocaleString();
        main.append(title, meta);
        const chevron = document.createElement("span");
        chevron.className = "chevron";
        chevron.textContent = "›";
        el.append(main, chevron);
        el.addEventListener("click", () => showEditor(row));
        notesList.appendChild(el);
      });
    } catch (err) {
      listHint.textContent = `Failed to load: ${err.message}`;
      listHint.classList.remove("hidden");
    }
  }

  // ---- Init ----
  populateBooks();
  populateVoices();
  loadNotes();
})();
