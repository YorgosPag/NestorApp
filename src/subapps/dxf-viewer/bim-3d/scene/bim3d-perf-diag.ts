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
 *   window.__bim3dPerf.dump()
 */

import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';

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
      console.log('[ADR-549] __bim3dPerf reset');
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

// ── (2) UnifiedFrameScheduler per-system watch via the EXISTING onFrame metrics ──
// `collectMetrics` defaults true, so every frame emits `systemMetrics` (per-system renderTime,
// skipped flag) + `totalFrameTime`. We subscribe ONCE and accumulate the rendered (non-skipped)
// systems — pinpoints which registered system is the 50-130ms scheduler rAF long task.
let schedulerWatched = false;
function startSchedulerWatch(): void {
  if (schedulerWatched || typeof window === 'undefined') return;
  schedulerWatched = true;
  UnifiedFrameScheduler.onFrame((m) => {
    const s = getState();
    if (!s) return;
    bump(s.schedFrame, '_frame', m.totalFrameTime);
    m.systemMetrics.forEach((sm, id) => { if (!sm.skipped) bump(s.scheduler, id, sm.renderTime); });
  });
}

// EAGER attach + scheduler watch at module load (statically imported by ThreeJsSceneManager) so the
// console handle + per-frame metrics are live the instant the 3D viewport mounts.
getState();
startSchedulerWatch();
