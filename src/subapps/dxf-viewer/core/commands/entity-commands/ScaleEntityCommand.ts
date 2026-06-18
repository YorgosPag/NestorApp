/**
 * SCALE ENTITY COMMAND — ADR-348
 *
 * Undoable command for scaling DXF entities around a base point.
 * Supports uniform scale (sx=sy), non-uniform scale (sx≠sy),
 * and copy mode (original entities preserved, scaled copies created).
 *
 * CIRCLE → ELLIPSE conversion is handled automatically via
 * scale-entity-transform.ts (SSOT). Undo restores original entity type.
 *
 * @see ADR-348 §Architecture — Command Registration
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { scaleEntity } from '../../../systems/scale/scale-entity-transform';
import type { Entity } from '../../../types/entities';
// ADR-363 §5.4 — recompute hosted openings against scaled walls (in-place mode).
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
// ADR-492 Φ2 — a scaled beam (or scaled column) re-frames the associated beams to the column
// faces, then announces transformed + reframed in ONE `bim:entities-moved`. Command-time, single
// emit, no reactive loop (the freeze lesson). Undo keeps the race-guarded restore-first ordering.
import {
  reframeBeamsAndEmit,
  emitRestoredEntities,
  reframeBeamsAndEmitAfterRestore,
} from '../../../bim/beams/beam-column-reframe-cascade';

export type ScaleParams =
  | { mode: 'uniform'; factor: number }
  | { mode: 'non-uniform'; sx: number; sy: number };

export class ScaleEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'ScaleEntities';
  readonly type = 'scale-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private createdEntityIds: string[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly basePoint: Point2D,
    private readonly params: ScaleParams,
    private readonly copyMode: boolean,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  private getSxSy(): { sx: number; sy: number } {
    if (this.params.mode === 'uniform') {
      return { sx: this.params.factor, sy: this.params.factor };
    }
    return { sx: this.params.sx, sy: this.params.sy };
  }

  execute(): void {
    this.entitySnapshots.clear();
    this.createdEntityIds = [];

    const { sx, sy } = this.getSxSy();

    // ADR-492 Φ2 — in-place scaled entities (snapshot+updates), for the reframe announce.
    const transformed: SceneEntity[] = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;

      const updates = scaleEntity(entity as unknown as Entity, this.basePoint, sx, sy);

      if (this.copyMode) {
        const newId = generateEntityId();
        const newEntity: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(newEntity);
        this.createdEntityIds.push(newId);
      } else {
        this.entitySnapshots.set(entityId, deepClone(entity));
        this.sceneManager.updateEntity(entityId, updates);
        transformed.push({ ...entity, ...updates } as SceneEntity);
      }
    }

    this.wasExecuted = this.copyMode
      ? this.createdEntityIds.length > 0
      : this.entitySnapshots.size > 0;

    // ADR-363 §5.4 — in-place scale: hosted openings follow the scaled wall.
    if (!this.copyMode) {
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 Φ2 — a scaled beam re-snaps its ends to the column faces; transformed +
      // reframed announced in ONE emit (persist + organism + footing-follow).
      reframeBeamsAndEmit(transformed, this.entityIds, this.sceneManager);
    }
  }

  undo(): void {
    if (!this.wasExecuted) return;

    if (this.copyMode) {
      for (const id of this.createdEntityIds) {
        this.sceneManager.removeEntity(id);
      }
    } else {
      // ADR-492 Φ2 — race-guarded restore-first emit (mark dirty before scene mutation: the doc
      // still holds the SCALED geometry). SSoT helper — same ordering as Move/Rotate/Mirror undo.
      emitRestoredEntities([...this.entitySnapshots.values()]);
      for (const [entityId, snapshot] of this.entitySnapshots) {
        const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot;
        this.sceneManager.updateEntity(entityId, geometry);
      }
      // ADR-363 §5.4 — re-derive hosted openings against the restored walls.
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 Φ2 — re-frame beams against the restored geometry; separate emit (restore first).
      reframeBeamsAndEmitAfterRestore(this.entityIds, this.sceneManager);
    }
  }

  redo(): void {
    const { sx, sy } = this.getSxSy();

    if (this.copyMode) {
      this.createdEntityIds = [];
      for (const entityId of this.entityIds) {
        const entity = this.sceneManager.getEntity(entityId);
        if (!entity) continue;
        const updates = scaleEntity(entity as unknown as Entity, this.basePoint, sx, sy);
        const newId = generateEntityId();
        const newEntity: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(newEntity);
        this.createdEntityIds.push(newId);
      }
    } else {
      const transformed: SceneEntity[] = [];
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (!snapshot) continue;
        const updates = scaleEntity(snapshot as unknown as Entity, this.basePoint, sx, sy);
        this.sceneManager.updateEntity(entityId, updates);
        transformed.push({ ...snapshot, ...updates } as SceneEntity);
      }
      // ADR-363 §5.4 — hosted openings follow the re-scaled walls.
      cascadeHostedOpeningsForWalls(this.entityIds, this.sceneManager);
      // ADR-492 Φ2 — reframe beams + announce transformed + reframed in ONE emit (mirror execute).
      reframeBeamsAndEmit(transformed, this.entityIds, this.sceneManager);
    }
  }

  getDescription(): string {
    const count = this.copyMode ? this.createdEntityIds.length : this.entitySnapshots.size || this.entityIds.length;
    const mode = this.copyMode ? 'copy' : 'in-place';
    if (this.params.mode === 'uniform') {
      return `Scale ${count} ${count === 1 ? 'entity' : 'entities'} ×${this.params.factor.toFixed(3)} (${mode})`;
    }
    return `Scale ${count} ${count === 1 ? 'entity' : 'entities'} sx=${this.params.sx.toFixed(3)} sy=${this.params.sy.toFixed(3)} (${mode})`;
  }

  getAffectedEntityIds(): string[] {
    return this.copyMode ? [...this.createdEntityIds] : [...this.entityIds];
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) return 'At least one entity ID is required';
    if (this.params.mode === 'uniform' && this.params.factor === 0) return 'Scale factor cannot be zero';
    if (this.params.mode === 'non-uniform' && (this.params.sx === 0 || this.params.sy === 0)) {
      return 'Scale factors cannot be zero';
    }
    return null;
  }

  serialize(): SerializedCommand {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => { snapshotsArray.push({ id, entity }); });

    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        basePoint: this.basePoint,
        params: this.params,
        copyMode: this.copyMode,
        entitySnapshots: snapshotsArray,
        createdEntityIds: this.createdEntityIds,
      },
      version: 1,
    };
  }
}
