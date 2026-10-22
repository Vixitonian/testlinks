# Apprelab Growth & Performance Dashboard

An executive, first-principles systems dashboard built for Apprelab (`apprelab.com`), adhering directly to the `startup-cmo` skill and `mobile-first-design` specifications.

## What It Shows

1. **North Star Metric & KPIs**:
   - **Activated Learners** (learners who passed their first hands-on task within 7 days of signup).
   - **Gross Revenue** (broken down by courses, ₦1,500 monthly learner passes, creator AI packs, and partner bootcamps).
   - **AI Cost per Activated Learner** (with ceiling alert guardrails).
   - **Verified Badges Issued** and WhatsApp / LinkedIn viral share rates.

2. **Growth Funnel & Theory of Constraints**:
   - Visual step-by-step conversion tracking: Attention / Visitors → Signups → Enrolments → Activated Learners → Badged → Paying.
   - Dynamic bottleneck diagnosis identifying the binding constraint and prescribing the matching experiment from Phase D.

3. **Marketplace Unit Economics (85/15 Split)**:
   - Creator share (85% payouts to Nigerian bank accounts via Paystack).
   - Apprelab platform margin (15%).
   - Net contribution after deducting marginal AI grading costs.

4. **Micro-Course Performance Table**:
   - Filterable catalog with search, pass rates, badge completion velocity, and sales.

5. **CMO Experiment Backlog (Phase D)**:
   - Real-time status cards for active, scaled, and backlog experiments (e.g. Exp #1 WhatsApp share copy, Exp #2 /verify CTAs, Exp #8 goal-pick chip).

6. **Live API Integration**:
   - Modal support to query `https://apprelab.com/api/fn/agent/snapshot?period=...` directly with `x-apprelab-token`.
   - Pre-loaded with realistic sample data stamped `Example · sample data`.

## Running & Previewing

To view locally:
```bash
cd /home/deploy/projects/testlinks-4/dashboard
python3 -m http.server 8792
```
Then open `http://127.0.0.1:8792/index.html`.

## Automated Verification

Automated Playwright tests capture responsive desktop and phone viewports:
```bash
TMPDIR=/home/deploy/projects/testlinks-4/.tmp node test_dashboard.js
```
Verified screenshots are stored in `dashboard/screenshots/`.
