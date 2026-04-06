/**
 * @module systems/guides/commands/guide-create-commands
 * @description Commands for creating construction guides — single, parallel, diagonal, grid preset
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { GridAxis } from '../../../ai-assistant/grid-types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { generateEntityId } from '../../entity-creation/utils';

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
      this.store.restoreGuide(this.createdGuide);
    } else {
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
// CREATE GRID FROM PRESET COMMAND (ADR-189 B23)
// ============================================================================

/**
 * Creates a structural grid from a preset or custom spacings.
 * Creates a GuideGroup and adds X + Y guides at specified offsets.
 */
export class CreateGridFromPresetCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateGridFromPreset';
  readonly type = 'create-grid-from-preset';
  readonly timestamp: number;
  private createdGuides: Guide[] = [];
  private createdGroupId: string | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly xOffsets: readonly number[],
    private readonly yOffsets: readonly number[],
    private readonly xLabels: readonly string[] | null = null,
    private readonly yLabels: readonly string[] | null = null,
    private readonly groupName: string = 'Structural Grid',
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      if (this.createdGroupId) {
        this.store.restoreGroup({ id: this.createdGroupId, name: this.groupName, color: '#6366F1', locked: false, visible: true });
      }
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const group = this.store.addGroup(this.groupName);
    this.createdGroupId = group.id;

    for (let i = 0; i < this.xOffsets.length; i++) {
      const label = this.xLabels?.[i] ?? null;
      const guide = this.store.addGuideRaw('X', this.xOffsets[i], label, null, group.id);
      if (guide) this.createdGuides.push(guide);
    }

    for (let i = 0; i < this.yOffsets.length; i++) {
      const label = this.yLabels?.[i] ?? null;
      const guide = this.store.addGuideRaw('Y', this.yOffsets[i], label, null, group.id);
      if (guide) this.createdGuides.push(guide);
    }
  }

  undo(): void {
    for (const guide of this.createdGuides) {
      this.store.removeGuideById(guide.id);
    }
    if (this.createdGroupId) {
      this.store.removeGroup(this.createdGroupId);
    }
  }

  redo(): void { this.execute(); }

  getDescription(): string {
    return `Structural grid: ${this.xOffsets.length}x${this.yOffsets.length} (${this.groupName})`;
  }

  canMergeWith(): boolean { return false; }

  serialize(): SerializedCommand {
    return {
      type: this.type, id: this.id, name: this.name, timestamp: this.timestamp,
      data: {
        xOffsets: [...this.xOffsets],
        yOffsets: [...this.yOffsets],
        groupName: this.groupName,
        createdCount: this.createdGuides.length,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
  }
}
