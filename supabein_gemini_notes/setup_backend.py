"""
Run once to provision the SupaBein backend for AI Smart Notes.

Usage:
  SUPABEIN_EMAIL=you@example.com SUPABEIN_PASSWORD=yourpass python setup_backend.py

Writes .supabein_config.json with project_id and keys.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from supabein import SupaBeinClient, SupaBeinError

BASE = os.environ.get("SUPABEIN_BASE", "http://supabein.dxinnovationhub.com/api/v1")
EMAIL = os.environ.get("SUPABEIN_EMAIL", "")
PASSWORD = os.environ.get("SUPABEIN_PASSWORD", "")

if not EMAIL or not PASSWORD:
    print("ERROR: Set SUPABEIN_EMAIL and SUPABEIN_PASSWORD environment variables.")
    print("  export SUPABEIN_EMAIL=you@example.com")
    print("  export SUPABEIN_PASSWORD=yourpassword123")
    sys.exit(1)

sb = SupaBeinClient(BASE)

# ── Step 1: Auth ──────────────────────────────────────────────────────────────
print("1. Authenticating...")
try:
    result = sb.signup(EMAIL, PASSWORD)
    print(f"   Signed up as {EMAIL}")
except SupaBeinError as e:
    if e.status_code in (409, 422) or "exist" in str(e).lower() or "taken" in str(e).lower():
        result = sb.login(EMAIL, PASSWORD)
        print(f"   Logged in as {EMAIL}")
    else:
        print(f"   Auth error: {e}")
        sys.exit(1)

sb.token = result["token"]

# ── Step 2: Create project ────────────────────────────────────────────────────
print("2. Creating project 'AI Smart Notes'...")
project = sb.create_project("AI Smart Notes")
project_id = project["id"]
anon_key = project["anon_key"]
service_key = project["service_key"]
print(f"   Project ID: {project_id}")

# ── Step 3: Create notes table ────────────────────────────────────────────────
print("3. Creating 'notes' table...")
sb.create_table(project_id, "notes")

columns = [
    ("title",      "VARCHAR(255)", False, None),
    ("content",    "TEXT",         False, None),
    ("summary",    "TEXT",         True,  None),
    ("tags",       "VARCHAR(255)", True,  None),
    ("created_at", "TIMESTAMP",    True,  "CURRENT_TIMESTAMP"),
]
for name, col_type, nullable, default in columns:
    sb.add_column(project_id, "notes", name, col_type, nullable, default)
    print(f"   + {name} ({col_type})")

# ── Step 4: Set Row-Level Security policies ───────────────────────────────────
print("4. Setting RLS policies...")
sb.set_policies(project_id, "notes", [
    {"api_role": "authenticated", "operation": "SELECT", "allowed": True},
    {"api_role": "authenticated", "operation": "INSERT", "allowed": True},
    {"api_role": "authenticated", "operation": "UPDATE", "allowed": True},
    {"api_role": "authenticated", "operation": "DELETE", "allowed": True},
    {"api_role": "anon",          "operation": "SELECT", "allowed": False},
    {"api_role": "anon",          "operation": "INSERT", "allowed": False},
])
print("   Authenticated users: full CRUD | Anon: blocked")

# ── Step 5: Save config ───────────────────────────────────────────────────────
config_path = os.path.join(os.path.dirname(__file__), ".supabein_config.json")
config = {
    "SUPABEIN_BASE": BASE,
    "SUPABEIN_PROJECT_ID": project_id,
    "SUPABEIN_ANON_KEY": anon_key,
    "SUPABEIN_SERVICE_KEY": service_key,
}
with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print(f"\n✓ Setup complete! Config saved to {config_path}")
print("\nNext step — set these env vars, then run the app:")
print(f"  export SUPABEIN_PROJECT_ID={project_id}")
print(f"  export SUPABEIN_SERVICE_KEY={service_key}")
print(f"  export GEMINI_API_KEY=your_gemini_key")
print(f"  python app.py --help")
