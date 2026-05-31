/**
 * @module hooks/state/useConstructionPointState
 * @description React hook bridging ConstructionPointStore to the component tree.
 *
 * Uses `useSyncExternalStore` for tear-free subscription to the store singleton.
 * Mutations are wrapped in Commands (undo/redo). Pure geometry math lives in
 * `systems/guides/construction-point-geometry.ts` (N.7.1 size split) — this hook
 * is a thin store bridge that just wraps the computed point sets in batch commands.
 *
 * @see ADR-189 §3.7, §3.8, §3.9, §3.10, §3.11, §3.12, §3.15, §3.16
 * @see construction-point-geometry.ts (extracted pure math)
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
import type { Point2D } from '../../rendering/types/Types';
import {
  computeSegmentPoints,
  computeDistancePoints,
  computeArcSegmentPoints,
  computeArcDistancePoints,
  computeLineArcIntersection,
  computeCircleCircleIntersection,
} from '../../systems/guides/construction-point-geometry';

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
  /** §3.9: Add equally-spaced points along an arc/circle. Returns the command. */
  addArcSegmentPoints: (
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    count: number, isFullCircle: boolean,
  ) => AddConstructionPointBatchCommand;
  /** §3.10: Add points at fixed arc-length distance along an arc/circle. Returns the command. */
  addArcDistancePoints: (
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    distance: number, isFullCircle: boolean,
  ) => AddConstructionPointBatchCommand;
  /** §3.12: Add intersection points of a line segment with an arc/circle. Returns the command. */
  addLineArcIntersectionPoints: (
    lineStart: Point2D, lineEnd: Point2D,
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    isFullCircle: boolean,
  ) => AddConstructionPointBatchCommand;
  /** §3.11: Add intersection points of two arcs/circles. Returns the command. */
  addCircleCircleIntersectionPoints: (
    center1: Point2D, radius1: number, startAngle1Deg: number, endAngle1Deg: number, isFullCircle1: boolean,
    center2: Point2D, radius2: number, startAngle2Deg: number, endAngle2Deg: number, isFullCircle2: boolean,
  ) => AddConstructionPointBatchCommand;
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

  // §3.9: Arc segment points
  const addArcSegmentPoints = useCallback((
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    count: number, isFullCircle: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeArcSegmentPoints(center, radius, startAngleDeg, endAngleDeg, count, isFullCircle);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.10: Arc distance points
  const addArcDistancePoints = useCallback((
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    distance: number, isFullCircle: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeArcDistancePoints(center, radius, startAngleDeg, endAngleDeg, distance, isFullCircle);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.12: Line-arc intersection points
  const addLineArcIntersectionPoints = useCallback((
    lineStart: Point2D, lineEnd: Point2D,
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    isFullCircle: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeLineArcIntersection(lineStart, lineEnd, center, radius, startAngleDeg, endAngleDeg, isFullCircle);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.11: Circle-circle intersection points
  const addCircleCircleIntersectionPoints = useCallback((
    center1: Point2D, radius1: number, startAngle1Deg: number, endAngle1Deg: number, isFullCircle1: boolean,
    center2: Point2D, radius2: number, startAngle2Deg: number, endAngle2Deg: number, isFullCircle2: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeCircleCircleIntersection(
      center1, radius1, startAngle1Deg, endAngle1Deg, isFullCircle1,
      center2, radius2, startAngle2Deg, endAngle2Deg, isFullCircle2,
    );
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
    addArcSegmentPoints,
    addArcDistancePoints,
    addLineArcIntersectionPoints,
    addCircleCircleIntersectionPoints,
    deletePoint,
    findNearest,
    clearAll,
    getStore,
  };
}
