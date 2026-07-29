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
 *
 * ## ADR-726 §5 — μηχαναγνώσιμη έξοδος (2026-07-29)
 *
 * Ο aggregator ήταν **μόνο ανθρώπινος**: `console.table` και τίποτε άλλο. Ένα αυτοματοποιημένο
 * benchmark (Playwright) δεν έχει τι να διαβάσει από ένα `console.table` — και το parsing του
 * κειμένου θα ήταν εύθραυστο. Προστέθηκε {@link snapshotPerfDistribution} (πλήρης κατανομή, όχι
 * μόνο p95) και το namespace `window.__dxfPerf`, ίδιο ιδίωμα με το υπάρχον `window.__bim3dPerf`.
 *
 * Τα ποσοστημόρια υπολογίζονται πλέον από το SSoT `utils/sample-distribution.ts` — πριν υπήρχαν
 * δύο υλοποιήσεις με διαφορετική σύμβαση (βλ. την τεκμηρίωση εκεί).
 */

import {
  percentileOfSorted,
  summariseSamples,
  type SampleDistribution,
} from '../../utils/sample-distribution';

let perfEnabled = false;

function readFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('dxf-perf-trace') === '1';
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') perfEnabled = readFlag();

export function isPerfEnabled(): boolean {
  return perfEnabled;
}

const accumulators: Map<string, number[]> = new Map();
let sampleCount = 0;
const REPORT_EVERY = 60;
// ADR-549 diag: once a `resetPerf()` opens a measurement window, STOP the rolling-60 auto-clear so
// `__bim3dPerf.download()` captures the FULL window (else only the trailing <60 samples survive →
// noisy avg/p95). Default false ⇒ normal perf mode is unchanged (clears every 60). Re-armed by reset.
let holdWindow = false;

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
  holdWindow = true; // diag window open → accumulate the whole sweep until the next reset()
}

export function perfTick(): void {
  if (!perfEnabled) return;
  sampleCount++;
  if (sampleCount >= REPORT_EVERY) {
    perfReport();
    if (!holdWindow) accumulators.clear();
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
    // SSoT ποσοστημορίων (ADR-726 §5). Πριν: `floor(n·0.95)` — διαφορετική σύμβαση από το
    // `settings/telemetry/Metrics.ts`, ίδιο όνομα «p95». Τώρα μία σύμβαση, nearest-rank.
    const p95 = percentileOfSorted(sorted, 0.95);
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

// ============================================================================
// ADR-726 §5 — ΚΑΤΑΝΟΜΗ + ΜΗΧΑΝΑΓΝΩΣΙΜΟ API
// ============================================================================

/** Μια γραμμή του `snapshotPerfDistribution` — το stage μαζί με την πλήρη κατανομή του. */
export interface PerfDistributionRow extends SampleDistribution {
  readonly stage: string;
}

/**
 * Τα κατώφλια του **frame budget** (ADR-726 §5), ως προεπιλογή για το `exceedance`.
 * `16.7` = ο στόχος 60fps · `33` = το κόκκινο του p99 · `70` = το κριτήριο «καρέ > 70ms ≤ 1%».
 */
export const FRAME_BUDGET_THRESHOLDS_MS: readonly number[] = [16.7, 33, 70];

/**
 * Πλήρης κατανομή ανά stage από το **ΤΡΕΧΟΝ** παράθυρο, χωρίς να το καθαρίσει — ταξινομημένη
 * κατά `sum` φθίνουσα, ίδια σειρά με το {@link snapshotPerfRows} (ο πρώτος = ο ένοχος).
 *
 * Διαφορά από το {@link snapshotPerfRows}: εκεί υπάρχει **μόνο p95**. Τα κριτήρια αποδοχής του
 * ADR-726 §5 απαιτούν p90 **και** p99 **και** ποσοστό υπέρβασης κατωφλίου — τρία μεγέθη που το
 * p95 δεν συνεπάγεται. Δεν αντικαθιστά το `snapshotPerfRows` (το χρησιμοποιεί ήδη το
 * `bim3d-perf-diag`)· το συμπληρώνει.
 */
export function snapshotPerfDistribution(
  thresholdsMs: readonly number[] = FRAME_BUDGET_THRESHOLDS_MS,
): PerfDistributionRow[] {
  const rows: PerfDistributionRow[] = [];
  for (const [stage, arr] of accumulators) {
    const dist = summariseSamples(arr, thresholdsMs);
    if (dist) rows.push({ stage, ...dist });
  }
  rows.sort((a, b) => b.sum - a.sum);
  return rows;
}

/**
 * Το συμβόλαιο που βλέπει ένα αυτοματοποιημένο benchmark μέσα από τη σελίδα.
 *
 * 🔴 **Δεν είναι νέο σύστημα μετρήσεων** — είναι η μηχαναγνώσιμη όψη του ΕΝΟΣ aggregator που ήδη
 * υπάρχει. Ίδιοι accumulators, ίδιο flag, ίδιο `console.table`.
 */
export interface DxfPerfWindowApi {
  /** Ξαναδιαβάζει το `localStorage['dxf-perf-trace']` χωρίς reload. Επιστρέφει τη νέα κατάσταση. */
  refresh(): boolean;
  /** Είναι ανοιχτή η μέτρηση; */
  enabled(): boolean;
  /**
   * **Ανοίγει παράθυρο μέτρησης**: μηδενίζει τους accumulators ΚΑΙ σταματά την κυλιόμενη
   * αυτοδιαγραφή ανά 60 δείγματα. Χωρίς αυτό, ένα benchmark 20΄΄ θα κρατούσε μόνο τα τελευταία
   * <60 δείγματα — δηλαδή θα αυτοκαταστρεφόταν σιωπηλά.
   */
  reset(): void;
  rows(): PerfRow[];
  distribution(thresholdsMs?: readonly number[]): PerfDistributionRow[];
  report(): void;
}

/**
 * Εγκατάσταση του `window.__dxfPerf` — ίδιο ιδίωμα με το υπάρχον `window.__bim3dPerf`.
 *
 * ⚠️ Εγκαθίσταται **άνευ όρων**, ακόμη και με κλειστό το flag: το benchmark πρέπει να μπορεί να
 * καλέσει `refresh()` **αφού** ανάψει το flag, χωρίς reload. Το κόστος είναι μερικές αναφορές
 * συναρτήσεων στο module load — μηδέν ανά καρέ.
 */
function installPerfWindowApi(): void {
  if (typeof window === 'undefined') return;

  const api: DxfPerfWindowApi = {
    refresh: () => {
      perfEnabled = readFlag();
      return perfEnabled;
    },
    enabled: () => perfEnabled,
    reset: () => resetPerf(),
    rows: () => snapshotPerfRows(),
    distribution: (thresholdsMs) => snapshotPerfDistribution(thresholdsMs),
    report: () => perfReport(),
  };

  const w = window as unknown as {
    __dxfPerf?: DxfPerfWindowApi;
    __dxfPerfRefresh?: () => void;
    __dxfPerfReport?: () => void;
  };
  w.__dxfPerf = api;
  // Παλιά επίπεδα globals — τεκμηριωμένα στο ADR-726 §Φ1 και σε χειροκίνητη χρήση από τον
  // Giorgio. Μένουν ως λεπτοί delegates· καμία δεύτερη υλοποίηση.
  w.__dxfPerfRefresh = () => {
    console.info('[mouse-perf] flag refreshed:', api.refresh());
  };
  w.__dxfPerfReport = () => api.report();
}

installPerfWindowApi();
