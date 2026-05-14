/**
 * STRETCH ENTITY COMMAND — ADR-349
 *
 * Undoable command applying a displacement vector to:
 *   - per-vertex captures (LINE / POLYLINE / SPLINE / ARC endpoints)
 *   - whole-entity anchor captures (CIRCLE / ELLIPSE / TEXT / INSERT / POINT)
 *
 * Single undo step reverses the entire stretch (Q11: 1 audit entry / command,
 * audit hook to be wired in Phase 1d).
 *
 * @see ADR-349 §Command Registration
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import {
  applyVertexDisplacement,
  translateEntityByAnchor,
  type WorldVector,
} from '../../../systems/stretch/stretch-entity-transform';
import type { VertexRef } from '../../../systems/stretch/stretch-vertex-classifier';
import type { Entity } from '../../../types/entities';

export interface StretchVertexMove {
  readonly entityId: string;
  readonly refs: ReadonlyArray<VertexRef>;
}

export interface StretchParams {
  readonly vertexMoves: ReadonlyArray<StretchVertexMove>;
  readonly anchorMoves: ReadonlyArray<string>;
  readonly displacement: WorldVector;
}

export class StretchEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'StretchEntities';
  readonly type = 'stretch-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private wasExecuted = false;

  constructor(
    private readonly params: StretchParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.entitySnapshots.clear();
    const { vertexMoves, anchorMoves, displacement } = this.params;

    for (const move of vertexMoves) {
      const entity = this.sceneManager.getEntity(move.entityId);
      if (!entity) continue;
      const updates = applyVertexDisplacement(entity as unknown as Entity, move.refs, displacement);
      if (!hasUpdates(updates)) continue;
      this.entitySnapshots.set(move.entityId, deepClone(entity));
      this.sceneManager.updateEntity(move.entityId, updates);
    }

    for (const entityId of anchorMoves) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const updates = translateEntityByAnchor(entity as unknown as Entity, displacement);
      if (!hasUpdates(updates)) continue;
      this.entitySnapshots.set(entityId, deepClone(entity));
      this.sceneManager.updateEntity(entityId, updates);
    }

    this.wasExecuted = this.entitySnapshots.size > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const [entityId, snapshot] of this.entitySnapshots) {
      const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot;
      this.sceneManager.updateEntity(entityId, geometry);
    }
  }

  redo(): void {
    const { vertexMoves, anchorMoves, displacement } = this.params;
    for (const move of vertexMoves) {
      const snapshot = this.entitySnapshots.get(move.entityId);
      if (!snapshot) continue;
      const updates = applyVertexDisplacement(snapshot as unknown as Entity, move.refs, displacement);
      if (hasUpdates(updates)) this.sceneManager.updateEntity(move.entityId, updates);
    }
    for (const entityId of anchorMoves) {
      const snapshot = this.entitySnapshots.get(entityId);
      if (!snapshot) continue;
      const updates = translateEntityByAnchor(snapshot as unknown as Entity, displacement);
      if (hasUpdates(updates)) this.sceneManager.updateEntity(entityId, updates);
    }
  }

  getDescription(): string {
    const count = this.entitySnapshots.size || (this.params.vertexMoves.length + this.params.anchorMoves.length);
    const { x, y } = this.params.displacement;
    return `Stretch ${count} ${count === 1 ? 'entity' : 'entities'} by Δ(${x.toFixed(3)}, ${y.toFixed(3)})`;
  }

  getAffectedEntityIds(): string[] {
    const ids = new Set<string>();
    for (const m of this.params.vertexMoves) ids.add(m.entityId);
    for (const id of this.params.anchorMoves) ids.add(id);
    return [...ids];
  }

  validate(): string | null {
    const total = this.params.vertexMoves.length + this.params.anchorMoves.length;
    if (total === 0) return 'At least one entity is required';
    const { x, y } = this.params.displacement;
    if (x === 0 && y === 0) return 'Displacement cannot be zero';
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
        vertexMoves: this.params.vertexMoves,
        anchorMoves: this.params.anchorMoves,
        displacement: this.params.displacement,
        entitySnapshots: snapshotsArray,
      },
      version: 1,
    };
  }
}

function hasUpdates(obj: Partial<SceneEntity>): boolean {
  return Object.keys(obj).length > 0;
}
