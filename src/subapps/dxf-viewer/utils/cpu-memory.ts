/**
 * cpu-memory — DXF viewer CPU-heap reader.
 *
 * Thin re-export of the app-wide SSoT in src/lib/platform (ADR-546). Kept as a stable
 * import path for the DXF viewer consumers (3D + 2D performance collectors, ADR-366 §B.5.U,
 * and DxfPerformanceOptimizer). Returns used heap in MB (1 decimal) or null when the
 * non-standard Chrome `performance.memory` API is unavailable.
 */

export { readCpuMemoryMb } from '@/lib/platform/browser-performance-memory';
