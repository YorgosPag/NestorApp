/**
 * @module hooks/state/useConstructionPointState
 * @description React hook bridging ConstructionPointStore to the component tree.
 *
 * Uses `useSyncExternalStore` for tear-free subscription to the store singleton.
 * Mutations are wrapped in Commands (undo/redo).
 *
 * @see ADR-189 §3.7, §3.8, §3.15, §3.16
 * @see useGuideState.ts (template pattern)
 * @since 2026-02-20
 */

import { useSyncExternalStore, useCallback } from 'react';
import { getGlobalConstructionPointStore } from '../../systems/guides/construction-point-store';
import {
  AddConstructionPointCommand,
  AddConstructionPointBatchCommand,
  DeleteConstructionPointCommand,
} from '../../systems/guides/construction-point-commands';
import type { ConstructionPoint } from '../../systems/guides/guide-types';
import { CONSTRUCTION_POINT_LIMITS } from '../../systems/guides/guide-types';
import type { Point2D } from '../../rendering/types/Types';

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Compute equally-spaced points between start and end.
 * segmentCount = N → creates N+1 points (including start and end).
 */
function computeSegmentPoints(
  start: Point2D,
  end: Point2D,
  segmentCount: number,
): Array<{ point: Point2D }> {
  const results: Array<{ point: Point2D }> = [];
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    results.push({
      point: {
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
      },
    });
  }
  return results;
}

/**
 * Compute points at fixed distance intervals between start and end.
 * Always includes start and end points.
 * Last interval may be shorter if total distance isn't evenly divisible.
 */
function computeDistancePoints(
  start: Point2D,
  end: Point2D,
  distance: number,
): Array<{ point: Point2D }> {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalLen = Math.sqrt(dx * dx + dy * dy);

  if (totalLen < CONSTRUCTION_POINT_LIMITS.MIN_DISTANCE || distance <= 0) {
    return [{ point: { x: start.x, y: start.y } }];
  }

  const ux = dx / totalLen;
  const uy = dy / totalLen;

  const results: Array<{ point: Point2D }> = [{ point: { x: start.x, y: start.y } }];
  let d = distance;
  while (d < totalLen - CONSTRUCTION_POINT_LIMITS.MIN_DISTANCE) {
    results.push({ point: { x: start.x + ux * d, y: start.y + uy * d } });
    d += distance;
  }
  // Always include end point
  results.push({ point: { x: end.x, y: end.y } });
  return results;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseConstructionPointStateReturn {
  /** All current construction points (readonly snapshot) */
  points: readonly ConstructionPoint[];
  /** Total point count */
  pointCount: number;

  /** Add a single point. Returns the command for undo. */
  addPoint: (point: Point2D, label?: string | null) => AddConstructionPointCommand;
  /** Add equally-spaced points between start and end. Returns the command. */
  addSegmentPoints: (start: Point2D, end: Point2D, segmentCount: number) => AddConstructionPointBatchCommand;
  /** Add points at fixed distance intervals between start and end. Returns the command. */
  addDistancePoints: (start: Point2D, end: Point2D, distance: number) => AddConstructionPointBatchCommand;
  /** Delete a point by ID. Returns the command. */
  deletePoint: (pointId: string) => DeleteConstructionPointCommand;
  /** Find the nearest visible point to a world position */
  findNearest: (worldPoint: Point2D, maxDistance: number) => ConstructionPoint | null;
  /** Clear all points (not undoable) */
  clearAll: () => void;
  /** Direct access to the store singleton */
  getStore: () => ReturnType<typeof getGlobalConstructionPointStore>;
}

/**
 * React hook for the Construction Snap Points system.
 *
 * Usage:
 * ```tsx
 * const { points, addPoint, addSegmentPoints, deletePoint } = useConstructionPointState();
 * ```
 */
export function useConstructionPointState(): UseConstructionPointStateReturn {
  const store = getGlobalConstructionPointStore();

  // Subscribe to store changes via useSyncExternalStore
  const points = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getPoints(),
    () => store.getPoints(),
  );

  const pointCount = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.count,
    () => store.count,
  );

  // ── Mutations ──

  const addPoint = useCallback((point: Point2D, label: string | null = null): AddConstructionPointCommand => {
    const cmd = new AddConstructionPointCommand(store, point, label);
    cmd.execute();
    return cmd;
  }, [store]);

  const addSegmentPoints = useCallback((start: Point2D, end: Point2D, segmentCount: number): AddConstructionPointBatchCommand => {
    const pointDefs = computeSegmentPoints(start, end, segmentCount);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  const addDistancePoints = useCallback((start: Point2D, end: Point2D, distance: number): AddConstructionPointBatchCommand => {
    const pointDefs = computeDistancePoints(start, end, distance);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  const deletePoint = useCallback((pointId: string): DeleteConstructionPointCommand => {
    const cmd = new DeleteConstructionPointCommand(store, pointId);
    cmd.execute();
    return cmd;
  }, [store]);

  const findNearest = useCallback((worldPoint: Point2D, maxDistance: number): ConstructionPoint | null => {
    return store.findNearestPoint(worldPoint, maxDistance);
  }, [store]);

  const clearAll = useCallback(() => {
    store.clearAll();
  }, [store]);

  const getStore = useCallback(() => store, [store]);

  return {
    points,
    pointCount,
    addPoint,
    addSegmentPoints,
    addDistancePoints,
    deletePoint,
    findNearest,
    clearAll,
    getStore,
  };
}
