/**
 * @module bim/grips/rotation-snap-store
 * @description SSoT for the snap targets that are active DURING a BIM rotation
 * operation (ADR-397): the rotation pivot ⊙ and the rotating entity's grips.
 *
 * Imperative module-singleton (mirrors `systems/guides/construction-point-store`,
 * zero React). Populated when the rotation centre is picked, cleared when the
 * rotation flow resets. Two consumers:
 *  - `RotationSnapEngine` reads pivot + grips → snap candidates (cursor magnetism).
 *  - `BaseEntityRenderer.renderGrips` reads `snappableKeys()` → those grips render
 *    cyan ('snappable') via the grip-temperature SSoT.
 *
 * @see ADR-397 §15 — grip glyph / temperature / snap-target SSoT
 * @since 2026-06-11
 */

import type { Point2D } from '../../rendering/types/Types';
import { gripKey } from '../../rendering/grips/grip-temperature';

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
  private keySet: ReadonlySet<string> = new Set<string>();
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
    this.keySet = new Set(this.grips.map((g) => g.key));
    this.notify();
  }

  /** Disarm — no rotation in progress. Idempotent (no-op when already empty). */
  clear(): void {
    if (!this.pivot && this.grips.length === 0) return;
    this.pivot = null;
    this.grips = [];
    this.keySet = new Set<string>();
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

  /** The set of grip keys that should render cyan ('snappable'). */
  snappableKeys(): ReadonlySet<string> {
    return this.keySet;
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
