/**
 * browser-performance-memory — SSoT for the non-standard Chrome `performance.memory` API.
 *
 * `performance.memory` is a Chrome-only extension (absent on Firefox/Safari). This is the
 * single place in the app that declares its TypeScript shape and performs the unsafe cast.
 * Every performance/memory consumer (dxf-viewer 3D+2D collectors, DxfPerformanceOptimizer,
 * core EnterprisePerformanceManager, geo-canvas PerformanceMonitor / MemoryLeakDetector /
 * PerformanceProfiler) reads through here — no module re-declares the type or re-casts.
 *
 * Architecture: lightweight platform-abstraction layer (the Revit/Maxon "Platform/System
 * layer" principle applied to web — wrap the OS/runtime capability once, never scatter raw
 * casts). See ADR-546.
 *
 * Returns RAW BYTES at the low level so each consumer keeps its own units (bytes vs MB).
 */

/** Chrome-only non-standard `performance.memory` shape. All values are bytes. */
export interface PerformanceMemory {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

/** `Performance` extended with the Chrome-only optional `memory` field. */
export interface PerformanceWithMemory extends Performance {
  readonly memory?: PerformanceMemory;
}

/**
 * Raw heap snapshot in bytes, or null when the API is unavailable (non-Chrome / SSR).
 * The single SSoT cast — consumers must use this instead of `performance as ...`.
 */
export function readPerformanceMemory(): PerformanceMemory | null {
  if (typeof performance === 'undefined') return null;
  return (performance as PerformanceWithMemory).memory ?? null;
}

/**
 * Used heap in MB rounded to 1 decimal, or null when unavailable.
 * Thin helper for HUD / simple display consumers.
 */
export function readCpuMemoryMb(): number | null {
  const memory = readPerformanceMemory();
  return memory ? parseFloat((memory.usedJSHeapSize / 1_048_576).toFixed(1)) : null;
}
