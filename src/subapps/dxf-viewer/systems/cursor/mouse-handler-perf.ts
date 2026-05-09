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
    let arr = accumulators.get(stage);
    if (!arr) {
      arr = [];
      accumulators.set(stage, arr);
    }
    arr.push(dur);
  }
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

interface PerfRow {
  stage: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  total: number;
}

export function perfReport(): void {
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

  console.groupCollapsed(`[mouse-perf] ${REPORT_EVERY}-sample report`);

  console.table(rows);

  console.groupEnd();
}
