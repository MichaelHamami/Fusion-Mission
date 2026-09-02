# AI Collaboration Log

## Tool

Claude Code (Anthropic), model Sonnet 5 — used for all code in this repo,
driven interactively step by step against the challenge spec.

## Example prompts used

1. "Implement the first point Feedback Submission (assume I don't have
   sqlite or postgres, check before if I have it and install what is
   needed — I am on a Windows computer)." — this drove the stack choice
   (offered as a multiple-choice tradeoff rather than picked silently) and
   the decision to use `better-sqlite3` specifically because it needs no
   separate Windows install.
2. *(to be added in Step 2)* — prompt used to design the in-process async
   queue and state machine.
3. *(to be added in Step 3)* — prompt used to define the strict JSON schema
   validation and FAILED-on-invalid-output handling.

## Where AI output needed correction

*(To be filled in as it happens — most likely candidate is Step 3, where the
LLM's JSON output will be validated against the schema; any hallucinated
fields, wrong types, or malformed JSON encountered during real testing will
be documented here with the fix applied.)*

## What I'd improve with more time

*(running list, updated per step)*
- Step 1: add pagination/filtering to the list endpoint; add integration
  tests for the validation edge cases (whitespace-only content, over-length
  content, non-string content).
