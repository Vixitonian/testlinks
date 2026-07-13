# Nigeria History Quiz

Frontend for the SupaBein-hosted quiz app (project 55, site 43, subdomain
`nigeria-history-quiz`). Single self-contained `index.html` (all CSS/JS inline),
served as a hash-routed SPA.

Live: https://supabein.dxinnovationhub.com/sites/s43/current/

## What it does
- Loads questions from the SupaBein data API (`/api/v1/data/55/questions`,
  ordered by `display_order`).
- Runs a one-question-at-a-time quiz with a progress bar, instant correct/
  incorrect feedback, and running score.
- Records each attempt in `quiz_attempts` (creates a row on start, updates
  `total_score` / `current_question_order` / `selected_answers` per answer,
  sets `is_complete` at the end).
- Results screen: score ring, percentage, verdict, and a full per-question
  review. Best score persists in localStorage.
- Built-in Admin panel (`#/admin`) to add / edit / delete questions and
  renumber `display_order` — so content can be curated without touching SQL.

## Deploy (file-by-file API)
Open a deploy, upload files (send a browser `User-Agent` — the host WAF blocks
default curl UA; POSTs need a JSON `Content-Type` + body), finalize, publish.
