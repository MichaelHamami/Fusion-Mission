# Fusion Mission — AI-Assisted Feedback Analysis

Backend service that accepts free-text feedback and (in later steps) extracts
structured insights from it using an LLM.

Built incrementally, step by step, per the challenge spec. This README grows
as each step lands.

## Stack

- **Node.js + TypeScript + Express**
- **SQLite** via `better-sqlite3` (ships a prebuilt native binary — no
  separate SQLite install needed, works out of the box on Windows)
- **Zod** for request/schema validation, and for validating the AI's JSON
  output against the required schema
- **Anthropic Claude API** (`claude-haiku-4-5`) for the analysis itself
- Layering: `Controller` (Express handlers) → `Service` (business logic /
  orchestration) → `Dao` (raw SQL or raw external-API calls), each as a class
  with static methods — no framework-specific DI, just plain classes as
  namespaces for related logic.

## Setup

```bash
npm install
cp .env.example .env   # then paste your ANTHROPIC_API_KEY into .env
npm run dev             # starts on http://localhost:3000 with auto-reload
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

### Step 2 & 3 — Asynchronous AI Analysis + Structured AI Output ✅

Done together since the state machine and the schema validation are two
halves of the same flow.

- Submitting feedback (`FeedbackService.createFeedback`) persists the row
  and calls `AnalysisService.analyzeFeedback(id)` **without awaiting it** —
  the HTTP response returns immediately with status `RECEIVED`. No queue: at
  this scale a queue/worker abstraction is unused machinery — a plain
  fire-and-forget async call already satisfies "must not block on
  analysis". A stated tradeoff of skipping a queue: concurrent submissions
  run their analyses in parallel rather than one at a time (fine for a
  handful of requests; would need a real limiter under real load — see the
  guardrail in step 4).
- State machine: `RECEIVED → ANALYZING → DONE | FAILED`, enforced by
  `AnalysisService.analyzeFeedback`:
  - `AnalysisDao.requestAnalysis` makes the raw Anthropic call and returns
    the raw text — it does **not** parse or validate anything, so an API
    failure (network, auth, rate limit, billing) is distinguishable from a
    model returning malformed output.
  - `AnalysisService` then: strips an accidental ```` ```json ```` fence if
    present, `JSON.parse`s the result, and validates it against
    `AnalysisResultSchema` (Zod, `.strict()` so unknown/hallucinated fields
    are rejected, not silently dropped).
  - Any failure at any stage (API error, invalid JSON, schema mismatch) is
    caught explicitly and persisted as `FAILED` with a human-readable
    `failure_reason` — nothing fails silently or crashes the process.
  - On success, both the raw AI response and the validated structured
    result are persisted (`raw_ai_response`, `analysis_result` columns).
- `POST /api/feedback/:id/retry` — the required "retriable" failure path.
  Only allowed when status is `FAILED` (409 otherwise); resets to
  `RECEIVED` and re-runs analysis.
- New DB columns (`raw_ai_response`, `analysis_result`, `failure_reason`)
  are added via a small additive migration in `src/db/index.ts` (checks
  `PRAGMA table_info` and `ALTER TABLE ADD COLUMN` for anything missing) so
  an existing dev DB doesn't need to be deleted.

**Design decisions / tradeoffs:**
- Model: `claude-haiku-4-5`, chosen deliberately over a larger model —
  sentiment + short feature extraction from a few sentences of feedback
  doesn't need a frontier model, and this keeps repeated test runs cheap.
- The AI is prompted to return bare JSON directly (not via the Anthropic
  SDK's structured-output/tool-calling features). This is deliberate: the
  challenge explicitly grades "defensive handling of AI output", and
  offloading schema conformance to the API would remove the thing being
  graded. The Zod validation in `AnalysisService` is the real guardrail.
- `temperature: 0` for more deterministic output on a task where we want
  consistent structure, not creativity.
- Verified against the live API: submission returns instantly with
  `RECEIVED`; a call that fails (in testing, an exhausted Anthropic account
  balance) is correctly caught and stored as `FAILED` with a clear reason,
  never left stuck in `ANALYZING` or crashing the server; retry correctly
  transitions `FAILED → RECEIVED → ANALYZING` and is rejected (409) on
  anything not `FAILED`. Schema validation itself (accepting well-formed
  output, rejecting a bad enum value, an out-of-range confidence, an extra
  hallucinated field, and a missing required field) was verified directly
  against `AnalysisResultSchema` since live "happy path" testing needs API
  credit.
- Known limitation: the in-memory fire-and-forget approach means a process
  restart mid-analysis leaves that row stuck in `ANALYZING` forever (no
  reconciliation-on-startup step). Retry only covers `FAILED`. Acceptable
  for this challenge's scope; flagged here rather than silently ignored.

### Step 4 — Guardrail: Rate-limit AI analysis ✅

Chose rate-limiting over the other three options (dedup / cache / truncation)
because it's the guardrail that most directly protects the thing actually at
risk here: uncontrolled Anthropic API spend from a burst of submissions. The
others are about correctness or efficiency, not runtime cost.

- `AnalysisRateLimiter` (`src/services/AnalysisRateLimiter.ts`) is a small
  sliding-window counter: a static in-memory array of call timestamps,
  pruned to the current window on every check.
- The two knobs are top-of-file exported consts —
  `RATE_LIMIT_MAX_ANALYSES` and `RATE_LIMIT_WINDOW_MS` — specifically so
  they're trivial to find and tune without touching any logic. **Currently
  set low on purpose (`2` analyses per `60s`) for manual verification**;
  bump these for real usage.
- Checked in `AnalysisService.analyzeFeedback`, right before the AI call
  (after the `ANALYZING` transition, so it still goes through the state
  machine). If exceeded, the item is marked `FAILED` with a
  `failure_reason` that names the limit, and is retriable via the existing
  `/retry` endpoint once the window clears — no new failure mode needed,
  it reuses the retry mechanism from step 2/3.
- The limiter counts every *attempt*, not just successes — an attempt that
  fails on the Anthropic side still consumed a slot. This is deliberate:
  the guardrail is protecting call volume/cost, which is spent on attempt,
  not on success.
- Verified manually: submitting 3 feedback items back-to-back produced two
  real Anthropic API calls (both failed on account billing in this
  session, unrelated to the guardrail) and a third that was rejected
  immediately by the limiter itself with
  `"Rate limit exceeded: max 2 AI analyses per 60s. Retry later."` — never
  reaching the network.
- Known limitation: in-memory means the limit is per-process and resets on
  restart, and wouldn't hold across multiple instances (would need a
  shared store like Redis for that). Fine for this challenge's scope.

### Step 5 — Read API ✅

The list/detail endpoints already existed from step 2/3 (needed them to poll
status while building the analysis pipeline), so this step was mostly about
adding the explicitly-optional filtering/pagination on top:

- `GET /api/feedback` — lists all feedback, each item including `status`,
  `analysis_result` (parsed object, `null` until `DONE`), `raw_ai_response`,
  and `failure_reason`.
- `GET /api/feedback/:id` — single item, same shape, 404 if not found.
- Optional query params on the list endpoint, validated with Zod:
  `?status=FAILED` (filter), `?pageNumber=&pageSize=` (pagination,
  1-indexed, `pageSize` capped at 100). Omitting all of them returns the
  full list, unpaginated — the existing behavior from step 1/2 is
  unchanged by default.
- Kept the response as a plain array rather than wrapping it in an
  `{ items, total }` envelope — pagination is explicitly optional here, and
  a bare array is one less thing to design/version for a "do not overbuild"
  3-hour challenge. A real paginated API would want a total count and
  `has_more`; noted as a "what I'd improve with more time" item.
- Verified manually: default list returns everything; `?status=FAILED`
  returns only matching rows; `?pageSize=2&pageNumber=1` vs
  `?pageSize=2&pageNumber=2` return non-overlapping pages in
  `created_at DESC` order; an invalid `status` value or `pageSize=0` both
  return 400 with a field-level Zod error.

## AI Collaboration Log

See [AI_LOG.md](./AI_LOG.md).
