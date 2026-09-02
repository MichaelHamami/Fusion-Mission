/**
 * Guardrail: rate-limits calls to the AI analysis provider (not feedback
 * submission itself), so a burst of feedback can't blow through API quota
 * or cost. Sliding-window counter over an in-memory timestamp log - fine
 * for a single-process app at this scale; a multi-instance deployment
 * would need this backed by a shared store (e.g. Redis) instead.
 *
 * Deliberately low for manual testing right now - bump these once verified.
 */
export const RATE_LIMIT_MAX_ANALYSES = 2;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export class AnalysisRateLimiter {
  private static callTimestamps: number[] = [];

  /** Returns true and records the call if under the limit, false otherwise. */
  static tryAcquire(): boolean {
    const now = Date.now();
    AnalysisRateLimiter.callTimestamps = AnalysisRateLimiter.callTimestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (AnalysisRateLimiter.callTimestamps.length >= RATE_LIMIT_MAX_ANALYSES) {
      return false;
    }

    AnalysisRateLimiter.callTimestamps.push(now);
    return true;
  }
}
