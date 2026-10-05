// Verse text lookup via the free, keyless bible-api.com. Only public-domain
// translations are available here (NIV is copyrighted by Biblica and isn't
// offered by any free Bible API, this one included).
const Bible = (() => {
  const BASE = "https://bible-api.com";

  const TRANSLATIONS = [
    { id: "web", label: "World English Bible (WEB)" },
    { id: "kjv", label: "King James Version (KJV)" },
  ];

  function reference(book, chapter, verseStart, verseEnd) {
    const range = verseEnd && verseEnd !== verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`;
    return `${book} ${chapter}:${range}`;
  }

  async function fetchPassage(book, chapter, verseStart, verseEnd, translation = "web") {
    const ref = reference(book, chapter, verseStart, verseEnd);
    const res = await fetch(`${BASE}/${encodeURIComponent(ref)}?translation=${translation}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Could not find ${ref}`);
    }
    const data = await res.json();
    return {
      reference: data.reference,
      text: data.text.trim(),
      translation: data.translation_name,
    };
  }

  return { fetchPassage, reference, TRANSLATIONS };
})();
