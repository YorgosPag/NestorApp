/**
 * multi-floor-3d-source — non-React SSoT for the aggregated multi-floor BIM
 * entity stack consumed by the 3D viewer's "Όλοι οι όροφοι" (all floors) scope.
 *
 * ADR-399 Phase B. Plain module store (mirror of `ImmediatePositionStore` /
 * `ImmediateTransformStore` pattern): zero React state so the scope-aware
 * `resyncBimScene` SSoT — called from non-React store subscribers — can read
 * the current stack synchronously. The producer is `useFloors3DAggregator`
 * (writes per-floor entities + elevation); the consumer is
 * `use-bim3d-multifloor-sync` (subscribes → triggers a multi-floor rebuild).
 *
 * Each entry carries the floor's own `floorElevationMm` (ADR-369 elevation in
 * metres × 1000) so `BimSceneLayer.syncMultiFloor` stacks every floor at the
 * right height while reusing the existing per-entity converters unchanged.
 */

import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';

export interface FloorStackEntry {
  /** Linked DXF level id — used to tag meshes for per-floor visibility. */
  readonly levelId: string;
  /** Vertical offset of this floor, in millimetres (ADR-369 elevation × 1000). */
  readonly floorElevationMm: number;
  /** ADR-448 Phase 1b — datum-relative FFL of the next floor up (storey ceiling). */
  readonly nextFloorElevationMm?: number;
  /** The floor's BIM entities (live for the active floor, snapshot otherwise). */
  readonly entities: Bim3DEntities;
}

let stack: readonly FloorStackEntry[] = [];
const listeners = new Set<() => void>();

/** Current aggregated floor stack (empty unless scope === 'all'). */
export function getMultiFloorStack(): readonly FloorStackEntry[] {
  return stack;
}

/** Replace the stack and notify subscribers (idempotent on identity). */
export function setMultiFloorStack(next: readonly FloorStackEntry[]): void {
  if (next === stack) return;
  stack = next;
  for (const fn of listeners) fn();
}

/** Subscribe to stack replacements. Returns an unsubscribe fn. */
export function subscribeMultiFloorStack(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
