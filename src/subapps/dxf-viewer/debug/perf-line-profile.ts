/**
 * @module perf-line-profile
 * @description Temporary instrumentation for line-drawing performance regression
 *   (ADR-040 investigation, 2026-05-11).
 *
 * Usage: flip `PERF_LINE_PROFILE` to `true`, reload, draw a line, inspect console.
 * Logs each labelled section only when its duration exceeds `THRESHOLD_MS`.
 * Toggle off (set to false) before commit unless explicitly profiling.
 */

export const PERF_LINE_PROFILE = true;
const THRESHOLD_MS = 1;

export function perfMark<T>(label: string, fn: () => T): T {
  if (!PERF_LINE_PROFILE) return fn();
  const t0 = performance.now();
  const result = fn();
  const dt = performance.now() - t0;
  if (dt >= THRESHOLD_MS) {
    // eslint-disable-next-line no-console
    console.log(`PERF_LINE ${label} ${dt.toFixed(1)}ms`);
  }
  return result;
}

export function perfStart(): number {
  return PERF_LINE_PROFILE ? performance.now() : 0;
}

export function perfEnd(label: string, t0: number): void {
  if (!PERF_LINE_PROFILE) return;
  const dt = performance.now() - t0;
  if (dt >= THRESHOLD_MS) {
    // eslint-disable-next-line no-console
    console.log(`PERF_LINE ${label} ${dt.toFixed(1)}ms`);
  }
}
