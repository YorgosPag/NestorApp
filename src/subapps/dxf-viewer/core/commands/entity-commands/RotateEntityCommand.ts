/**
 * ROTATE ENTITY COMMAND
 *
 * 🏢 ADR-188: Entity Rotation System — Command Pattern
 * Supports undo/redo and command merging for smooth drag rotation.
 *
 * Pattern: Follows MoveEntityCommand structure.
 * Consecutive rotations within 500ms are merged into a single command
 * for smooth undo of drag-to-rotate operations (Autodesk/Figma pattern).
 *
 * @see ADR-188 §6.2 (Entity-specific rotation logic)
 * @see MoveEntityCommand (same ICommand pattern)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { deepClone } from '../../../utils/clone-utils';
import { rotateEntity } from '../../../utils/rotation-math';
import type { Entity } from '../../../types/entities';
// ADR-363 Phase 7.2 — BIM-aware rotate (pivot rotation per kind + atomic
// geometry recompute). Returns null for non-BIM, falls through to the
// generic rotateEntity() path below.
import { calculateBimRotatedGeometry } from '../../../bim/transforms/bim-rotate-geometry';

/**
 * Command for rotating multiple entities around a pivot point.
 * All entities rotate by the same angle (batch operation).
 */
export class RotateEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'RotateEntities';
  readonly type = 'rotate-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  /** ADR-357 Phase 12 — IDs of clones created when `copyMode === true`. */
  private createdEntityIds: string[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly pivot: Point2D,
    private angleDeg: number,
    private readonly sceneManager: ISceneManager,
    /** Mark as dragging for merge purposes */
    private readonly isDragging: boolean = false,
    /**
     * ADR-357 Phase 12 — when `true`, rotate clones of the sources rather than
     * mutating in place (mirrors `ScaleEntityCommand.copyMode`). Used by the
     * grip-context-menu "Copy" toggle when current mode is Rotate.
     */
    private readonly copyMode: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Rotate all entities around pivot by angleDeg. When `copyMode` is
   * on, the rotated geometry is applied to fresh clones (sources untouched).
   */
  execute(): void {
    this.entitySnapshots.clear();
    this.createdEntityIds = [];

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const updates = this.computeRotateUpdates(entity);

      if (this.copyMode) {
        const newId = generateEntityId();
        const clone: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(clone);
        this.createdEntityIds.push(newId);
      } else {
        this.entitySnapshots.set(entityId, deepClone(entity));
        this.sceneManager.updateEntity(entityId, updates);
      }
    }

    this.wasExecuted = this.copyMode
      ? this.createdEntityIds.length > 0
      : this.entitySnapshots.size > 0;
  }

  /**
   * Computes the rotation patch for a single entity. ADR-363 Phase 7.2:
   * tries BIM-aware rotate first (returns `{params, geometry}` atomic patch
   * for the 7 BIM kinds); falls through to the generic `rotateEntity()`
   * path otherwise.
   */
  private computeRotateUpdates(entity: SceneEntity): Partial<SceneEntity> {
    const bimPatch = calculateBimRotatedGeometry(
      entity as unknown as Entity,
      this.pivot,
      this.angleDeg,
    );
    if (bimPatch !== null) return bimPatch;
    const generic = rotateEntity(entity as unknown as Entity, this.pivot, this.angleDeg);
    return generic as Partial<SceneEntity>;
  }

  /**
   * Undo: Restore all entities from snapshots (or remove the created clones
   * when running in copyMode).
   */
  undo(): void {
    if (!this.wasExecuted) return;

    if (this.copyMode) {
      for (const id of this.createdEntityIds) {
        this.sceneManager.removeEntity(id);
      }
      return;
    }

    for (const [entityId, snapshot] of this.entitySnapshots) {
      // Extract geometry fields from snapshot (exclude id, type, layer, visible which are identity fields)
      const { id: _id, type: _type, layer: _layer, visible: _visible, ...geometry } = snapshot;
      this.sceneManager.updateEntity(entityId, geometry);
    }
  }

  /**
   * Redo: Re-apply rotation from snapshots (more accurate than re-executing).
   * In copyMode, re-applies the snapshots as freshly cloned entities so the
   * clone IDs are deterministic across the undo/redo cycle.
   */
  redo(): void {
    if (this.copyMode) {
      this.createdEntityIds = [];
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId)
          ?? (this.sceneManager.getEntity(entityId) as SceneEntity | undefined);
        if (!snapshot) continue;
        // Cache the snapshot for any subsequent undo/redo cycle.
        if (!this.entitySnapshots.has(entityId)) {
          this.entitySnapshots.set(entityId, deepClone(snapshot));
        }
        const updates = this.computeRotateUpdates(snapshot);
        const newId = generateEntityId();
        const clone: SceneEntity = { ...snapshot, ...updates, id: newId };
        this.sceneManager.addEntity(clone);
        this.createdEntityIds.push(newId);
      }
      return;
    }

    for (const entityId of this.entityIds) {
      const snapshot = this.entitySnapshots.get(entityId);
      if (snapshot) {
        const updates = this.computeRotateUpdates(snapshot);
        this.sceneManager.updateEntity(entityId, updates);
      }
    }
  }

  /**
   * Get description for UI / undo history
   */
  getDescription(): string {
    const count = this.entitySnapshots.size || this.entityIds.length;
    const angleStr = this.angleDeg.toFixed(1);
    if (count === 1) {
      const entityType = this.entitySnapshots.values().next().value?.type ?? 'entity';
      return `Rotate ${entityType} by ${angleStr}°`;
    }
    return `Rotate ${count} entities by ${angleStr}°`;
  }

  /**
   * Check if can merge with another rotation command.
   * Merges consecutive rotations of the same entities within time window.
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof RotateEntityCommand)) {
      return false;
    }

    // Must be same set of entities
    if (other.entityIds.length !== this.entityIds.length) {
      return false;
    }

    const thisSet = new Set(this.entityIds);
    for (const id of other.entityIds) {
      if (!thisSet.has(id)) return false;
    }

    // Must be same pivot point (within tolerance)
    if (this.pivot.x !== other.pivot.x || this.pivot.y !== other.pivot.y) {
      return false;
    }

    // Only merge dragging operations
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another rotate command — accumulate angles
   */
  mergeWith(other: ICommand): ICommand {
    const otherRotate = other as RotateEntityCommand;
    const combinedAngle = this.angleDeg + otherRotate.angleDeg;
    return new RotateEntityCommand(
      this.entityIds,
      this.pivot,
      combinedAngle,
      this.sceneManager,
      true
    );
  }

  /**
   * Get entity IDs affected by this command
   */
  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  /**
   * Serialize for persistence
   */
  serialize(): SerializedCommand {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => {
      snapshotsArray.push({ id, entity });
    });

    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        pivot: this.pivot,
        angleDeg: this.angleDeg,
        isDragging: this.isDragging,
        entitySnapshots: snapshotsArray,
      },
      version: 1,
    };
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    if (this.angleDeg === 0) {
      return 'Rotation angle must be non-zero';
    }
    return null;
  }
}
