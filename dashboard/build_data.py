#!/usr/bin/env python3
"""Build dashboard/data.js from real sources only.

Sources:
  * git  (repo name, branch, recent commits, files touched)
  * env  (SUPABEIN_PROJECT, SUPABEIN_PROJECT_ID, SUPABEIN_URL)

No secrets are written: the SupaBein token is never read into the output.
"""
import json
import os
import re
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent   # repo root
OUT = Path(__file__).resolve().parent / "data.js"
LIMIT = 30


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, text=True,
                          capture_output=True, check=True).stdout.strip()


def repo_slug() -> tuple[str, str]:
    url = git("remote", "get-url", "origin")
    m = re.search(r"github\.com[:/]+(.+?)/(.+?)(?:\.git)?$", url)
    if not m:
        return "unknown", url
    return m.group(1), m.group(2).removesuffix(".git")


def commits(limit: int) -> list[dict]:
    raw = git("log", f"-{limit}", "--pretty=%h\x1f%aI\x1f%s", "--date=iso-strict")
    out = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        sha, iso, subject = line.split("\x1f", 2)
        files = git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).splitlines()
        out.append({
            "sha": sha,
            "date": iso[:10],
            "iso": iso,
            "subject": subject,
            "files": len(files),
            "areas": sorted({f.split("/")[0] for f in files if f})[:4],
        })
    return out


def main() -> None:
    owner, name = repo_slug()
    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    branches = [b.strip() for b in git("branch", "-a", "--format=%(refname:short)").splitlines()]
    history = commits(LIMIT)

    sb_project = os.environ.get("SUPABEIN_PROJECT", "") or "not set"
    sb_id = os.environ.get("SUPABEIN_PROJECT_ID", "") or "not set"
    sb_url = os.environ.get("SUPABEIN_URL", "").rstrip("/") or "https://supabein.dxinnovationhub.com"

    data = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "workspace": ROOT.name,
        "repo": {
            "owner": owner,
            "name": name,
            "full": f"{owner}/{name}",
            "url": f"https://github.com/{owner}/{name}",
            "branch": branch,
            "branches": len(branches),
        },
        "supabein": {
            "project": sb_project,
            "id": sb_id,
            "url": sb_url,
        },
        "stats": {
            "commits": int(git("rev-list", "--count", "HEAD")),
            "tracked_files": len(git("ls-files").splitlines()),
            "last_activity": history[0]["date"] if history else None,
            "days_since": ((date.today() - date.fromisoformat(history[0]["date"])).days
                           if history else None),
        },
        "history": history,
    }

    OUT.write_text("window.DASHBOARD_DATA = " + json.dumps(data, indent=2) + ";\n")
    print(f"ok: {OUT.name} · {len(history)} history rows · repo {owner}/{name} · sb {sb_project}#{sb_id}")


if __name__ == "__main__":
    main()
