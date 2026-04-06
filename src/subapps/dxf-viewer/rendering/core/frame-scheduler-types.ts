/**
 * Frame Scheduler Types — ADR-065 SRP split
 * Types, interfaces, and constants for the Unified Frame Scheduler.
 */

/** Render priority levels - lower number = higher priority */
export type RenderPriority = 0 | 1 | 2 | 3 | 4;

export const RENDER_PRIORITIES = {
  /** Critical UI (cursor, crosshair) - must render every frame */
  CRITICAL: 0 as RenderPriority,
  /** High priority (selection, grips) */
  HIGH: 1 as RenderPriority,
  /** Normal priority (entities, layers) */
  NORMAL: 2 as RenderPriority,
  /** Low priority (grid, rulers) */
  LOW: 3 as RenderPriority,
  /** Background (PDF, images) */
  BACKGROUND: 4 as RenderPriority,
} as const;

/** Render callback function type */
export type RenderCallback = (deltaTime: number, frameNumber: number) => void;

/** Dirty check function type - returns true if component needs render */
export type DirtyCheckFn = () => boolean;

/** Registered render system */
export interface RenderSystem {
  id: string;
  name: string;
  priority: RenderPriority;
  render: RenderCallback;
  isDirty?: DirtyCheckFn;
  enabled: boolean;
  /** ADR-156: Force dirty flag - bypasses isDirty check for one frame */
  forceDirty: boolean;
  metrics: {
    lastRenderTime: number;
    averageRenderTime: number;
    renderCount: number;
    skipCount: number;
  };
}

/** Frame metrics for performance monitoring */
export interface FrameMetrics {
  frameNumber: number;
  deltaTime: number;
  fps: number;
  averageFps: number;
  systemCount: number;
  renderedCount: number;
  skippedCount: number;
  totalFrameTime: number;
  systemMetrics: Map<string, { renderTime: number; skipped: boolean }>;
}

/** Scheduler configuration */
export interface SchedulerConfig {
  targetFps: number;
  enableThrottling: boolean;
  throttleThreshold: number;
  debug: boolean;
  collectMetrics: boolean;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  targetFps: 60,
  enableThrottling: true,
  throttleThreshold: 16.67,
  debug: false,
  collectMetrics: true,
};

export const FRAME_TIME_60FPS = 1000 / 60;
export const FPS_SAMPLE_SIZE = 60;
