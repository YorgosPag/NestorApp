/**
 * Frame Scheduler Convenience API — ADR-065 SRP split
 * Standalone export functions for common operations.
 * Re-exports types for backward compatibility.
 */

import { UnifiedFrameScheduler } from './UnifiedFrameScheduler';

// Re-export all types for consumers
export type {
  RenderPriority,
  RenderCallback,
  DirtyCheckFn,
  RenderSystem,
  FrameMetrics,
  SchedulerConfig,
} from './frame-scheduler-types';
export { RENDER_PRIORITIES } from './frame-scheduler-types';

/** Hook for React components */
export function useFrameScheduler() {
  return UnifiedFrameScheduler;
}

/** Register a render callback (convenience) */
export function registerRenderCallback(
  id: string,
  name: string,
  priority: import('./frame-scheduler-types').RenderPriority,
  render: import('./frame-scheduler-types').RenderCallback,
  isDirty?: import('./frame-scheduler-types').DirtyCheckFn
): () => void {
  return UnifiedFrameScheduler.register(id, name, priority, render, isDirty);
}

/**
 * ADR-156: Mark ALL canvas layers as dirty.
 * Ensures all layers re-render together, preventing flickering.
 */
export function markAllCanvasDirty(): void {
  UnifiedFrameScheduler.markAllCanvasDirty();
}

/** ADR-156: Mark a specific system as dirty */
export function markSystemDirty(id: string): void {
  UnifiedFrameScheduler.markDirty(id);
}

/**
 * ADR-156: Mark specific canvas systems as dirty.
 * Use instead of markAllCanvasDirty() to exclude certain canvases.
 */
export function markSystemsDirty(systemIds: string[]): void {
  UnifiedFrameScheduler.markSystemsDirty(systemIds);
}

/**
 * ADR-163: Force SYNCHRONOUS render of ALL canvas layers.
 * Use after direct/immediate renders to prevent flickering.
 */
export function forceImmediateRenderAll(): void {
  UnifiedFrameScheduler.forceImmediateRenderAll();
}
