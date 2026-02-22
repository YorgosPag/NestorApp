/**
 * @module systems/guides/guide-commands
 * @description Command pattern for guide operations — undo/redo support
 *
 * Follows the exact pattern of CreateEntityCommand / DeleteEntityCommand
 * but operates on GuideStore instead of ISceneManager.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see core/commands/entity-commands/CreateEntityCommand.ts (template)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type { Guide } from './guide-types';
import type { GuideStore } from './guide-store';
import { generateEntityId } from '../entity-creation/utils';
import { rotatePoint } from '../../utils/rotation-math';

// ============================================================================
// CREATE GUIDE COMMAND
// ============================================================================

/**
 * Command for creating a new construction guide.
 * Supports undo (remove) and redo (re-add).
 */
export class CreateGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateGuide';
  readonly type = 'create-guide';
  readonly timestamp: number;

  private createdGuide: Guide | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly axis: GridAxis,
    private readonly offset: number,
    private readonly label: string | null = null,
    private readonly parentId: string | null = null,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuide) {
      // Re-execute (redo) — restore the exact same guide
      this.store.restoreGuide(this.createdGuide);
    } else {
      // First execution
      this.createdGuide = this.store.addGuideRaw(this.axis, this.offset, this.label, this.parentId) ?? null;
    }
  }

  undo(): void {
    if (this.createdGuide) {
      this.store.removeGuideById(this.createdGuide.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Create ${this.axis} guide at offset ${this.offset}`;
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
        axis: this.axis,
        offset: this.offset,
        label: this.label,
        parentId: this.parentId,
        guideId: this.createdGuide?.id ?? null,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuide ? [this.createdGuide.id] : [];
  }

  /** Get the created guide (after execution) */
  getCreatedGuide(): Guide | null {
    return this.createdGuide;
  }
}

// ============================================================================
// DELETE GUIDE COMMAND
// ============================================================================

/**
 * Command for deleting a construction guide.
 * Stores a snapshot for undo (restore).
 */
export class DeleteGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteGuide';
  readonly type = 'delete-guide';
  readonly timestamp: number;

  private deletedGuide: Guide | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const guide = this.store.removeGuideById(this.guideId);
    if (guide) {
      this.deletedGuide = guide;
    }
  }

  undo(): void {
    if (this.deletedGuide) {
      this.store.restoreGuide(this.deletedGuide);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Delete guide ${this.guideId}`;
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
        deletedGuide: this.deletedGuide,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.guideId];
  }
}

// ============================================================================
// CREATE PARALLEL GUIDE COMMAND
// ============================================================================

/**
 * Command for creating a guide parallel to an existing guide.
 * Reads the reference guide's axis and offset, then creates a new guide
 * at reference.offset + offsetDistance.
 */
export class CreateParallelGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateParallelGuide';
  readonly type = 'create-parallel-guide';
  readonly timestamp: number;

  private createdGuide: Guide | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly referenceGuideId: string,
    private readonly offsetDistance: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuide) {
      // Redo — restore exact guide
      this.store.restoreGuide(this.createdGuide);
      return;
    }

    const reference = this.store.getGuideById(this.referenceGuideId);
    if (!reference) return;

    if (reference.axis === 'XZ' && reference.startPoint && reference.endPoint) {
      // Parallel to diagonal: shift start/end perpendicularly
      const dx = reference.endPoint.x - reference.startPoint.x;
      const dy = reference.endPoint.y - reference.startPoint.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      // Normal vector (perpendicular, unit length)
      const nx = -dy / len;
      const ny = dx / len;
      const shift = this.offsetDistance; // Already signed from step 2
      const newStart = { x: reference.startPoint.x + nx * shift, y: reference.startPoint.y + ny * shift };
      const newEnd = { x: reference.endPoint.x + nx * shift, y: reference.endPoint.y + ny * shift };
      this.createdGuide = this.store.addDiagonalGuideRaw(newStart, newEnd) ?? null;
    } else {
      const newOffset = reference.offset + this.offsetDistance;
      this.createdGuide = this.store.addGuideRaw(
        reference.axis,
        newOffset,
        null,
        this.referenceGuideId,
      ) ?? null;
    }
  }

  undo(): void {
    if (this.createdGuide) {
      this.store.removeGuideById(this.createdGuide.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getCreatedGuide(): Guide | null {
    return this.createdGuide;
  }

  getDescription(): string {
    return `Create parallel guide (offset ${this.offsetDistance} from ${this.referenceGuideId})`;
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
        referenceGuideId: this.referenceGuideId,
        offsetDistance: this.offsetDistance,
        guideId: this.createdGuide?.id ?? null,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuide ? [this.createdGuide.id] : [];
  }
}

// ============================================================================
// CREATE DIAGONAL GUIDE COMMAND
// ============================================================================

/**
 * Command for creating a diagonal (XZ) construction guide.
 * Defined by start and end points. Supports undo (remove) and redo (re-add).
 *
 * @see ADR-189 §3.3 (Οδηγός XZ — 3-click diagonal guide)
 */
export class CreateDiagonalGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateDiagonalGuide';
  readonly type = 'create-diagonal-guide';
  readonly timestamp: number;

  private createdGuide: Guide | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly startPoint: Point2D,
    private readonly endPoint: Point2D,
    private readonly label: string | null = null,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuide) {
      // Re-execute (redo) — restore the exact same guide
      this.store.restoreGuide(this.createdGuide);
    } else {
      // First execution
      this.createdGuide = this.store.addDiagonalGuideRaw(
        this.startPoint, this.endPoint, this.label,
      ) ?? null;
    }
  }

  undo(): void {
    if (this.createdGuide) {
      this.store.removeGuideById(this.createdGuide.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    const sx = this.startPoint.x.toFixed(1);
    const sy = this.startPoint.y.toFixed(1);
    const ex = this.endPoint.x.toFixed(1);
    const ey = this.endPoint.y.toFixed(1);
    return `Create diagonal guide from (${sx}, ${sy}) to (${ex}, ${ey})`;
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
        startPoint: this.startPoint,
        endPoint: this.endPoint,
        label: this.label,
        guideId: this.createdGuide?.id ?? null,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuide ? [this.createdGuide.id] : [];
  }

  /** Get the created guide (after execution) */
  getCreatedGuide(): Guide | null {
    return this.createdGuide;
  }
}

// ============================================================================
// MOVE GUIDE COMMAND
// ============================================================================

/**
 * Command for moving a construction guide to a new position.
 * Supports X/Y (offset change) and XZ (start/end point change).
 * Stores old and new positions for undo/redo.
 *
 * @see ADR-189 B5 (Guide Drag & Drop)
 */
export class MoveGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveGuide';
  readonly type = 'move-guide';
  readonly timestamp: number;

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
    private readonly axis: GridAxis,
    private readonly oldOffset: number,
    private readonly newOffset: number,
    private readonly oldStartPoint: Point2D | undefined,
    private readonly oldEndPoint: Point2D | undefined,
    private readonly newStartPoint: Point2D | undefined,
    private readonly newEndPoint: Point2D | undefined,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.axis === 'XZ' && this.newStartPoint && this.newEndPoint) {
      this.store.moveDiagonalGuideById(this.guideId, this.newStartPoint, this.newEndPoint);
    } else {
      this.store.moveGuideById(this.guideId, this.newOffset);
    }
  }

  undo(): void {
    if (this.axis === 'XZ' && this.oldStartPoint && this.oldEndPoint) {
      this.store.moveDiagonalGuideById(this.guideId, this.oldStartPoint, this.oldEndPoint);
    } else {
      this.store.moveGuideById(this.guideId, this.oldOffset);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    if (this.axis === 'XZ') {
      return `Move diagonal guide ${this.guideId}`;
    }
    return `Move ${this.axis} guide from ${this.oldOffset.toFixed(1)} to ${this.newOffset.toFixed(1)}`;
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
        axis: this.axis,
        oldOffset: this.oldOffset,
        newOffset: this.newOffset,
        oldStartPoint: this.oldStartPoint,
        oldEndPoint: this.oldEndPoint,
        newStartPoint: this.newStartPoint,
        newEndPoint: this.newEndPoint,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.guideId];
  }
}

// ============================================================================
// ROTATE GUIDE COMMAND (B28)
// ============================================================================

/** Half-length extent for converting X/Y (infinite) guides to finite XZ segments */
const ROTATION_EXTENT = 10_000;

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

    // Pre-calculate rotated endpoints at construction time
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

    // Pre-compute rotated endpoints for every eligible guide
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
    // Collect snapshots on first execution only
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
    // Restore in reverse order to maintain consistency
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
// EQUALIZE GUIDES COMMAND (B33)
// ============================================================================

/**
 * Command for equalizing spacing between 3+ same-axis guides.
 *
 * Keeps the first (lowest offset) and last (highest offset) guides in place,
 * then redistributes all intermediate guides with equal spacing.
 *
 * Requirements:
 * - All selected guides must share the same axis (X or Y)
 * - XZ (diagonal) guides are excluded — equalization is offset-based
 * - Minimum 3 guides required
 *
 * @see ADR-189 B33 (Smart Equalize — ισαπόσταση παράλληλων οδηγών)
 */
export class EqualizeGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'EqualizeGuides';
  readonly type = 'equalize-guides';
  readonly timestamp: number;

  /** Original offsets keyed by guide.id (for undo) */
  private readonly originalOffsets: Map<string, number> = new Map();
  /** New equalized offsets keyed by guide.id */
  private readonly newOffsets: Map<string, number> = new Map();
  /** Computed spacing (for event emission) */
  readonly spacing: number;

  constructor(
    private readonly store: GuideStore,
    guideIds: readonly string[],
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.spacing = 0;

    // Collect valid guides (exist + same axis + not XZ)
    const guides: Guide[] = [];
    for (const gid of guideIds) {
      const g = store.getGuideById(gid);
      if (g && g.axis !== 'XZ') guides.push(g);
    }

    if (guides.length < 3) return;

    // Validate: all must be on the same axis
    const firstAxis = guides[0].axis;
    if (!guides.every(g => g.axis === firstAxis)) return;

    // Sort by offset ascending
    const sorted = [...guides].sort((a, b) => a.offset - b.offset);
    const firstOffset = sorted[0].offset;
    const lastOffset = sorted[sorted.length - 1].offset;
    this.spacing = (lastOffset - firstOffset) / (sorted.length - 1);

    // Pre-compute new offsets
    for (let i = 0; i < sorted.length; i++) {
      this.originalOffsets.set(sorted[i].id, sorted[i].offset);
      this.newOffsets.set(sorted[i].id, firstOffset + i * this.spacing);
    }
  }

  /** Whether the command has valid work to do */
  get isValid(): boolean {
    return this.newOffsets.size >= 3;
  }

  execute(): void {
    for (const [guideId, offset] of this.newOffsets) {
      this.store.moveGuideById(guideId, offset);
    }
  }

  undo(): void {
    for (const [guideId, offset] of this.originalOffsets) {
      this.store.moveGuideById(guideId, offset);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Equalize ${this.newOffsets.size} guides (equal spacing)`;
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
        guideCount: this.newOffsets.size,
        originalOffsets: Object.fromEntries(this.originalOffsets),
        newOffsets: Object.fromEntries(this.newOffsets),
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.newOffsets.keys());
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

    // Pre-compute rotated endpoints for selected guides only
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

// ============================================================================
// POLAR ARRAY GUIDES COMMAND (B31)
// ============================================================================

/**
 * Command for creating N guides at equal angular intervals around a center point.
 *
 * Creates radial guides (spokes) through the center point, each as an XZ diagonal
 * guide extending ±10000 units. The angle between consecutive guides is 360°/count.
 *
 * @see ADR-189 B31 (Polar Array — Ν οδηγοί σε ίσες γωνίες γύρω από κέντρο)
 */
export class PolarArrayGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'PolarArrayGuides';
  readonly type = 'polar-array-guides';
  readonly timestamp: number;

  /** Guides created by this command (for undo) */
  private createdGuides: Guide[] = [];

  /** Computed angle increment in degrees */
  readonly angleIncrement: number;

  constructor(
    private readonly store: GuideStore,
    private readonly center: Point2D,
    private readonly count: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.angleIncrement = count > 0 ? 360 / count : 0;
  }

  /** Whether the command has valid work to do */
  get isValid(): boolean {
    return this.count >= 2 && this.angleIncrement > 0;
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      // Redo: restore previously created guides
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const extent = 10_000;

    for (let i = 0; i < this.count; i++) {
      const angleDeg = i * this.angleIncrement;
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * extent;
      const dy = Math.sin(rad) * extent;

      const startPoint: Point2D = {
        x: this.center.x - dx,
        y: this.center.y - dy,
      };
      const endPoint: Point2D = {
        x: this.center.x + dx,
        y: this.center.y + dy,
      };

      const guide = this.store.addDiagonalGuideRaw(startPoint, endPoint);
      if (guide) {
        this.createdGuides.push(guide);
      }
    }
  }

  undo(): void {
    for (const guide of this.createdGuides) {
      this.store.removeGuideById(guide.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Polar array: ${this.count} guides at ${this.angleIncrement.toFixed(1)}° intervals`;
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
        center: this.center,
        count: this.count,
        angleIncrement: this.angleIncrement,
        createdGuideIds: this.createdGuides.map(g => g.id),
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
  }
}

// ============================================================================
// SCALE ALL GUIDES COMMAND (B32)
// ============================================================================

/**
 * Command for scaling ALL visible, unlocked guides from an origin point.
 *
 * X/Y guides: newOffset = origin + (offset - origin) * scaleFactor
 * XZ guides: newStart/End = origin + (point - origin) * scaleFactor
 *
 * Unlike rotation (B28-B30), scaling preserves axis type — X stays X, Y stays Y.
 * Only offsets/positions change, not the axis direction.
 *
 * @see ADR-189 B32 (Κλιμάκωση κάνναβου — Scale)
 */
export class ScaleAllGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'ScaleAllGuides';
  readonly type = 'scale-all-guides';
  readonly timestamp: number;

  /** Original guide snapshots for undo */
  private readonly originalSnapshots: Guide[] = [];
  /** Pre-computed scaled values per guide: X/Y = new offset, XZ = new endpoints */
  private readonly scaledValues: Map<string, { offset?: number; start?: Point2D; end?: Point2D }> = new Map();

  constructor(
    private readonly store: GuideStore,
    private readonly origin: Point2D,
    private readonly scaleFactor: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    const guides = store.getGuides();
    for (const guide of guides) {
      if (!guide.visible || guide.locked) continue;

      if (guide.axis === 'X') {
        this.scaledValues.set(guide.id, {
          offset: this.origin.x + (guide.offset - this.origin.x) * scaleFactor,
        });
      } else if (guide.axis === 'Y') {
        this.scaledValues.set(guide.id, {
          offset: this.origin.y + (guide.offset - this.origin.y) * scaleFactor,
        });
      } else if (guide.startPoint && guide.endPoint) {
        this.scaledValues.set(guide.id, {
          start: {
            x: this.origin.x + (guide.startPoint.x - this.origin.x) * scaleFactor,
            y: this.origin.y + (guide.startPoint.y - this.origin.y) * scaleFactor,
          },
          end: {
            x: this.origin.x + (guide.endPoint.x - this.origin.x) * scaleFactor,
            y: this.origin.y + (guide.endPoint.y - this.origin.y) * scaleFactor,
          },
        });
      }
    }
  }

  /** Whether the command has valid work to do */
  get isValid(): boolean {
    return this.scaledValues.size > 0 && this.scaleFactor !== 1;
  }

  execute(): void {
    const isFirstExecution = this.originalSnapshots.length === 0;

    for (const [guideId, values] of this.scaledValues) {
      const guide = this.store.getGuideById(guideId);
      if (!guide) continue;

      if (isFirstExecution) {
        this.originalSnapshots.push({ ...guide });
      }

      if (values.offset !== undefined) {
        this.store.moveGuideById(guideId, values.offset);
      } else if (values.start && values.end) {
        this.store.moveDiagonalGuideById(guideId, values.start, values.end);
      }
    }
  }

  undo(): void {
    for (let i = this.originalSnapshots.length - 1; i >= 0; i--) {
      const snap = this.originalSnapshots[i];
      if (snap.axis === 'XZ' && snap.startPoint && snap.endPoint) {
        this.store.moveDiagonalGuideById(snap.id, snap.startPoint, snap.endPoint);
      } else {
        this.store.moveGuideById(snap.id, snap.offset);
      }
    }
  }

  redo(): void {
    for (const [guideId, values] of this.scaledValues) {
      if (values.offset !== undefined) {
        this.store.moveGuideById(guideId, values.offset);
      } else if (values.start && values.end) {
        this.store.moveDiagonalGuideById(guideId, values.start, values.end);
      }
    }
  }

  getDescription(): string {
    return `Scale all guides (${this.scaledValues.size}) by ${this.scaleFactor}× from (${this.origin.x.toFixed(1)}, ${this.origin.y.toFixed(1)})`;
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
        origin: this.origin,
        scaleFactor: this.scaleFactor,
        guideCount: this.scaledValues.size,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.scaledValues.keys());
  }
}
