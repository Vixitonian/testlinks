"""
AI Smart Notes — CLI powered by SupaBein + Gemini 2.5 Flash

Commands:
  python app.py add   "Your note content here"
  python app.py list  [--limit N] [--tag TAG]
  python app.py show  <id>
  python app.py ask   "What did I write about Python?"
  python app.py delete <id>

Required env vars:
  SUPABEIN_PROJECT_ID   - from setup_backend.py
  SUPABEIN_SERVICE_KEY  - from setup_backend.py
  GEMINI_API_KEY        - from aistudio.google.com/app/apikey

Optional:
  SUPABEIN_BASE         - defaults to http://supabein.dxinnovationhub.com/api/v1
"""

import os
import sys
import json
import argparse
import textwrap

sys.path.insert(0, os.path.dirname(__file__))
from supabein import SupaBeinClient, SupaBeinError
from gemini import GeminiClient

# ── Load config ───────────────────────────────────────────────────────────────

def load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), ".supabein_config.json")
    cfg = {}
    if os.path.exists(config_path):
        with open(config_path) as f:
            cfg = json.load(f)

    # Env vars override file values
    for key in ("SUPABEIN_BASE", "SUPABEIN_PROJECT_ID", "SUPABEIN_SERVICE_KEY", "GEMINI_API_KEY"):
        if os.environ.get(key):
            cfg[key] = os.environ[key]

    return cfg


def require_config(cfg: dict):
    missing = [k for k in ("SUPABEIN_PROJECT_ID", "SUPABEIN_SERVICE_KEY", "GEMINI_API_KEY")
               if not cfg.get(k)]
    if missing:
        print(f"ERROR: Missing config: {', '.join(missing)}")
        print("Run setup_backend.py first, then set env vars.")
        sys.exit(1)


def get_clients(cfg: dict):
    base = cfg.get("SUPABEIN_BASE", "http://supabein.dxinnovationhub.com/api/v1")
    sb = SupaBeinClient(base, token=cfg["SUPABEIN_SERVICE_KEY"])
    gm = GeminiClient(cfg["GEMINI_API_KEY"])
    return sb, gm, int(cfg["SUPABEIN_PROJECT_ID"])

# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_add(args, cfg):
    """Add a new note — Gemini auto-generates title, summary, and tags."""
    sb, gm, pid = get_clients(cfg)

    content = args.content
    if not content.strip():
        print("ERROR: Note content cannot be empty.")
        sys.exit(1)

    print("Analyzing with Gemini 2.5...")

    title = gm.generate_title(content)
    summary = gm.summarize(content)
    tags = gm.extract_tags(content)
    tags_str = ", ".join(tags)

    print(f"  Title   : {title}")
    print(f"  Summary : {summary}")
    print(f"  Tags    : {tags_str}")

    row = sb.insert(pid, "notes", {
        "title":   title,
        "content": content,
        "summary": summary,
        "tags":    tags_str,
    })

    print(f"\n✓ Note #{row['id']} saved to SupaBein.")


def cmd_list(args, cfg):
    """List notes, optionally filtered by tag."""
    sb, _, pid = get_clients(cfg)

    params = {"limit": args.limit, "order": "id.desc"}
    if args.tag:
        params["tags"] = f"like.%{args.tag}%"

    result = sb.list_rows(pid, "notes", params=params)
    rows = result if isinstance(result, list) else result.get("data", result.get("rows", []))

    if not rows:
        print("No notes found.")
        return

    print(f"\n{'ID':<5} {'TITLE':<35} {'TAGS':<30} SUMMARY")
    print("-" * 90)
    for n in rows:
        title = (n.get("title") or "Untitled")[:33]
        tags  = (n.get("tags")  or "")[:28]
        summary = textwrap.shorten(n.get("summary") or "", width=40)
        print(f"{n['id']:<5} {title:<35} {tags:<30} {summary}")


def cmd_show(args, cfg):
    """Show full content of a single note."""
    sb, _, pid = get_clients(cfg)

    note = sb.get_row(pid, "notes", args.id)
    print(f"\n{'='*60}")
    print(f"Note #{note['id']} — {note.get('title','Untitled')}")
    print(f"{'='*60}")
    print(f"Tags    : {note.get('tags','')}")
    print(f"Summary : {note.get('summary','')}")
    print(f"Created : {note.get('created_at','')}")
    print(f"\n{note.get('content','')}\n")


def cmd_ask(args, cfg):
    """Ask Gemini a natural-language question answered from your notes."""
    sb, gm, pid = get_clients(cfg)

    print(f"Fetching notes...")
    result = sb.list_rows(pid, "notes", params={"limit": 100})
    rows = result if isinstance(result, list) else result.get("data", result.get("rows", []))

    if not rows:
        print("No notes found to answer from.")
        return

    print(f"Asking Gemini across {len(rows)} notes...\n")
    answer = gm.answer_from_notes(args.question, rows)
    print(f"Answer:\n{answer}")


def cmd_delete(args, cfg):
    """Delete a note by ID."""
    sb, _, pid = get_clients(cfg)

    confirm = input(f"Delete note #{args.id}? [y/N] ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        return

    sb.delete_row(pid, "notes", args.id)
    print(f"✓ Note #{args.id} deleted.")

# ── CLI setup ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="app.py",
        description="AI Smart Notes — SupaBein + Gemini 2.5 Flash",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Examples:
          python app.py add "Gemini 2.5 Flash has 1M tokens/min free tier and supports 1M context."
          python app.py list
          python app.py list --limit 5 --tag api
          python app.py show 3
          python app.py ask "What did I note about free AI APIs?"
          python app.py delete 3
        """),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # add
    p_add = sub.add_parser("add", help="Add a note (Gemini auto-tags and summarizes)")
    p_add.add_argument("content", help="Note content")

    # list
    p_list = sub.add_parser("list", help="List notes")
    p_list.add_argument("--limit", type=int, default=20, help="Max notes to show (default 20)")
    p_list.add_argument("--tag", help="Filter by tag")

    # show
    p_show = sub.add_parser("show", help="Show full note by ID")
    p_show.add_argument("id", type=int)

    # ask
    p_ask = sub.add_parser("ask", help="Ask Gemini a question answered from your notes")
    p_ask.add_argument("question")

    # delete
    p_del = sub.add_parser("delete", help="Delete a note by ID")
    p_del.add_argument("id", type=int)

    args = parser.parse_args()

    cfg = load_config()
    require_config(cfg)

    dispatch = {
        "add":    cmd_add,
        "list":   cmd_list,
        "show":   cmd_show,
        "ask":    cmd_ask,
        "delete": cmd_delete,
    }
    dispatch[args.command](args, cfg)


if __name__ == "__main__":
    main()
