"""
SupaBein AI Builder — describe your project, Gemini generates and provisions it.

Usage:
  GEMINI_API_KEY=your_key python supabein_ai_builder.py

Optional (to auto-provision on SupaBein after generating):
  SUPABEIN_EMAIL=you@example.com SUPABEIN_PASSWORD=pass python supabein_ai_builder.py
"""

import os
import sys
import json
import textwrap

sys.path.insert(0, os.path.dirname(__file__))
from gemini import GeminiClient
from supabein import SupaBeinClient, SupaBeinError

# ── Full SupaBein API docs embedded as Gemini context ─────────────────────────
# Gemini's 1M-token context window lets us fit the entire docs as a system prompt.

SUPABEIN_DOCS = """
SupaBein is a Backend-as-a-Service platform. Base URL: /api/v1

== AUTH ==
POST /api/v1/auth/signup   body: {email, password}  → {token}
POST /api/v1/auth/login    body: {email, password}  → {token}
GET  /api/v1/auth/me       header: Authorization: Bearer <token>  → {id,email,role}

== PROJECTS ==
GET    /api/v1/projects          → list of projects
POST   /api/v1/projects          body: {name}  → {id, anon_key, service_key}
DELETE /api/v1/projects/:id

== TABLES ==
GET  /api/v1/projects/:id/tables
POST /api/v1/projects/:id/tables  body: {name}

Table name rules: ^[a-zA-Z_][a-zA-Z0-9_]{0,63}$

== COLUMNS ==
POST /api/v1/projects/:id/tables/:name/columns
body: {name, type, nullable (bool, default true), default (optional)}

Supported types: INT  BIGINT  VARCHAR(255)  TEXT  BOOLEAN
                 DECIMAL(10,2)  DATETIME  DATE  TIMESTAMP  JSON  FLOAT

Note: id (INT AUTO_INCREMENT PRIMARY KEY) and created_at (TIMESTAMP) columns
are automatically added to every table. Do NOT add them manually.

== POLICIES (Row-Level Security) ==
PUT /api/v1/projects/:id/tables/:name/policies
body: array of:
  {api_role: "anon"|"authenticated", operation: "SELECT"|"INSERT"|"UPDATE"|"DELETE", allowed: bool}

Roles:
  anon          — unauthenticated / using anon_key
  authenticated — requests with a valid user JWT
  owner JWT and service_key always bypass policies

Optional constraint_sql: WHERE clause, use :current_user_id for logged-in user's ID.
Example: {"api_role":"authenticated","operation":"SELECT","allowed":true,"constraint_sql":"user_id = :current_user_id"}

== DATA API ==
GET    /api/v1/data/:project_id/:table?limit=20&offset=0  → list rows
       Filters: ?col=value (exact), ?col=op.value (eq/neq/gt/gte/lt/lte/like)
       Sort: ?order=col.asc  or  ?order=col.desc,other.asc
POST   /api/v1/data/:project_id/:table  body: row object  → inserted row
GET    /api/v1/data/:project_id/:table/:id                → single row
PATCH  /api/v1/data/:project_id/:table/:id  body: partial → updated row
DELETE /api/v1/data/:project_id/:table/:id

Rate limit: 600 requests/min per project.

== FILE STORAGE ==
POST   /api/v1/projects/:id/storage/:bucket  multipart file  → {name,bucket,size,url}
GET    /api/v1/projects/:id/storage/:bucket                  → {files:[{name,size,url}]}
DELETE /api/v1/projects/:id/storage/:bucket/:filename
GET    /api/v1/storage/:project_id/:bucket/:filename         (public, no auth)

Max file size: 50 MB. Blocked: .php .py .sh .exe .cgi

== SITES & DEPLOYS ==
POST /api/v1/projects/:id/sites  body: {subdomain, spa_mode: bool}  → site object
POST /api/v1/projects/:id/sites/:site_id/deploys  multipart zipfile  → deploy object
  - Zip files at root: cd dist && zip -r ../deploy.zip .
  - Site live at: /sites/s{site_id}/current/
POST /api/v1/projects/:id/sites/:site_id/deploys/:deploy_id/rollback

== PYTHON CLIENT PATTERN ==
import json, urllib.request

def api(method, path, body=None, token=None):
    url = f"http://supabein.dxinnovationhub.com{path}"
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, json.dumps(body).encode() if body else None, headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())
"""

SYSTEM_PROMPT = f"""You are a SupaBein expert and project architect.
SupaBein is a Backend-as-a-Service (like Supabase) with auth, database tables, \
a data API, file storage, and static site hosting.

== SupaBein API Reference ==
{SUPABEIN_DOCS}

== Your job ==
When a user describes a project, you must produce a COMPLETE, RUNNABLE Python script that:

1. Signs up / logs in to SupaBein
2. Creates a project with a clear name
3. Creates all necessary tables with proper column types
4. Sets sensible RLS policies (who can read/write what)
5. Inserts realistic sample data so the project is immediately usable
6. Prints clear status messages for each step

Rules:
- Use ONLY urllib (no external libraries)
- Use environment variables: SUPABEIN_EMAIL, SUPABEIN_PASSWORD, SUPABEIN_BASE (default: http://supabein.dxinnovationhub.com/api/v1)
- Do NOT add id or created_at columns — they are auto-created
- Every table needs a realistic set of columns for the use case
- Always set policies: authenticated users get full CRUD; anon gets SELECT only unless there's a reason to restrict
- Add constraint_sql "user_id = :current_user_id" on UPDATE/DELETE when a table has a user_id column
- Output ONLY the Python script — no explanation before or after, no markdown fences
"""


def ask_gemini(description: str, api_key: str) -> str:
    gm = GeminiClient(api_key)
    return gm.generate(
        prompt=f"Build this project on SupaBein:\n\n{description}",
        system=SYSTEM_PROMPT,
        max_tokens=8192,
    )


def try_provision(script: str, email: str, password: str):
    """Optionally execute the generated script."""
    import tempfile, subprocess
    env = os.environ.copy()
    env["SUPABEIN_EMAIL"] = email
    env["SUPABEIN_PASSWORD"] = password

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(script)
        tmp = f.name

    print("\nRunning generated setup script...\n" + "─" * 60)
    result = subprocess.run([sys.executable, tmp], env=env,
                            capture_output=False, text=True)
    os.unlink(tmp)

    if result.returncode != 0:
        print(f"\nScript exited with code {result.returncode}")


def save_script(script: str, slug: str):
    name = "".join(c if c.isalnum() or c in "-_" else "_" for c in slug.lower())[:40]
    path = os.path.join(os.path.dirname(__file__), f"generated_{name}.py")
    with open(path, "w") as f:
        f.write(script)
    return path


def main():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print("ERROR: Set GEMINI_API_KEY first.")
        print("  export GEMINI_API_KEY=your_key")
        sys.exit(1)

    email = os.environ.get("SUPABEIN_EMAIL", "")
    password = os.environ.get("SUPABEIN_PASSWORD", "")

    print("=" * 60)
    print("  SupaBein AI Builder — powered by Gemini 2.5 Flash")
    print("=" * 60)
    print("Describe the project you want to build.")
    print("Gemini will generate a complete SupaBein setup script.\n")
    print("Examples:")
    print("  • A task management app where users can create projects and assign tasks")
    print("  • An e-commerce store with products, orders, and reviews")
    print("  • A blog platform with posts, categories, and comments")
    print("  • A booking system for appointments with time slots")
    print()

    print("Your project description:")
    lines = []
    while True:
        try:
            line = input()
            if not line and lines:
                break
            lines.append(line)
        except EOFError:
            break
    description = "\n".join(lines).strip()

    if not description:
        print("No description provided. Exiting.")
        sys.exit(0)

    print(f"\nGenerating SupaBein setup with Gemini 2.5...\n" + "─" * 60)

    try:
        script = ask_gemini(description, api_key)
    except Exception as e:
        print(f"Gemini error: {e}")
        sys.exit(1)

    # Strip markdown fences if Gemini wraps in them
    if script.startswith("```"):
        lines_s = script.split("\n")
        script = "\n".join(lines_s[1:-1] if lines_s[-1].startswith("```") else lines_s[1:])

    print(script)

    # Save the script
    first_line = description.split("\n")[0]
    path = save_script(script, first_line)
    print(f"\n{'─'*60}")
    print(f"✓ Script saved to: {path}")

    # Offer to run it
    if email and password:
        run = input("\nProvision this on SupaBein now? [y/N] ").strip().lower()
        if run == "y":
            try_provision(script, email, password)
    else:
        print("\nTo provision on SupaBein, set env vars and re-run:")
        print(f"  SUPABEIN_EMAIL=you@example.com SUPABEIN_PASSWORD=pass python {os.path.basename(path)}")


if __name__ == "__main__":
    main()
