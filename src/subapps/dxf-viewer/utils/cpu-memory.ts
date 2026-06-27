/**
 * cpu-memory — SSoT (DXF viewer) for reading CPU heap usage.
 *
 * The Chrome `performance.memory` API is non-standard (absent on Firefox/Safari).
 * This is the single reader used across the DXF viewer: the 3D + 2D performance
 * collectors (ADR-366 §B.5.U) and the DxfPerformanceOptimizer. Returns MB rounded
 * to 1 decimal, or null when the API is unavailable.
 *
 * NOTE: a `PerformanceWithMemory`-style type is also declared separately in the
 * geo-canvas and core/performance subapps. Unifying that type app-wide is a
 * distinct cross-subapp effort (flagged in ADR-366 §B.5.U) — out of scope here.
 */

// Chrome-only Performance API extension (non-standard).
interface ChromePerformance extends Performance {
  memory?: { usedJSHeapSize: number };
}

/** CPU heap usage in MB (Chrome `performance.memory`), or null when unavailable. */
export function readCpuMemoryMb(): number | null {
  const chromePerf = performance as ChromePerformance;
  return chromePerf.memory
    ? parseFloat((chromePerf.memory.usedJSHeapSize / 1_048_576).toFixed(1))
    : null;
}
