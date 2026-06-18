import json
import urllib.request
import urllib.error

API_KEY = "b13212f7627d4f8da344d00c85717ef6.jTjVrTsBXt3CEQVf"
BASE_URL = "https://api.z.ai/api/paas/v4/chat/completions"

payload = {
    "model": "glm-5.2",
    "messages": [
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "Say hello and tell me which model you are in one sentence."}
    ]
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

req = urllib.request.Request(
    BASE_URL,
    data=json.dumps(payload).encode("utf-8"),
    headers=headers,
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        data = json.loads(body)
        print("STATUS: OK")
        print("Model:", data.get("model", "N/A"))
        msg = data["choices"][0]["message"]["content"]
        print("Response:", msg)
        usage = data.get("usage", {})
        print("Tokens used:", usage)
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print(f"HTTP ERROR {e.code}: {body}")
except urllib.error.URLError as e:
    print(f"URL ERROR: {e.reason}")
