# Fusion Mission — AI-Assisted Feedback Analysis

Backend service that accepts free-text feedback and (in later steps) extracts
structured insights from it using an LLM.

Built incrementally, step by step, per the challenge spec. This README grows
as each step lands.

## Stack

- **Node.js + TypeScript + Express**
- **SQLite** via `better-sqlite3` (ships a prebuilt native binary — no
  separate SQLite install needed, works out of the box on Windows)
- **Zod** for request/schema validation

## Setup

```bash
npm install
npm run dev     # starts on http://localhost:3000 with auto-reload
```

No database installation step is required — `better-sqlite3` creates
`data/feedback.db` automatically on first run.

## Progress

### Step 1 — Feedback Submission ✅

- `POST /api/feedback` — accepts `{ "content": string }`, persists a row to
  SQLite, returns the created feedback record.
- `GET /api/feedback` — lists all feedback (temporary/minimal; the full Read
  API with analysis results is a later requirement).
- Each row has `id` (UUID), `content`, `status` (defaults to `RECEIVED`,
  constrained via `CHECK` to `RECEIVED | ANALYZING | DONE | FAILED`),
  `created_at`, `updated_at`.

**Design decisions / tradeoffs:**
- `better-sqlite3` chosen over the `sqlite3` package because it's
  synchronous, faster for this workload, and ships prebuilt binaries so there
  is nothing extra to install on Windows.
- Status is enforced at the DB layer with a `CHECK` constraint, not just in
  application code, so an invalid status can never be persisted regardless of
  which code path writes to the table.
- WAL mode enabled for better concurrent read/write behavior once the async
  analysis worker (step 2) is writing status updates while reads happen.
- Content validation currently just checks non-empty/trimmed and caps length
  at 10,000 chars to reject obviously-abusive payloads; no other business
  rules yet.
- No pagination/filtering on `GET /api/feedback` yet — explicitly optional
  per spec, will revisit if time allows.

### Step 2 — Asynchronous AI Analysis (not started)

### Step 3 — Structured AI Output (not started)

### Step 4 — Guardrail (not started)

### Step 5 — Read API (not started)

## AI Collaboration Log

See [AI_LOG.md](./AI_LOG.md).
