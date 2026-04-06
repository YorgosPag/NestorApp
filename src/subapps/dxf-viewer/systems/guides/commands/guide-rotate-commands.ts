/**
 * @module systems/guides/commands/guide-rotate-commands
 * @description Commands for rotating construction guides — single, group, all
 *
 * @see ADR-189 B28 (Rotate single), B29 (Rotate group), B30 (Rotate all)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { generateEntityId } from '../../entity-creation/utils';
import { rotatePoint } from '../../../utils/rotation-math';

/** Half-length extent for converting X/Y (infinite) guides to finite XZ segments */
const ROTATION_EXTENT = 10_000;

// ============================================================================
// ROTATE GUIDE COMMAND (B28)
// ============================================================================

/**
 * Command for rotating a construction guide around a pivot point.
 *
 * For X/Y guides: Converts to XZ (diagonal) with computed startPoint/endPoint.
 * For XZ guides: Rotates existing startPoint and endPoint.
 *
 * Stores full original guide snapshot for perfect undo — restoring
 * the original axis, offset, and endpoint state.
 *
 * @see ADR-189 B28 (Περιστροφή μεμονωμένου οδηγού)
 * @see rotation-math.ts (rotatePoint — Translate-Rotate-Translate method)
 */
export class RotateGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'RotateGuide';
  readonly type = 'rotate-guide';
  readonly timestamp: number;

  private originalSnapshot: Guide | null = null;
  private readonly newStart: Point2D;
  private readonly newEnd: Point2D;

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
    private readonly pivot: Point2D,
    private readonly angleDeg: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    const guide = store.getGuideById(guideId);
    if (guide) {
      const endpoints = RotateGuideCommand.computeRotatedEndpoints(guide, pivot, angleDeg);
      this.newStart = endpoints.start;
      this.newEnd = endpoints.end;
    } else {
      this.newStart = { x: 0, y: 0 };
      this.newEnd = { x: 0, y: 0 };
    }
  }

  /**
   * Convert guide to finite segment (if X/Y) then rotate both endpoints.
   *
   * For X (vertical, offset=v): segment from (v, pivot.y - EXTENT) to (v, pivot.y + EXTENT)
   * For Y (horizontal, offset=h): segment from (pivot.x - EXTENT, h) to (pivot.x + EXTENT, h)
   * For XZ: use existing startPoint/endPoint
   */
  private static computeRotatedEndpoints(
    guide: Guide,
    pivot: Point2D,
    angleDeg: number,
  ): { start: Point2D; end: Point2D } {
    let originalStart: Point2D;
    let originalEnd: Point2D;

    if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
      originalStart = guide.startPoint;
      originalEnd = guide.endPoint;
    } else if (guide.axis === 'X') {
      originalStart = { x: guide.offset, y: pivot.y - ROTATION_EXTENT };
      originalEnd = { x: guide.offset, y: pivot.y + ROTATION_EXTENT };
    } else {
      originalStart = { x: pivot.x - ROTATION_EXTENT, y: guide.offset };
      originalEnd = { x: pivot.x + ROTATION_EXTENT, y: guide.offset };
    }

    return {
      start: rotatePoint(originalStart, pivot, angleDeg),
      end: rotatePoint(originalEnd, pivot, angleDeg),
    };
  }

  execute(): void {
    const snapshot = this.store.replaceGuideWithRotated(
      this.guideId,
      this.newStart,
      this.newEnd,
    );
    if (snapshot && !this.originalSnapshot) {
      this.originalSnapshot = snapshot;
    }
  }

  undo(): void {
    if (this.originalSnapshot) {
      this.store.restoreGuideSnapshot(this.originalSnapshot);
    }
  }

  redo(): void {
    this.store.replaceGuideWithRotated(
      this.guideId,
      this.newStart,
      this.newEnd,
    );
  }

  getDescription(): string {
    return `Rotate guide ${this.guideId} by ${this.angleDeg}° around (${this.pivot.x.toFixed(1)}, ${this.pivot.y.toFixed(1)})`;
  }

  canMergeWith(): boolean {
    return false;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        guideId: this.guideId,
        pivot: this.pivot,
        angleDeg: this.angleDeg,
        newStart: this.newStart,
        newEnd: this.newEnd,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.guideId];
  }
}

// ============================================================================
// ROTATE ALL GUIDES COMMAND (B30)
// ============================================================================

/**
 * Command for rotating ALL visible, unlocked guides around a pivot point.
 *
 * Applies RotateGuideCommand logic to every eligible guide atomically.
 * Stores full snapshots of all affected guides for perfect undo — each
 * guide is restored to its original axis, offset, and endpoint state.
 *
 * @see ADR-189 B30 (Περιστροφή ολόκληρου κάνναβου)
 * @see RotateGuideCommand (B28) — same geometry reused per guide
 */
export class RotateAllGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'RotateAllGuides';
  readonly type = 'rotate-all-guides';
  readonly timestamp: number;

  /** Original snapshots for undo (keyed by guide.id) */
  private originalSnapshots: Guide[] = [];
  /** Pre-computed new endpoints per guide id */
  private rotatedEndpoints: Map<string, { start: Point2D; end: Point2D }> = new Map();

  constructor(
    private readonly store: GuideStore,
    private readonly pivot: Point2D,
    private readonly angleDeg: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    const guides = store.getGuides();
    for (const guide of guides) {
      if (!guide.visible || guide.locked) continue;

      let originalStart: Point2D;
      let originalEnd: Point2D;

      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        originalStart = guide.startPoint;
        originalEnd = guide.endPoint;
      } else if (guide.axis === 'X') {
        originalStart = { x: guide.offset, y: pivot.y - ROTATION_EXTENT };
        originalEnd = { x: guide.offset, y: pivot.y + ROTATION_EXTENT };
      } else {
        originalStart = { x: pivot.x - ROTATION_EXTENT, y: guide.offset };
        originalEnd = { x: pivot.x + ROTATION_EXTENT, y: guide.offset };
      }

      this.rotatedEndpoints.set(guide.id, {
        start: rotatePoint(originalStart, pivot, angleDeg),
        end: rotatePoint(originalEnd, pivot, angleDeg),
      });
    }
  }

  execute(): void {
    const isFirstExecution = this.originalSnapshots.length === 0;

    for (const [guideId, endpoints] of this.rotatedEndpoints) {
      const snapshot = this.store.replaceGuideWithRotated(
        guideId,
        endpoints.start,
        endpoints.end,
      );
      if (snapshot && isFirstExecution) {
        this.originalSnapshots.push(snapshot);
      }
    }
  }

  undo(): void {
    for (let i = this.originalSnapshots.length - 1; i >= 0; i--) {
      this.store.restoreGuideSnapshot(this.originalSnapshots[i]);
    }
  }

  redo(): void {
    for (const [guideId, endpoints] of this.rotatedEndpoints) {
      this.store.replaceGuideWithRotated(guideId, endpoints.start, endpoints.end);
    }
  }

  getDescription(): string {
    return `Rotate all guides (${this.rotatedEndpoints.size}) by ${this.angleDeg}° around (${this.pivot.x.toFixed(1)}, ${this.pivot.y.toFixed(1)})`;
  }

  canMergeWith(): boolean {
    return false;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        pivot: this.pivot,
        angleDeg: this.angleDeg,
        guideCount: this.rotatedEndpoints.size,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.rotatedEndpoints.keys());
  }
}

// ============================================================================
// ROTATE GUIDE GROUP COMMAND (B29)
// ============================================================================

/**
 * Command for rotating a SELECTED GROUP of guides around a pivot point.
 *
 * Same geometry as RotateAllGuidesCommand but only operates on explicitly
 * provided guide IDs. Stores full snapshots for batch undo.
 *
 * @see ADR-189 B29 (Περιστροφή ομάδας οδηγών)
 * @see RotateAllGuidesCommand (B30) — same pattern, broader scope
 */
export class RotateGuideGroupCommand implements ICommand {
  readonly id: string;
  readonly name = 'RotateGuideGroup';
  readonly type = 'rotate-guide-group';
  readonly timestamp: number;

  private originalSnapshots: Guide[] = [];
  private rotatedEndpoints: Map<string, { start: Point2D; end: Point2D }> = new Map();

  constructor(
    private readonly store: GuideStore,
    private readonly guideIds: readonly string[],
    private readonly pivot: Point2D,
    private readonly angleDeg: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    for (const guideId of guideIds) {
      const guide = store.getGuideById(guideId);
      if (!guide) continue;

      let originalStart: Point2D;
      let originalEnd: Point2D;

      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        originalStart = guide.startPoint;
        originalEnd = guide.endPoint;
      } else if (guide.axis === 'X') {
        originalStart = { x: guide.offset, y: pivot.y - ROTATION_EXTENT };
        originalEnd = { x: guide.offset, y: pivot.y + ROTATION_EXTENT };
      } else {
        originalStart = { x: pivot.x - ROTATION_EXTENT, y: guide.offset };
        originalEnd = { x: pivot.x + ROTATION_EXTENT, y: guide.offset };
      }

      this.rotatedEndpoints.set(guideId, {
        start: rotatePoint(originalStart, pivot, angleDeg),
        end: rotatePoint(originalEnd, pivot, angleDeg),
      });
    }
  }

  execute(): void {
    const isFirstExecution = this.originalSnapshots.length === 0;

    for (const [guideId, endpoints] of this.rotatedEndpoints) {
      const snapshot = this.store.replaceGuideWithRotated(
        guideId,
        endpoints.start,
        endpoints.end,
      );
      if (snapshot && isFirstExecution) {
        this.originalSnapshots.push(snapshot);
      }
    }
  }

  undo(): void {
    for (let i = this.originalSnapshots.length - 1; i >= 0; i--) {
      this.store.restoreGuideSnapshot(this.originalSnapshots[i]);
    }
  }

  redo(): void {
    for (const [guideId, endpoints] of this.rotatedEndpoints) {
      this.store.replaceGuideWithRotated(guideId, endpoints.start, endpoints.end);
    }
  }

  getDescription(): string {
    return `Rotate ${this.rotatedEndpoints.size} guides by ${this.angleDeg}° around (${this.pivot.x.toFixed(1)}, ${this.pivot.y.toFixed(1)})`;
  }

  canMergeWith(): boolean {
    return false;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        guideIds: this.guideIds,
        pivot: this.pivot,
        angleDeg: this.angleDeg,
        guideCount: this.rotatedEndpoints.size,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.rotatedEndpoints.keys());
  }
}
