"""
Gemini 2.5 Flash client — focused on note intelligence tasks.
Falls back from gemini-3.5-flash to gemini-2.5-flash if overloaded.
"""

import json
import urllib.request
import urllib.error

PRIMARY_MODEL = "gemini-3.5-flash"
FALLBACK_MODEL = "gemini-2.5-flash"
_BASE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiClient:
    def __init__(self, api_key: str, model: str = PRIMARY_MODEL):
        self.api_key = api_key
        self.model = model

    def _url(self, model: str) -> str:
        return _BASE.format(model=model)

    def generate(self, prompt: str, system: str = None,
                 max_tokens: int = 1024, model: str = None) -> str:
        target = model or self.model
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": max_tokens},
        }
        if system:
            payload["system_instruction"] = {"parts": [{"text": system}]}

        req = urllib.request.Request(
            self._url(target),
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode())
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            # Auto-fallback when primary model is overloaded
            if e.code == 503 and target == PRIMARY_MODEL:
                return self.generate(prompt, system=system,
                                     max_tokens=max_tokens, model=FALLBACK_MODEL)
            try:
                msg = json.loads(raw).get("error", {}).get("message", raw)
            except Exception:
                msg = raw
            raise Exception(f"Gemini {e.code}: {msg}")

    # ── Note-specific helpers ─────────────────────────────────────────────────

    def summarize(self, content: str) -> str:
        return self.generate(
            f"Summarize this note in 1-2 sentences:\n\n{content}",
            system="You are a concise note summarizer. Return only the summary, no preamble.",
            max_tokens=150,
        )

    def extract_tags(self, content: str) -> list[str]:
        raw = self.generate(
            f"Extract 3-5 topic tags from this note. "
            f"Return only a comma-separated list of lowercase single-word tags:\n\n{content}",
            system="Return ONLY comma-separated tags. Example: python,api,database",
            max_tokens=60,
        )
        return [t.strip().lower() for t in raw.split(",") if t.strip()]

    def answer_from_notes(self, question: str, notes: list[dict]) -> str:
        if not notes:
            return "No notes found to answer from."

        context = "\n\n---\n\n".join(
            f"[Note #{n['id']}] {n.get('title', 'Untitled')}\n"
            f"Tags: {n.get('tags', '')}\n"
            f"{n['content']}"
            for n in notes
        )
        return self.generate(
            f"Question: {question}\n\nAvailable notes:\n\n{context}",
            system=(
                "Answer the question using only the notes provided. "
                "Cite note IDs when relevant. If the answer isn't in the notes, say so clearly."
            ),
            max_tokens=512,
        )

    def generate_title(self, content: str) -> str:
        return self.generate(
            f"Generate a short title (max 8 words) for this note:\n\n{content}",
            system="Return ONLY the title, no quotes, no punctuation at the end.",
            max_tokens=30,
        )
