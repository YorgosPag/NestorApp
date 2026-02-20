/**
 * @module systems/guides/construction-point-commands
 * @description Command pattern for construction point operations — undo/redo support
 *
 * Three command types:
 * - AddConstructionPointCommand: single point (Add Point tool)
 * - AddConstructionPointBatchCommand: batch of points (Segments/Distance tools)
 * - DeleteConstructionPointCommand: remove a single point (Delete Point tool)
 *
 * @see ADR-189 §3.7, §3.8, §3.15, §3.16
 * @see guide-commands.ts (template pattern)
 * @since 2026-02-20
 */

import type { ICommand, SerializedCommand } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { ConstructionPoint } from './guide-types';
import type { ConstructionPointStore } from './construction-point-store';
import { generateEntityId } from '../entity-creation/utils';

// ============================================================================
// ADD SINGLE CONSTRUCTION POINT COMMAND
// ============================================================================

/**
 * Command for adding a single construction snap point.
 * Used by the "Προσθήκη Σημείου" (Add Point) tool.
 */
export class AddConstructionPointCommand implements ICommand {
  readonly id: string;
  readonly name = 'AddConstructionPoint';
  readonly type = 'add-construction-point';
  readonly timestamp: number;

  private createdPoint: ConstructionPoint | null = null;

  constructor(
    private readonly store: ConstructionPointStore,
    private readonly point: Point2D,
    private readonly label: string | null = null,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdPoint) {
      // Redo — restore the exact same point
      this.store.restorePoint(this.createdPoint);
    } else {
      // First execution
      this.createdPoint = this.store.addPoint(this.point, this.label) ?? null;
    }
  }

  undo(): void {
    if (this.createdPoint) {
      this.store.removePointById(this.createdPoint.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Add construction point at (${this.point.x.toFixed(1)}, ${this.point.y.toFixed(1)})`;
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
        point: this.point,
        label: this.label,
        pointId: this.createdPoint?.id ?? null,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdPoint ? [this.createdPoint.id] : [];
  }
}

// ============================================================================
// ADD BATCH CONSTRUCTION POINTS COMMAND
// ============================================================================

/**
 * Command for adding a batch of construction snap points.
 * Used by "Σε Τμήματα" (Segments) and "Ανά Απόσταση" (Distance) tools.
 * Undo removes ALL points in the batch (by groupId).
 */
export class AddConstructionPointBatchCommand implements ICommand {
  readonly id: string;
  readonly name = 'AddConstructionPointBatch';
  readonly type = 'add-construction-point-batch';
  readonly timestamp: number;

  private groupId: string;
  private addedCount = 0;
  private savedPoints: readonly ConstructionPoint[] = [];

  constructor(
    private readonly store: ConstructionPointStore,
    private readonly pointDefs: ReadonlyArray<{ point: Point2D; label?: string }>,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.groupId = `grp_${generateEntityId()}`;
  }

  execute(): void {
    if (this.savedPoints.length > 0) {
      // Redo — restore exact points
      this.store.restorePointsBatch(this.savedPoints);
      this.addedCount = this.savedPoints.length;
    } else {
      // First execution
      this.addedCount = this.store.addPointsBatch(this.pointDefs, this.groupId);
      // Save points for redo
      this.savedPoints = this.store.getPointsByGroupId(this.groupId);
    }
  }

  undo(): void {
    this.store.removePointsByGroupId(this.groupId);
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Add ${this.addedCount} construction points (batch)`;
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
        pointDefs: this.pointDefs,
        groupId: this.groupId,
        addedCount: this.addedCount,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.savedPoints.map(p => p.id);
  }
}

// ============================================================================
// DELETE CONSTRUCTION POINT COMMAND
// ============================================================================

/**
 * Command for deleting a single construction snap point.
 * Stores a snapshot for undo (restore).
 */
export class DeleteConstructionPointCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteConstructionPoint';
  readonly type = 'delete-construction-point';
  readonly timestamp: number;

  private deletedPoint: ConstructionPoint | null = null;

  constructor(
    private readonly store: ConstructionPointStore,
    private readonly pointId: string,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const point = this.store.removePointById(this.pointId);
    if (point) {
      this.deletedPoint = point;
    }
  }

  undo(): void {
    if (this.deletedPoint) {
      this.store.restorePoint(this.deletedPoint);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Delete construction point ${this.pointId}`;
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
        pointId: this.pointId,
        deletedPoint: this.deletedPoint,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.pointId];
  }
}
