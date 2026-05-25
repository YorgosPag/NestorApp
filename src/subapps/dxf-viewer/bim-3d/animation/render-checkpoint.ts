/**
 * ADR-366 Phase 9 / C.1.c — Render Checkpoint Serialization
 *
 * Serializes mid-render progress (last completed frame index + waypoint
 * index) into the RenderJobDoc shape so a cancelled job can resume from
 * the exact frame where it stopped — instead of restarting at frame 0.
 *
 * RenderJobDoc schema reuse (no schema change):
 *  - `lastSampleCount`  → repurposed semantically as lastFrameIndex
 *    (ADR §C.1.Q9 nominated the field name during path-tracer planning;
 *    C.1.c picked the rasterizer path so "frame" replaces "sample" in
 *    the semantic mapping. Storage shape identical.)
 *  - `lastWaypointIndex` → direct passthrough.
 *
 * Pure functions — no Firestore dependency. Consumed by
 * animation-queue-processor on cancel + retry.
 */

import type { RenderJobDoc } from './animation-types';
import type { UpdateRenderJobInput } from '../services/bim-animations.service';

export interface RenderCheckpoint {
  readonly lastFrameIndex: number;
  readonly lastWaypointIndex: number;
}

export type CheckpointPatch = Pick<
  UpdateRenderJobInput,
  'lastSampleCount' | 'lastWaypointIndex'
>;

/** Pack a checkpoint into a RenderJobDoc update patch. */
export function serializeCheckpoint(c: RenderCheckpoint): CheckpointPatch {
  return {
    lastSampleCount: Math.max(0, Math.floor(c.lastFrameIndex)),
    lastWaypointIndex: Math.max(0, Math.floor(c.lastWaypointIndex)),
  };
}

/**
 * Read a checkpoint from a persisted RenderJobDoc. Returns null when the
 * job has no saved checkpoint (fresh queued job, or completed without
 * cancellation).
 */
export function deserializeCheckpoint(job: RenderJobDoc): RenderCheckpoint | null {
  if (job.lastSampleCount === undefined && job.lastWaypointIndex === undefined) {
    return null;
  }
  return {
    lastFrameIndex: Math.max(0, Math.floor(job.lastSampleCount ?? 0)),
    lastWaypointIndex: Math.max(0, Math.floor(job.lastWaypointIndex ?? 0)),
  };
}

/**
 * Derive the resume frame index for an MP4Exporter call. When no
 * checkpoint exists, render starts at frame 0.
 */
export function resumeFrameIndex(job: RenderJobDoc): number {
  const cp = deserializeCheckpoint(job);
  return cp?.lastFrameIndex ?? 0;
}
