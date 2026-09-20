// Verse text lookup via the free, keyless bible-api.com (public domain WEB translation).
const Bible = (() => {
  const BASE = "https://bible-api.com";

  function reference(book, chapter, verseStart, verseEnd) {
    const range = verseEnd && verseEnd !== verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`;
    return `${book} ${chapter}:${range}`;
  }

  async function fetchPassage(book, chapter, verseStart, verseEnd) {
    const ref = reference(book, chapter, verseStart, verseEnd);
    const res = await fetch(`${BASE}/${encodeURIComponent(ref)}`);
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

  return { fetchPassage, reference };
})();
