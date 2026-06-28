/**
 * 🔬 ADR-549 Phase 0 — REVERTIBLE diagnostic instrumentation for the 3D cursor «swim».
 *
 * NOT a production module. Measures, during a clean cursor sweep, (α) the per-render cost,
 * (β) how OFTEN `renderSceneFrame` actually runs + which dirty flag triggered it, and (who calls
 * `markSceneDirty`). Self-contained so the `ThreeJsSceneManager` edits stay tiny; revert this file
 * + the two call-sites with `git restore` once the data is captured.
 *
 * USAGE (browser console, prefer prod-build — dev inflates ~86%):
 *   window.__bim3dPerf.reset()                       // zero counters before a test sweep
 *   localStorage.setItem('dxf-trace-dirty','1')      // (optional) capture markSceneDirty callers
 *   // ... sweep the cursor over the 3D viewport for ~5s, NO camera move ...
 *   window.__bim3dPerf.dump()                         // print the breakdown
 *
 * Combine with the existing flags: `dxf-no-shadows`='1' isolates the base raster cost,
 * `dxf-no-render`='1' confirms render-off.
 */

export interface Bim3DRenderSample {
  readonly isInteracting: boolean;
  readonly viewportAnimating: boolean;
  readonly animationManagerActive: boolean;
  readonly pathTracerActive: boolean;
  readonly explicitDirty: boolean;
  readonly ssaoActive: boolean;
}

interface Bim3DPerfState {
  renderCount: number;
  totalMs: number;
  maxMs: number;
  windowStartMs: number;
  // Dirty-reason histogram (a render can have several flags true at once → count each).
  reasons: Record<keyof Bim3DRenderSample, number>;
  markDirtyCallers: Map<string, number>;
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

function createState(): Bim3DPerfState {
  const state: Bim3DPerfState = {
    renderCount: 0, totalMs: 0, maxMs: 0,
    windowStartMs: typeof performance !== 'undefined' ? performance.now() : 0,
    reasons: emptyReasons(),
    markDirtyCallers: new Map<string, number>(),
    reset() {
      this.renderCount = 0; this.totalMs = 0; this.maxMs = 0;
      this.windowStartMs = typeof performance !== 'undefined' ? performance.now() : 0;
      this.reasons = emptyReasons();
      this.markDirtyCallers.clear();
      // eslint-disable-next-line no-console
      console.log('[ADR-549] __bim3dPerf reset');
    },
    dump() {
      const elapsedS = ((typeof performance !== 'undefined' ? performance.now() : 0) - this.windowStartMs) / 1000;
      const rps = elapsedS > 0 ? this.renderCount / elapsedS : 0;
      const avg = this.renderCount > 0 ? this.totalMs / this.renderCount : 0;
      // eslint-disable-next-line no-console
      console.log(
        `[ADR-549] renders=${this.renderCount} over ${elapsedS.toFixed(1)}s ` +
        `→ ${rps.toFixed(1)}/s | avg=${avg.toFixed(2)}ms max=${this.maxMs.toFixed(2)}ms total=${this.totalMs.toFixed(0)}ms`,
      );
      // eslint-disable-next-line no-console
      console.log('[ADR-549] dirty-reason histogram (flag true on a render frame):', { ...this.reasons });
      if (this.markDirtyCallers.size > 0) {
        const sorted = [...this.markDirtyCallers.entries()].sort((a, b) => b[1] - a[1]);
        // eslint-disable-next-line no-console
        console.log('[ADR-549] markSceneDirty callers (top):', Object.fromEntries(sorted.slice(0, 12)));
      } else {
        // eslint-disable-next-line no-console
        console.log('[ADR-549] markSceneDirty callers: none captured (set localStorage dxf-trace-dirty=1)');
      }
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

// EAGER attach at module load so `window.__bim3dPerf.reset()/dump()` is ALWAYS reachable from the
// console the instant the 3D viewport mounts (this module is statically imported by
// ThreeJsSceneManager) — even before the first render fires. Avoids the "undefined" trap.
getState();

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

/** Called from `ThreeJsSceneManager.markSceneDirty` (only does work when `dxf-trace-dirty`=1). */
export function recordMarkDirty(): void {
  if (!isTracingDirty()) return;
  const s = getState();
  if (!s) return;
  const stack = new Error().stack?.split('\n') ?? [];
  // Frame 0 = "Error", 1 = recordMarkDirty, 2 = markSceneDirty → caller is frame 3.
  const raw = (stack[3] ?? stack[2] ?? 'unknown').trim();
  // Keep only the function/identifier part, strip file:line noise for a readable histogram.
  const key = raw.replace(/^at\s+/, '').replace(/\s+\(.*$/, '').slice(0, 80) || raw.slice(0, 80);
  s.markDirtyCallers.set(key, (s.markDirtyCallers.get(key) ?? 0) + 1);
}
