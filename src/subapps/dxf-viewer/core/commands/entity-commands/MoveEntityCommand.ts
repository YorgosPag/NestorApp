/**
 * MOVE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for moving entities by delta
 * Supports command merging for smooth drag operations.
 *
 * Pattern: Consecutive moves within 500ms are merged into single command
 * This provides smooth undo for drag operations (Autodesk/Figma pattern)
 *
 * Entity Types Supported:
 * - Line: start += delta, end += delta
 * - Circle: center += delta
 * - Rectangle: corner1 += delta, corner2 += delta
 * - Polyline/Polygon: vertices.forEach(v => v += delta)
 * - Arc: center += delta
 * - Ellipse: center += delta
 * - Text: position += delta
 * - Point: position += delta
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { deepClone } from '../../../utils/clone-utils';
// 🏢 ADR-065: Extracted geometry utilities
import { calculateMovedGeometry, reverseDelta } from './move-entity-geometry';
import { EventBus } from '../../../systems/events/EventBus';
// ADR-363 §5.4 — when a moved entity is a wall, recompute its hosted openings
// against the moved wall so they follow (same offsetFromStart).
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
// ADR-492 — when a moved entity is a column, re-frame the beams that frame into it so
// their endpoints follow to the new column faces (mirror of the openings cascade).
import { cascadeBeamReframeForColumns } from '../../../bim/beams/beam-column-reframe-cascade';

/**
 * Command for moving a single entity by delta
 */
export class MoveEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveEntity';
  readonly type = 'move-entity';
  readonly timestamp: number;

  private entitySnapshot: SceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly delta: Point2D,
    private readonly sceneManager: ISceneManager,
    /** Optional: Mark as dragging for merge purposes */
    private readonly isDragging: boolean = false
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move entity by delta
   */
  execute(): void {
    const entity = this.sceneManager.getEntity(this.entityId);
    if (entity) {
      // Store snapshot before move (for undo)
      this.entitySnapshot = deepClone(entity);

      // Calculate new geometry
      const updates = calculateMovedGeometry(entity, this.delta);

      // Apply updates
      this.sceneManager.updateEntity(this.entityId, updates);
      cascadeHostedOpeningsForWalls([this.entityId], this.sceneManager);
      // ADR-492 — re-frame beams that frame into a moved column (no-op for non-columns).
      const reframedBeams = cascadeBeamReframeForColumns([this.entityId], this.sceneManager);
      this.wasExecuted = true;
      // Symmetry with MoveMultipleEntitiesCommand: emit so BIM persistence hooks
      // (useBimEntityMovedPersistEffect — fixture/panel/wall/…) save the new
      // position to Firestore. Without this a single-entity 3D gizmo move was
      // applied to the scene but never persisted (reverted on refresh). Built
      // from snapshot+updates (no getLevelScene — stale at synchronous emit time).
      // ADR-492 — reframed beams ride along in the SAME emit (persist + organism see
      // the corrected geometry in one pass; no second event → no reactive loop).
      const movedEntity = { ...this.entitySnapshot, ...updates } as SceneEntity;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      EventBus.emit('bim:entities-moved', { movedEntities: [movedEntity, ...reframedBeams] as any });
    }
  }

  /**
   * Undo: Move entity by reverse delta
   */
  undo(): void {
    if (this.wasExecuted && this.entitySnapshot) {
      const entity = this.sceneManager.getEntity(this.entityId);
      if (entity) {
        const reversedUpdates = calculateMovedGeometry(entity, reverseDelta(this.delta));
        // Emit FIRST so the persistence hook marks the entity dirty BEFORE the
        // scene is updated. This closes the race window where a Firebase ca9-reset
        // snapshot could arrive between updateEntity and the emit (dirty still
        // false) and overwrite the reverted scene with stale moved data.
        const revertedEntity = { ...this.entitySnapshot } as SceneEntity;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        EventBus.emit('bim:entities-moved', { movedEntities: [revertedEntity] as any });
        this.sceneManager.updateEntity(this.entityId, reversedUpdates);
        cascadeHostedOpeningsForWalls([this.entityId], this.sceneManager);
        // ADR-492 — re-frame beams against the reverted column, then persist them in a
        // separate emit (the column's race-guarded emit must stay first).
        const reframedBeams = cascadeBeamReframeForColumns([this.entityId], this.sceneManager);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (reframedBeams.length > 0) EventBus.emit('bim:entities-moved', { movedEntities: reframedBeams as any });
      }
    }
  }

  /**
   * Redo: Move entity by delta again
   */
  redo(): void {
    this.execute();
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    const entityType = this.entitySnapshot?.type ?? 'entity';
    return `Move ${entityType} by (${this.delta.x.toFixed(1)}, ${this.delta.y.toFixed(1)})`;
  }

  /**
   * Check if can merge with another command
   * Merges consecutive moves of the same entity within time window
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveEntityCommand)) {
      return false;
    }

    // Must be same entity
    if (other.entityId !== this.entityId) {
      return false;
    }

    // Only merge if both are dragging operations
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Combines deltas for a single undo operation
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveEntityCommand;
    const combinedDelta: Point2D = {
      x: this.delta.x + otherMove.delta.x,
      y: this.delta.y + otherMove.delta.y,
    };
    return new MoveEntityCommand(
      this.entityId,
      combinedDelta,
      this.sceneManager,
      true // Keep dragging flag
    );
  }

  /**
   * Get the entity ID
   */
  getEntityId(): string {
    return this.entityId;
  }

  /**
   * Get the movement delta
   */
  getDelta(): Point2D {
    return { ...this.delta };
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        delta: this.delta,
        isDragging: this.isDragging,
        entitySnapshot: this.entitySnapshot,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityId) {
      return 'Entity ID is required';
    }
    if (this.delta.x === 0 && this.delta.y === 0) {
      return 'Delta must be non-zero';
    }
    return null;
  }
}

/**
 * Command for moving multiple entities at once
 * All entities move by the same delta (batch operation)
 */
export class MoveMultipleEntitiesCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveMultipleEntities';
  readonly type = 'move-multiple-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly delta: Point2D,
    private readonly sceneManager: ISceneManager,
    /** Optional: Mark as dragging for merge purposes */
    private readonly isDragging: boolean = false
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move all entities by delta — single batch commit, O(n_scene) not N×O(n_scene).
   */
  execute(): void {
    this.entitySnapshots.clear();
    const updatesMap = new Map<string, Partial<SceneEntity>>();

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        this.entitySnapshots.set(entityId, deepClone(entity));
        updatesMap.set(entityId, calculateMovedGeometry(entity, this.delta));
      }
    }

    if (updatesMap.size > 0) {
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 — re-frame beams that frame into any moved column (no-op if none).
      const reframedBeams = cascadeBeamReframeForColumns(this.entityIds, this.sceneManager);
      this.wasExecuted = true;
      // Build post-move entities from snapshots+updates (safe: no getLevelScene call,
      // which would return stale React state at synchronous emit time).
      const movedEntities: SceneEntity[] = [];
      for (const [entityId, updates] of updatesMap) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (snapshot) movedEntities.push({ ...snapshot, ...updates } as SceneEntity);
      }
      // ADR-492 — reframed beams ride along in the SAME emit (one pass, no reactive loop).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      EventBus.emit('bim:entities-moved', { movedEntities: [...movedEntities, ...reframedBeams] as any });
    }
  }

  /**
   * Undo: Move all entities by reverse delta — single batch commit.
   */
  undo(): void {
    if (!this.wasExecuted) return;
    const updatesMap = new Map<string, Partial<SceneEntity>>();

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        updatesMap.set(entityId, calculateMovedGeometry(entity, reverseDelta(this.delta)));
      }
    }

    if (updatesMap.size > 0) {
      // Build reverted entities from snapshots before touching the scene so the
      // emit below can fire first. Snapshots carry the original (pre-move) params —
      // correct for Firestore persistence regardless of scene state at emit time.
      const revertedEntities: SceneEntity[] = [];
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (snapshot) revertedEntities.push(snapshot);
      }
      // Emit FIRST — marks dirty in all persistence hooks before any scene
      // mutation. Closes the race where a Firebase ca9-reset Firestore snapshot
      // (dirty=false) could overwrite the reverted scene with stale moved data.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      EventBus.emit('bim:entities-moved', { movedEntities: revertedEntities as any });
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 — re-frame beams against the reverted columns; persist in a separate
      // emit (the race-guarded revert emit must stay first).
      const reframedBeams = cascadeBeamReframeForColumns(this.entityIds, this.sceneManager);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (reframedBeams.length > 0) EventBus.emit('bim:entities-moved', { movedEntities: reframedBeams as any });
    }
  }

  /**
   * Redo: Move all entities by delta again — single batch commit.
   */
  redo(): void {
    const updatesMap = new Map<string, Partial<SceneEntity>>();
    const movedEntities: SceneEntity[] = [];

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        const updates = calculateMovedGeometry(entity, this.delta);
        updatesMap.set(entityId, updates);
        movedEntities.push({ ...entity, ...updates } as SceneEntity);
      }
    }

    if (updatesMap.size > 0) {
      this.sceneManager.updateEntities(updatesMap);
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 — re-frame beams that frame into any moved column (no-op if none).
      const reframedBeams = cascadeBeamReframeForColumns(this.entityIds, this.sceneManager);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      EventBus.emit('bim:entities-moved', { movedEntities: [...movedEntities, ...reframedBeams] as any });
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Move ${this.entitySnapshots.size} entities by (${this.delta.x.toFixed(1)}, ${this.delta.y.toFixed(1)})`;
  }

  /**
   * Check if can merge with another command
   * Merges consecutive moves of the same entities within time window
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveMultipleEntitiesCommand)) {
      return false;
    }

    // Must be same set of entities
    if (other.entityIds.length !== this.entityIds.length) {
      return false;
    }

    const thisSet = new Set(this.entityIds);
    const otherSet = new Set(other.entityIds);

    for (const id of thisSet) {
      if (!otherSet.has(id)) {
        return false;
      }
    }

    // Only merge if both are dragging operations
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Combines deltas for a single undo operation
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveMultipleEntitiesCommand;
    const combinedDelta: Point2D = {
      x: this.delta.x + otherMove.delta.x,
      y: this.delta.y + otherMove.delta.y,
    };
    return new MoveMultipleEntitiesCommand(
      this.entityIds,
      combinedDelta,
      this.sceneManager,
      true // Keep dragging flag
    );
  }

  /**
   * Get the entity IDs
   */
  getEntityIds(): string[] {
    return [...this.entityIds];
  }

  /**
   * Get the movement delta
   */
  getDelta(): Point2D {
    return { ...this.delta };
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
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
        delta: this.delta,
        isDragging: this.isDragging,
        entitySnapshots: snapshotsArray,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    if (this.delta.x === 0 && this.delta.y === 0) {
      return 'Delta must be non-zero';
    }
    return null;
  }
}
