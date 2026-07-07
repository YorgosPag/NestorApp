/**
 * @module bim/grips/rotation-snap-store
 * @description SSoT for the snap targets that are active DURING a BIM rotation
 * operation (ADR-397): the rotation pivot ⊙ and the rotating entity's grips.
 *
 * Imperative module-singleton (mirrors `systems/guides/construction-point-store`,
 * zero React). Populated when the rotation centre is picked, cleared when the
 * rotation flow resets. Two consumers:
 *  - `RotationPointSnapEngine` reads pivot + grips → snap candidates (cursor point-magnetism).
 *  - `BaseEntityRenderer.renderGrips` reads `snappableKeys()` → those grips render
 *    cyan ('snappable') via the grip-temperature SSoT.
 *
 * @see ADR-397 §15 — grip glyph / temperature / snap-target SSoT
 * @since 2026-06-11
 */

import type { Point2D } from '../../rendering/types/Types';
import { gripKey } from '../../rendering/grips/grip-temperature';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { ExtendedSnapType } from '../../snapping/extended-types';

/** Tolerance (world units) for matching a snapped point back to a grip. */
const KEY_FOR_POINT_EPS = 0.5;

/** A single rotating-entity grip exposed as a snap target. */
export interface RotationGripTarget {
  /** `${entityId}_${gripIndex}` — matches the grip-temperature snappable key. */
  readonly key: string;
  readonly point: Point2D;
}

type Listener = () => void;

/**
 * Pure data store for rotation snap targets. No React dependency — observer
 * pattern for any reactive consumer; engines/renderers read imperatively.
 */
export class RotationSnapStore {
  private pivot: Point2D | null = null;
  private grips: readonly RotationGripTarget[] = [];
  private listeners = new Set<Listener>();
  private version = 0;

  // ── Observer ──

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.version++;
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('[RotationSnapStore] Listener error:', err);
      }
    });
  }

  /** Increments on every mutation — for React memoization. */
  getVersion(): number {
    return this.version;
  }

  // ── Mutations ──

  /**
   * Arm the rotation snap targets. `grips` are captured at centre-pick time (the
   * entity's grip world-points) and stay fixed for the operation.
   */
  setTargets(
    pivot: Point2D | null,
    grips: ReadonlyArray<{ entityId: string; gripIndex: number; point: Point2D }>,
  ): void {
    this.pivot = pivot ? { x: pivot.x, y: pivot.y } : null;
    this.grips = grips.map((g) => ({ key: gripKey(g.entityId, g.gripIndex), point: { x: g.point.x, y: g.point.y } }));
    this.notify();
  }

  /** Disarm — no rotation in progress. Idempotent (no-op when already empty). */
  clear(): void {
    if (!this.pivot && this.grips.length === 0) return;
    this.pivot = null;
    this.grips = [];
    this.notify();
  }

  // ── Reads ──

  /** True while a rotation has armed snap targets (pivot and/or grips). */
  isActive(): boolean {
    return this.pivot !== null || this.grips.length > 0;
  }

  getPivot(): Point2D | null {
    return this.pivot;
  }

  getGrips(): readonly RotationGripTarget[] {
    return this.grips;
  }

  /** Grip key whose point equals `point` (within tolerance), or null. */
  keyForPoint(point: Point2D): string | null {
    for (const g of this.grips) {
      if (Math.abs(g.point.x - point.x) <= KEY_FOR_POINT_EPS && Math.abs(g.point.y - point.y) <= KEY_FOR_POINT_EPS) {
        return g.key;
      }
    }
    return null;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let globalInstance: RotationSnapStore | null = null;

/** Get the global RotationSnapStore singleton. */
export function getGlobalRotationSnapStore(): RotationSnapStore {
  if (!globalInstance) {
    globalInstance = new RotationSnapStore();
  }
  return globalInstance;
}

/**
 * ADR-397 — the rotating entity's grips as rotation snap-target inputs (world
 * points). SSoT for the `AllGripsStore`/`allGrips` → `setTargets` projection,
 * shared by BOTH arming sites (the await-base ENTER in `grip-mouse-handlers` and the
 * centre-pick `seedRotateFreeStep` via `useUnifiedGripInteraction`) so they can never
 * drift. Structural param type (no `UnifiedGripInfo` import → no layer cycle).
 */
export function collectEntityGripWorldPoints(
  grips: ReadonlyArray<{ readonly source?: string; readonly entityId?: string; readonly gripIndex: number; readonly position: Point2D }>,
  entityId: string,
): Array<{ entityId: string; gripIndex: number; point: Point2D }> {
  return grips
    .filter((g) => g.source === 'dxf' && g.entityId === entityId)
    .map((g) => ({ entityId: g.entityId!, gripIndex: g.gripIndex, point: g.position }));
}

/**
 * The grip key that should currently render cyan ('snappable') — i.e. the rotating
 * entity's grip the cursor is RIGHT NOW snapped to (proximity), or null. Reads the
 * live snap result (`ImmediateSnapStore`): cyan appears only while there is an
 * active ROTATION_GRIP snap, so the grips stay warm/cold otherwise and revert the
 * moment the cursor leaves — exactly like hover, but cyan (Giorgio). Returns null
 * with OSNAP off (the pipeline clears the snap result). Zero cyan when not rotating
 * (store empty → no rotation-grip candidates → no such snap).
 */
export function getActiveRotationGripSnapKey(): string | null {
  const snap = getImmediateSnap();
  if (!snap?.found || snap.mode !== ExtendedSnapType.ROTATION_GRIP) return null;
  return getGlobalRotationSnapStore().keyForPoint(snap.point);
}
