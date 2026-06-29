/**
 * 🔬 ADR-549 Phase 0 — REVERTIBLE diagnostic instrumentation for the 3D cursor «swim».
 *
 * NOT a production module. Measures, during a clean cursor sweep:
 *   (1) the 3D scene render — count / cost / which dirty flag / who called `markSceneDirty`,
 *   (2) the UnifiedFrameScheduler per-system render times (via the existing `onFrame` metrics —
 *       NO edit to the ADR-040-critical scheduler file), and
 *   (3) each `useRafWhile` overlay's per-frame `draw()` cost (by label).
 *
 * Finding so far (2026-06-29): the 3D scene renders 0× during a sweep, yet `cursor.totalLag` is
 * ~65ms with `UnifiedFrameScheduler`/`overlay-raf` rAF handlers logged at 50-143ms. So the long
 * task is NOT the scene render — it is a per-frame scheduler system AND/OR an overlay draw. (2)+(3)
 * pinpoint which. Revert this file + its call-sites with `git restore` once captured.
 *
 * USAGE (browser console; counts/causation are valid even in dev — only absolute ms inflate):
 *   localStorage.setItem('dxf-trace-dirty','1')      // (optional) capture markSceneDirty callers
 *   window.__bim3dPerf.reset()
 *   // ... sweep the cursor over the 3D viewport ~6s, NO camera move ...
 *   window.__bim3dPerf.dump()      // console.table (expandable arrows)
 *   window.__bim3dPerf.download()  // → clean flat .txt in Downloads (no arrows to unfold)
 */

import { snapshotPerfRows, resetPerf } from '../../systems/cursor/mouse-handler-perf';
import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';

export interface Bim3DRenderSample {
  readonly isInteracting: boolean;
  readonly viewportAnimating: boolean;
  readonly animationManagerActive: boolean;
  readonly pathTracerActive: boolean;
  readonly explicitDirty: boolean;
  readonly ssaoActive: boolean;
}

interface Stat { count: number; total: number; max: number }

interface Bim3DPerfState {
  renderCount: number;
  totalMs: number;
  maxMs: number;
  windowStartMs: number;
  reasons: Record<keyof Bim3DRenderSample, number>;
  markDirtyCallers: Map<string, number>;
  overlays: Map<string, Stat>;        // (3) per `useRafWhile` overlay draw
  scheduler: Map<string, Stat>;       // (2) per scheduler system render
  schedFrame: Stat;                   // (2) whole-scheduler frame time
  reset(): void;
  dump(): void;
  download(): void;                   // flat .txt to Downloads (same data as dump, no expand arrows)
}

const isTracingDirty = (): boolean =>
  typeof window !== 'undefined' && window.localStorage.getItem('dxf-trace-dirty') === '1';

function emptyReasons(): Record<keyof Bim3DRenderSample, number> {
  return {
    isInteracting: 0, viewportAnimating: 0, animationManagerActive: 0,
    pathTracerActive: 0, explicitDirty: 0, ssaoActive: 0,
  };
}

function bump(map: Map<string, Stat>, key: string, ms: number): void {
  let s = map.get(key);
  if (!s) { s = { count: 0, total: 0, max: 0 }; map.set(key, s); }
  s.count += 1; s.total += ms; if (ms > s.max) s.max = ms;
}

function logStatMap(title: string, map: Map<string, Stat>): void {
  if (map.size === 0) { console.log(`[ADR-549] ${title}: (none)`); return; }
  const rows = [...map.entries()]
    .map(([k, s]) => ({ key: k, count: s.count, avg: Number((s.total / s.count).toFixed(2)), max: Number(s.max.toFixed(2)), total: Number(s.total.toFixed(1)) }))
    .sort((a, b) => b.total - a.total);
  console.log(`[ADR-549] ${title}:`);
  console.table(rows);
}

// ── plain-text report (for `download()`) — flat aligned tables, ZERO nested objects ──
type Cell = string | number;

/** Monospace-aligned text table: header row + body, columns padded to the widest cell. */
function tableText(headers: string[], rows: Cell[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const fmt = (r: Cell[]): string => r.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  return [fmt(headers), ...rows.map(fmt)].join('\n');
}

function statMapToText(map: Map<string, Stat>): string {
  if (map.size === 0) return '(none)';
  const rows: Cell[][] = [...map.entries()]
    .map(([k, s]): Cell[] => [k, s.count, Number((s.total / s.count).toFixed(2)), Number(s.max.toFixed(2)), Number(s.total.toFixed(1))])
    .sort((a, b) => (b[4] as number) - (a[4] as number));
  return tableText(['key', 'count', 'avg', 'max', 'total'], rows);
}

/** Build the full flat-text report (same content as `dump()` + the cursor mouse-perf rows). */
function buildReportText(s: Bim3DPerfState): string {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const elapsedS = (now - s.windowStartMs) / 1000;
  const rps = elapsedS > 0 ? s.renderCount / elapsedS : 0;
  const avg = s.renderCount > 0 ? s.totalMs / s.renderCount : 0;
  const stamp = nowISO();
  const lines: string[] = [];
  lines.push(`=== ADR-549 3D PERF REPORT — ${stamp} ===`, '');
  lines.push('[3D SCENE RENDER]');
  lines.push(`renders=${s.renderCount} over ${elapsedS.toFixed(1)}s → ${rps.toFixed(1)}/s | avg=${avg.toFixed(2)}ms max=${s.maxMs.toFixed(2)}ms`, '');

  lines.push('[DIRTY-REASON HISTOGRAM]');
  const reasonRows: Cell[][] = (Object.entries(s.reasons) as Array<[string, number]>)
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  lines.push(reasonRows.length ? tableText(['reason', 'count'], reasonRows) : '(all zero)', '');

  lines.push('[markSceneDirty CALLERS (top 12)]');
  const callerRows: Cell[][] = [...s.markDirtyCallers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  lines.push(callerRows.length ? tableText(['caller', 'count'], callerRows) : '(none — set localStorage dxf-trace-dirty=1)', '');

  const sf = s.schedFrame;
  lines.push(`[SCHEDULER FRAME] frames=${sf.count} avg=${sf.count ? (sf.total / sf.count).toFixed(2) : '0'}ms max=${sf.max.toFixed(2)}ms`, '');
  lines.push('[SCHEDULER SYSTEMS (per render)]', statMapToText(s.scheduler), '');
  lines.push('[OVERLAY DRAWS (useRafWhile, per frame)]', statMapToText(s.overlays), '');

  lines.push('[CURSOR (mouse-perf — current window)]');
  const cursorRows: Cell[][] = snapshotPerfRows().map((r): Cell[] => [r.stage, r.count, r.avg, r.min, r.max, r.p95, r.total]);
  lines.push(cursorRows.length ? tableText(['stage', 'count', 'avg', 'min', 'max', 'p95', 'total'], cursorRows) : '(none — set localStorage dxf-perf-trace=1 + reload)', '');

  return lines.join('\n');
}

function createState(): Bim3DPerfState {
  const state: Bim3DPerfState = {
    renderCount: 0, totalMs: 0, maxMs: 0,
    windowStartMs: typeof performance !== 'undefined' ? performance.now() : 0,
    reasons: emptyReasons(),
    markDirtyCallers: new Map<string, number>(),
    overlays: new Map<string, Stat>(),
    scheduler: new Map<string, Stat>(),
    schedFrame: { count: 0, total: 0, max: 0 },
    reset() {
      this.renderCount = 0; this.totalMs = 0; this.maxMs = 0;
      this.windowStartMs = typeof performance !== 'undefined' ? performance.now() : 0;
      this.reasons = emptyReasons();
      this.markDirtyCallers.clear();
      this.overlays.clear();
      this.scheduler.clear();
      this.schedFrame = { count: 0, total: 0, max: 0 };
      resetPerf(); // zero the cursor window too → one reset() = one clean window for BOTH
      console.log('[ADR-549] __bim3dPerf reset (renders + cursor zeroed) — now sweep, then .download()');
    },
    dump() {
      const elapsedS = ((typeof performance !== 'undefined' ? performance.now() : 0) - this.windowStartMs) / 1000;
      const rps = elapsedS > 0 ? this.renderCount / elapsedS : 0;
      const avg = this.renderCount > 0 ? this.totalMs / this.renderCount : 0;
      console.log(
        `[ADR-549] 3D-scene renders=${this.renderCount} over ${elapsedS.toFixed(1)}s ` +
        `→ ${rps.toFixed(1)}/s | avg=${avg.toFixed(2)}ms max=${this.maxMs.toFixed(2)}ms`,
      );
      console.log('[ADR-549] dirty-reason histogram:', { ...this.reasons });
      if (this.markDirtyCallers.size > 0) {
        const sorted = [...this.markDirtyCallers.entries()].sort((a, b) => b[1] - a[1]);
        console.log('[ADR-549] markSceneDirty callers (top):', Object.fromEntries(sorted.slice(0, 12)));
      } else {
        console.log('[ADR-549] markSceneDirty callers: none (set localStorage dxf-trace-dirty=1)');
      }
      const sf = this.schedFrame;
      console.log(
        `[ADR-549] scheduler frames=${sf.count} | avg=${sf.count ? (sf.total / sf.count).toFixed(2) : '0'}ms ` +
        `max=${sf.max.toFixed(2)}ms  ← the per-frame rAF long task lives here OR in overlays below`,
      );
      logStatMap('scheduler systems (per render)', this.scheduler);
      logStatMap('overlay draws (useRafWhile, per frame)', this.overlays);
    },
    download() {
      const text = buildReportText(this);
      if (typeof document === 'undefined') { console.log(text); return; }
      const name = `bim3d-perf-${nowISO().replace(/[:.]/g, '-')}.txt`;
      triggerExportDownload({ blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: name });
      console.log(`[ADR-549] perf report downloaded → Λήψεις/${name}`);
    },
  };
  return state;
}

/** Attach the singleton state to `window` so the console can reach it. */
function getState(): Bim3DPerfState | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __bim3dPerf?: Bim3DPerfState };
  if (!w.__bim3dPerf) w.__bim3dPerf = createState();
  return w.__bim3dPerf;
}

/** Called once per actual `renderSceneFrame` from `ThreeJsSceneManager.tick`. */
export function recordRender(durationMs: number, sample: Bim3DRenderSample): void {
  const s = getState();
  if (!s) return;
  s.renderCount += 1;
  s.totalMs += durationMs;
  if (durationMs > s.maxMs) s.maxMs = durationMs;
  (Object.keys(s.reasons) as Array<keyof Bim3DRenderSample>).forEach((k) => {
    if (sample[k]) s.reasons[k] += 1;
  });
}

/** Called from `ThreeJsSceneManager.markSceneDirty` (only works when `dxf-trace-dirty`=1). */
export function recordMarkDirty(): void {
  if (!isTracingDirty()) return;
  const s = getState();
  if (!s) return;
  const stack = new Error().stack?.split('\n') ?? [];
  const raw = (stack[3] ?? stack[2] ?? 'unknown').trim();
  const key = raw.replace(/^at\s+/, '').replace(/\s+\(.*$/, '').slice(0, 80) || raw.slice(0, 80);
  s.markDirtyCallers.set(key, (s.markDirtyCallers.get(key) ?? 0) + 1);
}

/** Called from `useRafWhile` (overlay-raf) once per frame, per labelled overlay. */
export function recordOverlayDraw(label: string, durationMs: number): void {
  const s = getState();
  if (s) bump(s.overlays, label, durationMs);
}

// ── (2) UnifiedFrameScheduler per-system metrics ──
// The subscription is OWNED BY `BimViewport3D` (right next to its `register('bim-3d-scene')`) — that
// is the SAME singleton instance that runs the frames, which matters because dev/Turbopack/HMR can
// load `UnifiedFrameScheduler` as a DUPLICATE module: a subscription from here would land on a dead
// instance (observed: `scheduler frames=0`). `BimViewport3D` pushes each frame's metrics in here.
export function recordSchedulerFrame(m: {
  totalFrameTime: number;
  systemMetrics: Map<string, { renderTime: number; skipped: boolean }>;
}): void {
  const s = getState();
  if (!s) return;
  bump(s.schedFrame, '_frame', m.totalFrameTime);
  m.systemMetrics.forEach((sm, id) => { if (!sm.skipped) bump(s.scheduler, id, sm.renderTime); });
}

// EAGER attach at module load (statically imported by ThreeJsSceneManager) so `window.__bim3dPerf`
// is live the instant the 3D viewport mounts, even before the first render.
getState();
