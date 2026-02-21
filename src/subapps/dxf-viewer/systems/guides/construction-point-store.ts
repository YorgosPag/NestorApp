/**
 * @module systems/guides/construction-point-store
 * @description Pure data store for construction snap points (X markers)
 *
 * Singleton pattern with observer subscription for React integration.
 * Mirrors GuideStore architecture: immutable updates, useSyncExternalStore compat.
 *
 * Construction points are discrete snap markers (not lines) created by:
 * - "Σε Τμήματα" (equal segments)
 * - "Ανά Απόσταση" (fixed distance)
 * - "Προσθήκη Σημείου" (single point)
 *
 * @see ADR-189 §3.7, §3.8, §3.15, §3.16
 * @since 2026-02-20
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ConstructionPoint } from './guide-types';
import { CONSTRUCTION_POINT_LIMITS } from './guide-types';
import { generateEntityId } from '../entity-creation/utils';

// ============================================================================
// TYPES
// ============================================================================

type StoreListener = () => void;

// ============================================================================
// CONSTRUCTION POINT STORE
// ============================================================================

/**
 * Pure data store for construction snap points.
 * No React dependency — communicates via observer pattern.
 * Singleton per application instance.
 */
export class ConstructionPointStore {
  private points: ConstructionPoint[] = [];
  private listeners = new Set<StoreListener>();
  private version = 0;

  // ── Observer Pattern ──

  /** Subscribe to store changes. Returns unsubscribe function. */
  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Notify all subscribers of a state change */
  private notify(): void {
    this.version++;
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('[ConstructionPointStore] Listener error:', err);
      }
    });
  }

  /** Current version (increments on every mutation — for React memoization) */
  getVersion(): number {
    return this.version;
  }

  // ── Read Operations ──

  /** Get all construction points (readonly snapshot) */
  getPoints(): readonly ConstructionPoint[] {
    return this.points;
  }

  /** Get a point by ID */
  getPointById(id: string): ConstructionPoint | undefined {
    return this.points.find(p => p.id === id);
  }

  /** Get points by group ID */
  getPointsByGroupId(groupId: string): readonly ConstructionPoint[] {
    return this.points.filter(p => p.groupId === groupId);
  }

  /** Find the nearest visible point to a world position */
  findNearestPoint(worldPoint: Point2D, maxDistance: number): ConstructionPoint | null {
    let nearest: ConstructionPoint | null = null;
    let bestDist = maxDistance;

    for (const pt of this.points) {
      if (!pt.visible) continue;

      const dx = worldPoint.x - pt.point.x;
      const dy = worldPoint.y - pt.point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        nearest = pt;
      }
    }

    return nearest;
  }

  /** Total number of construction points */
  get count(): number {
    return this.points.length;
  }

  // ── Write Operations ──

  /**
   * Add a single construction point.
   * Returns the created point or undefined if limit reached.
   */
  addPoint(
    point: Point2D,
    label: string | null = null,
    groupId: string | null = null,
  ): ConstructionPoint | undefined {
    if (this.points.length >= CONSTRUCTION_POINT_LIMITS.MAX_POINTS) {
      console.warn(`[ConstructionPointStore] Max points limit reached (${CONSTRUCTION_POINT_LIMITS.MAX_POINTS})`);
      return undefined;
    }

    const cpt: ConstructionPoint = {
      id: `cpt_${generateEntityId()}`,
      point: { x: point.x, y: point.y },
      label,
      visible: true,
      locked: false,
      createdAt: new Date().toISOString(),
      groupId,
    };

    // CRITICAL: Create new array — useSyncExternalStore uses Object.is()
    this.points = [...this.points, cpt];
    this.notify();
    return cpt;
  }

  /**
   * Add a batch of construction points (for Segments/Distance tools).
   * Single notification after all points are added — better performance.
   * Returns the number of points actually added.
   */
  addPointsBatch(
    pointDefs: ReadonlyArray<{ point: Point2D; label?: string }>,
    groupId: string,
  ): number {
    const remaining = CONSTRUCTION_POINT_LIMITS.MAX_POINTS - this.points.length;
    if (remaining <= 0) {
      console.warn(`[ConstructionPointStore] Max points limit reached (${CONSTRUCTION_POINT_LIMITS.MAX_POINTS})`);
      return 0;
    }

    const toAdd = pointDefs.slice(0, remaining);
    const timestamp = new Date().toISOString();
    const newPoints: ConstructionPoint[] = toAdd.map(def => ({
      id: `cpt_${generateEntityId()}`,
      point: { x: def.point.x, y: def.point.y },
      label: def.label ?? null,
      visible: true,
      locked: false,
      createdAt: timestamp,
      groupId,
    }));

    // CRITICAL: Create new array — useSyncExternalStore uses Object.is()
    this.points = [...this.points, ...newPoints];
    this.notify();
    return newPoints.length;
  }

  /** Re-add a previously created point (for redo) */
  restorePoint(point: ConstructionPoint): void {
    if (this.points.some(p => p.id === point.id)) return;
    this.points = [...this.points, { ...point }];
    this.notify();
  }

  /** Re-add a batch of previously created points (for redo of batch operations) */
  restorePointsBatch(pointsToRestore: readonly ConstructionPoint[]): void {
    const existingIds = new Set(this.points.map(p => p.id));
    const toRestore = pointsToRestore.filter(p => !existingIds.has(p.id));
    if (toRestore.length === 0) return;

    this.points = [...this.points, ...toRestore.map(p => ({ ...p }))];
    this.notify();
  }

  /** Remove a point by ID. Returns the removed point or undefined. */
  removePointById(id: string): ConstructionPoint | undefined {
    const index = this.points.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    const point = this.points[index];
    if (point.locked) return undefined;

    this.points = this.points.filter(p => p.id !== id);
    this.notify();
    return point;
  }

  /**
   * Remove all points in a group. Returns the number of points removed.
   * Used for undo of batch operations (Segments/Distance).
   */
  removePointsByGroupId(groupId: string): readonly ConstructionPoint[] {
    const toRemove = this.points.filter(p => p.groupId === groupId && !p.locked);
    if (toRemove.length === 0) return [];

    const idsToRemove = new Set(toRemove.map(p => p.id));
    this.points = this.points.filter(p => !idsToRemove.has(p.id));
    this.notify();
    return toRemove;
  }

  /** Set the label of a construction point */
  setPointLabel(id: string, label: string | null): void {
    const index = this.points.findIndex(p => p.id === id);
    if (index === -1) return;
    this.points = this.points.map(p =>
      p.id === id ? { ...p, label } : p
    );
    this.notify();
  }

  /** Set the visibility of a construction point */
  setPointVisible(id: string, visible: boolean): void {
    const index = this.points.findIndex(p => p.id === id);
    if (index === -1) return;
    this.points = this.points.map(p =>
      p.id === id ? { ...p, visible } : p
    );
    this.notify();
  }

  /** Set the locked state of a construction point */
  setPointLocked(id: string, locked: boolean): void {
    const index = this.points.findIndex(p => p.id === id);
    if (index === -1) return;
    this.points = this.points.map(p =>
      p.id === id ? { ...p, locked } : p
    );
    this.notify();
  }

  /** Clear all construction points */
  clearAll(): void {
    if (this.points.length === 0) return;
    this.points = [];
    this.notify();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let globalInstance: ConstructionPointStore | null = null;

/** Get the global ConstructionPointStore singleton */
export function getGlobalConstructionPointStore(): ConstructionPointStore {
  if (!globalInstance) {
    globalInstance = new ConstructionPointStore();
  }
  return globalInstance;
}
