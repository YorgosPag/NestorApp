/**
 * @module cpm-types
 * @enterprise ADR-266 Phase C Sub-phase 2 — Critical Path Method types
 *
 * Types for CPM computation results (ES/EF/LS/LF/Float).
 * Pure type definitions — no runtime code.
 */

import type { ConstructionTaskStatus } from '@/types/building/construction';

// ─── Per-Task CPM Result ────────────────────────────────────────────────

export interface CPMTaskResult {
  taskId: string;
  taskName: string;
  taskCode: string;
  phaseId: string;
  phaseName: string;
  /** Duration in calendar days */
  durationDays: number;
  /** Early Start — earliest the task can begin (ISO 8601) */
  earlyStart: string;
  /** Early Finish — earliest the task can complete (ISO 8601) */
  earlyFinish: string;
  /** Late Start — latest the task can begin without delaying project (ISO 8601) */
  lateStart: string;
  /** Late Finish — latest the task can complete without delaying project (ISO 8601) */
  lateFinish: string;
  /** Total Float = LS - ES in days. 0 = critical */
  totalFloat: number;
  /** Whether this task is on the critical path */
  isCritical: boolean;
  /** If delayed/in-progress, how many days past EF */
  delayImpactDays: number;
  /** Part of a circular dependency (excluded from CPM) */
  hasCyclicDependency: boolean;
  /** Source task status */
  status: ConstructionTaskStatus;
  /** Source task progress 0-100 */
  progress: number;
}

// ─── Full CPM Computation Result ────────────────────────────────────────

export interface CPMResult {
  /** All tasks with CPM data */
  tasks: CPMTaskResult[];
  /** Critical path tasks only, in sequence order (by ES) */
  criticalPath: CPMTaskResult[];
  /** Total project duration via critical path (days) */
  criticalPathLength: number;
  /** Project early finish date (ISO 8601) */
  projectEarlyFinish: string;
  /** Task IDs involved in circular dependencies */
  cyclicTaskIds: string[];
  /** false if no valid tasks to compute */
  isValid: boolean;
}
