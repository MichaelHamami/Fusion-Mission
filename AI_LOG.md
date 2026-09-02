# AI Collaboration Log

## Tool

Claude Code (Anthropic), model Sonnet 5 — used for all code in this repo,
driven interactively step by step against the challenge spec.

## Example prompts used

1. "Implement the first point Feedback Submission (assume I don't have
   sqlite or postgres, check before if I have it and install what is
   needed — I am on a Windows computer)." — drove the stack choice (offered
   as a multiple-choice tradeoff rather than picked silently) and the
   decision to use `better-sqlite3` specifically because it needs no
   separate Windows install.
2. "Implement the second step Asynchronous AI Analysis (Mandatory) and
   Structured AI Output (Mandatory) together. AI Analysis will be a
   different service and dao. In the service make sure to validate the
   return of the AI dao which will do the analysis." — this single prompt
   set the architecture for step 2/3: a dedicated `AnalysisDao` that only
   makes the raw LLM call (no parsing), and an `AnalysisService` whose job
   is specifically to validate that raw output and own the
   `RECEIVED → ANALYZING → DONE | FAILED` transitions.
3. "now i see all functions are exported... the service and dao and router
   should be classes... you can make them static to make it easier..." —
   drove converting the DAO/service/route-handler layer from
   loose exported functions to static classes (`FeedbackDao`,
   `FeedbackService`, `AnalysisDao`, `AnalysisService`,
   `FeedbackController`), a structural/style correction for consistency
   across the codebase.
4. "implement the Rate-limit AI analysis in order to check it and to be
   easily changeable... make consts that decide the limitation... for now
   make it low limit so i can check it manually." — drove exporting
   `RATE_LIMIT_MAX_ANALYSES` / `RATE_LIMIT_WINDOW_MS` as named consts at
   the top of `AnalysisRateLimiter.ts` (rather than burying them inline)
   and deliberately setting them low (`2` per `60s`) so the guardrail could
   be triggered and observed within one manual test run instead of needing
   dozens of requests.

## Where AI output needed correction

When I (the assistant) first implemented the async analysis step, I built a
small `AnalysisQueue` class — an internal array, a `draining` flag, a
`drain()` loop — to process feedback items one at a time in the background.
It worked, but it was more machinery than the requirement needed: the spec
only asks that submission not block on analysis, and a queue/worker
abstraction is unjustified complexity at this scale (a handful of feedback
items, no need for strict sequential processing).

The user corrected this directly: "dont make queue - make it so it will not
be sync thats it." I removed the `AnalysisQueue` class entirely and replaced
it with a plain `void AnalysisService.analyzeFeedback(id)` fire-and-forget
call at the two call sites (create and retry) — async function, deliberately
not awaited, no wrapper class around it. Same behavior (non-blocking
submission), a third of the code, nothing speculative left in for a scale
this project doesn't have.

Separately, on the "real" AI side (the feedback-analysis LLM, not the coding
assistant): live testing surfaced that the Anthropic account used for
testing had no API credit, so every real call returned a 400 billing error.
This wasn't a code bug, but it was a useful real-world exercise of the
failure path — `AnalysisDao` correctly wrapped it as an `AiRequestError`,
`AnalysisService` caught it and persisted the row as `FAILED` with a
human-readable `failure_reason` instead of leaving it stuck in `ANALYZING`
or crashing the process, and the retry endpoint correctly re-ran it.
Schema-validation of malformed/hallucinated model output (bad sentiment
value, out-of-range confidence, an extra unrequested field, a missing
required field) was verified directly against `AnalysisResultSchema`
since a true "happy path" run needs API credit that wasn't available during
this session.

## What I'd improve with more time

*(running list, updated per step)*
- Step 1: add integration tests for the validation edge cases
  (whitespace-only content, over-length content, non-string content).
  (Pagination/filtering landed in step 5.)
- Step 2/3: add a startup reconciliation step for rows stuck in `ANALYZING`
  after a crash/restart (currently only `FAILED` is retriable); add a
  timeout around the Anthropic call so a hung request can't leave a row in
  `ANALYZING` indefinitely; run the live happy-path test once API credit is
  available.
- Step 4: make the rate limit configurable via env var instead of a
  hardcoded const, so it can be tuned per environment without a code
  change; back it with a shared store (e.g. Redis) if this ever runs as
  more than one process.
- Step 5: add total count / `has_more` if the response is ever wrapped in
  a real pagination envelope; add sorting options beyond the fixed
  `created_at DESC`.
