"""
Google Gemini 2.0 Flash — Free Code Generation API Test
Free tier: 1,500 requests/day · 1,000,000 tokens/minute · No credit card

Get your free API key at: https://aistudio.google.com/app/apikey
"""

import json
import urllib.request
import urllib.error
import os
import sys

API_KEY = os.environ.get("GEMINI_API_KEY", "")
PREFERRED_MODEL = "gemini-3.5-flash"
FALLBACK_MODEL = "gemini-2.5-flash"
MODEL = PREFERRED_MODEL  # resolved at runtime; falls back if 503

SYSTEM_INSTRUCTION = (
    "You are an expert software engineer. "
    "When asked to generate code, produce clean, well-structured, production-ready code. "
    "Include brief inline comments only where the logic is non-obvious. "
    "Always state the language at the top of your response."
)

DEMOS = [
    {
        "label": "Binary Search",
        "prompt": "Write a binary search function in Python with type hints.",
    },
    {
        "label": "REST API client",
        "prompt": (
            "Write a minimal Python class that wraps the requests library to call a "
            "JSON REST API with GET/POST support, automatic retries (3 attempts), and "
            "raises a custom exception on non-2xx responses."
        ),
    },
    {
        "label": "SQL query builder",
        "prompt": (
            "Generate a lightweight Python SQL query builder class that supports "
            "SELECT, WHERE, ORDER BY, and LIMIT clauses using method chaining."
        ),
    },
]


def call_gemini(prompt: str, model: str = None) -> dict:
    if not API_KEY:
        raise ValueError("Set the GEMINI_API_KEY environment variable first.")

    target = model or MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{target}:generateContent"

    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 8192,
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8")), target
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8"))
        # Auto-fallback: if preferred model is overloaded, retry with fallback
        if e.code == 503 and target == PREFERRED_MODEL:
            print(f"  [{PREFERRED_MODEL} overloaded — falling back to {FALLBACK_MODEL}]")
            return call_gemini(prompt, model=FALLBACK_MODEL)
        raise


def extract_text(response: dict) -> str:
    return response["candidates"][0]["content"]["parts"][0]["text"]


def extract_usage(response: dict) -> dict:
    return response.get("usageMetadata", {})


def run_demo(label: str, prompt: str) -> None:
    print(f"\n{'='*60}")
    print(f"DEMO: {label}")
    print(f"{'='*60}")
    print(f"PROMPT: {prompt}\n")

    try:
        data, used_model = call_gemini(prompt)
        text = extract_text(data)
        usage = extract_usage(data)

        print(f"[model: {used_model}]")
        print(text)
        print(
            f"\n[Tokens — prompt: {usage.get('promptTokenCount', '?')}, "
            f"output: {usage.get('candidatesTokenCount', '?')}, "
            f"total: {usage.get('totalTokenCount', '?')}]"
        )
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code}: {body}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"URL ERROR: {e.reason}")
        sys.exit(1)


if __name__ == "__main__":
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY environment variable not set.")
        print("Get a free key at: https://aistudio.google.com/app/apikey")
        print("Then run:  GEMINI_API_KEY=your_key python3 test_gemini_codegen.py")
        sys.exit(1)

    print(f"Model : {PREFERRED_MODEL} (fallback: {FALLBACK_MODEL})")
    print(f"Limits: 1,500 req/day · 1,000,000 tokens/min · FREE")

    for demo in DEMOS:
        run_demo(demo["label"], demo["prompt"])

    print(f"\n{'='*60}")
    print("All demos complete.")
