/**
 * performance-collector-shared — ADR-366 §B.5.U
 *
 * SSoT for the logic the 3D (PerformanceCollector, renderer.info) and 2D
 * (Performance2DCollector, frame scheduler) collectors share. Each collector
 * keeps its OWN source-specific tick (fps source, gates, snapshot shape) but
 * routes the common bits through here so there is one CPU-memory reader and one
 * "write to the shared stores" path.
 *
 * Pure module — no React.
 */

import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { usePerformanceHistoryStore } from './PerformanceHistoryStore';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

// CPU-memory read is the DXF-viewer-wide SSoT (also used by DxfPerformanceOptimizer).
// Re-exported here so the collectors keep a single "shared collector concerns" import.
export { readCpuMemoryMb } from '../../utils/cpu-memory';

/**
 * Write a metrics snapshot to the shared HUD display store + history ring buffer.
 * Single source for the "commit" both collectors perform every tick. Each store
 * keeps its own enable/gate logic internally, so callers just hand over the snapshot.
 */
export function commitPerformanceSnapshot(snapshot: PerformanceMetricsSnapshot): void {
  usePerformanceHUDStore.getState().updateMetrics(snapshot);
  usePerformanceHistoryStore.getState().pushSample(snapshot);
}
