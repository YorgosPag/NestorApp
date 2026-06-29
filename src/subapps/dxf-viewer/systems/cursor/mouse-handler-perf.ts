/**
 * Mouse Move Handler — Performance Instrumentation (ADR-040 Phase A)
 *
 * Toggle: localStorage.setItem('dxf-perf-trace', '1') then refresh page
 *         (or call window.__dxfPerfRefresh() to reload flag without reload).
 *
 * Overhead when disabled: a single boolean check per `withPerf()` call —
 * the wrapped function runs unwrapped. Safe to leave in production code.
 *
 * Output: every REPORT_EVERY samples, dump aggregated console.table with
 * per-stage count / avg / min / max / p95 / total (ms). Stages sorted by
 * total time desc so the bottleneck is the first row.
 */

let perfEnabled = false;

function readFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('dxf-perf-trace') === '1';
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  perfEnabled = readFlag();
  (window as unknown as { __dxfPerfRefresh?: () => void }).__dxfPerfRefresh = () => {
    perfEnabled = readFlag();

    console.info('[mouse-perf] flag refreshed:', perfEnabled);
  };
  (window as unknown as { __dxfPerfReport?: () => void }).__dxfPerfReport = () => {
    perfReport();
  };
}

export function isPerfEnabled(): boolean {
  return perfEnabled;
}

const accumulators: Map<string, number[]> = new Map();
let sampleCount = 0;
const REPORT_EVERY = 60;

export function withPerf<T>(stage: string, fn: () => T): T {
  if (!perfEnabled) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    const dur = performance.now() - start;
    recordSample(stage, dur);
  }
}

/**
 * Record a raw measurement `value` for `stage` into the SAME aggregator that `withPerf`
 * feeds — so non-function-timing metrics (event-queue latency, coalesced counts, paint lag)
 * surface in the shared `console.table` report with the same count/avg/p95 stats.
 *
 * No-op when the perf flag is off (zero overhead beyond a boolean check). Callers that read
 * the flag themselves to skip building `value` should still guard the call site.
 */
export function recordSample(stage: string, value: number): void {
  if (!perfEnabled) return;
  let arr = accumulators.get(stage);
  if (!arr) {
    arr = [];
    accumulators.set(stage, arr);
  }
  arr.push(value);
}

/**
 * Clear the cursor accumulator window (and the sample counter). Lets the ADR-549 diag tie the
 * cursor stats to the SAME window as the 3D-render stats — one `__bim3dPerf.reset()` zeroes both,
 * so a downloaded report can't carry stale samples from before the sweep.
 */
export function resetPerf(): void {
  accumulators.clear();
  sampleCount = 0;
}

export function perfTick(): void {
  if (!perfEnabled) return;
  sampleCount++;
  if (sampleCount >= REPORT_EVERY) {
    perfReport();
    accumulators.clear();
    sampleCount = 0;
  }
}

export interface PerfRow {
  stage: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  total: number;
}

/**
 * Compute the aggregated per-stage rows from the CURRENT accumulator window WITHOUT clearing it
 * (sorted by total desc). Shared by `perfReport()` (console) and the ADR-549 diag `download()`
 * (so the downloaded report carries the SAME cursor stats as the console table, no copy-paste).
 */
export function snapshotPerfRows(): PerfRow[] {
  const rows: PerfRow[] = [];
  for (const [stage, arr] of accumulators) {
    if (arr.length === 0) continue;
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((s, x) => s + x, 0);
    const avg = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Idx];
    rows.push({
      stage,
      count: sorted.length,
      avg: Number(avg.toFixed(3)),
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
      p95: Number(p95.toFixed(3)),
      total: Number(sum.toFixed(2)),
    });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

export function perfReport(): void {
  console.groupCollapsed(`[mouse-perf] ${REPORT_EVERY}-sample report`);
  console.table(snapshotPerfRows());
  console.groupEnd();
}
