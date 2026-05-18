/**
 * COPY ENTITY COMMAND — ADR-357 Phase 12 / G10 extras
 *
 * Undoable command that clones one or more entities with the same displacement
 * transform as {@link StretchEntityCommand}, but instead of mutating the source
 * geometry it spawns fresh entities (new IDs) on the scene. The originals stay
 * intact — matches AutoCAD's grip-extra `Copy` toggle semantics.
 *
 * Routing on grip drag commit ({@link commitDxfGripDragModeAware} +
 * `GripCopyModeStore.enabled === true`):
 *   - `stretch` mode → vertex/anchor displacement on clones (same math as
 *                      StretchEntityCommand, applied to the cloned entity)
 *   - `move` mode    → anchor displacement on clones (rigid translation of
 *                      the entire entity by `delta`)
 *
 * `scale` / `rotate` / `mirror` modes route to their respective tools
 * via {@link GripHandoffStore} with `copyMode: true` and use the native
 * `copyMode` / `keepOriginals` paths in `ScaleEntityCommand` / extended
 * `RotateEntityCommand` / `MirrorEntityCommand` — no CopyEntityCommand wrapper
 * needed there.
 *
 * Undo semantics: removes every entity created by this command. Redo
 * re-applies the same clones (rebuilt deterministically from the recorded
 * `sourceEntities`).
 *
 * @see ADR-357 §14 G10 — Phase 12 deliverable
 * @see ScaleEntityCommand — analog `copyMode` pattern (clone in execute(), remove in undo())
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

export interface CopyVertexMove {
  readonly entityId: string;
  readonly refs: ReadonlyArray<VertexRef>;
}

export interface CopyEntityParams {
  /** Source entities that receive per-vertex displacement (same shape as Stretch). */
  readonly vertexMoves: ReadonlyArray<CopyVertexMove>;
  /** Source entities that receive rigid anchor translation (same shape as Stretch). */
  readonly anchorMoves: ReadonlyArray<string>;
  /** World-space displacement applied to all sources to produce the clones. */
  readonly displacement: WorldVector;
}

export class CopyEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'CopyEntities';
  readonly type = 'copy-entities';
  readonly timestamp: number;

  /** IDs of the clones added by this command — used by undo() and redo(). */
  private createdEntityIds: string[] = [];

  /**
   * Frozen source-entity snapshots indexed by source-id. Used by `redo()` so
   * we can rebuild the clones deterministically even if the source has since
   * been mutated by other commands.
   */
  private sourceSnapshots: Map<string, SceneEntity> = new Map();

  private wasExecuted = false;

  constructor(
    private readonly params: CopyEntityParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.createdEntityIds = [];
    this.sourceSnapshots.clear();

    const { displacement } = this.params;
    const clones = this.buildClones(displacement);
    for (const clone of clones) {
      this.sceneManager.addEntity(clone);
      this.createdEntityIds.push(clone.id);
    }
    this.wasExecuted = this.createdEntityIds.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const id of this.createdEntityIds) {
      this.sceneManager.removeEntity(id);
    }
  }

  redo(): void {
    const { displacement } = this.params;
    this.createdEntityIds = [];
    // Re-clone deterministically from the captured snapshots so redo works
    // even after intervening commands have mutated the live sources.
    const clones = this.buildClonesFromSnapshots(displacement);
    for (const clone of clones) {
      this.sceneManager.addEntity(clone);
      this.createdEntityIds.push(clone.id);
    }
  }

  getDescription(): string {
    const count = this.createdEntityIds.length;
    const { x, y } = this.params.displacement;
    return `Copy ${count} ${count === 1 ? 'entity' : 'entities'} by Δ(${x.toFixed(3)}, ${y.toFixed(3)})`;
  }

  getAffectedEntityIds(): string[] {
    // The clones are the affected entities (the sources are untouched).
    return [...this.createdEntityIds];
  }

  validate(): string | null {
    const total = this.params.vertexMoves.length + this.params.anchorMoves.length;
    if (total === 0) return 'At least one entity is required';
    const { x, y } = this.params.displacement;
    if (x === 0 && y === 0) return 'Displacement cannot be zero';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        vertexMoves: this.params.vertexMoves,
        anchorMoves: this.params.anchorMoves,
        displacement: this.params.displacement,
        createdEntityIds: this.createdEntityIds,
      },
      version: 1,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * Build clone entities from live scene state, captured into `sourceSnapshots`
   * for deterministic redo.
   */
  private buildClones(delta: WorldVector): SceneEntity[] {
    const clones: SceneEntity[] = [];
    for (const move of this.params.vertexMoves) {
      const source = this.sceneManager.getEntity(move.entityId);
      if (!source) continue;
      const snapshot = deepClone(source);
      this.sourceSnapshots.set(move.entityId, snapshot);
      const clone = this.cloneFromVertexMove(snapshot, move.refs, delta);
      if (clone) clones.push(clone);
    }
    for (const entityId of this.params.anchorMoves) {
      const source = this.sceneManager.getEntity(entityId);
      if (!source) continue;
      const snapshot = deepClone(source);
      this.sourceSnapshots.set(entityId, snapshot);
      const clone = this.cloneFromAnchorMove(snapshot, delta);
      if (clone) clones.push(clone);
    }
    return clones;
  }

  /** Same as `buildClones` but reads from the previously captured snapshots — used by redo. */
  private buildClonesFromSnapshots(delta: WorldVector): SceneEntity[] {
    const clones: SceneEntity[] = [];
    for (const move of this.params.vertexMoves) {
      const snapshot = this.sourceSnapshots.get(move.entityId);
      if (!snapshot) continue;
      const clone = this.cloneFromVertexMove(snapshot, move.refs, delta);
      if (clone) clones.push(clone);
    }
    for (const entityId of this.params.anchorMoves) {
      const snapshot = this.sourceSnapshots.get(entityId);
      if (!snapshot) continue;
      const clone = this.cloneFromAnchorMove(snapshot, delta);
      if (clone) clones.push(clone);
    }
    return clones;
  }

  private cloneFromVertexMove(
    snapshot: SceneEntity,
    refs: ReadonlyArray<VertexRef>,
    delta: WorldVector,
  ): SceneEntity | null {
    const result = applyVertexDisplacement(snapshot as unknown as Entity, refs, delta);
    if (result.kind === 'noop') return null;
    const newId = generateEntityId();
    if (result.kind === 'update') {
      return { ...snapshot, ...result.updates, id: newId };
    }
    // `replace` — math layer returned a wholesale entity (e.g. rectangle →
    // polyline coercion). Override id so the clone is a distinct scene entity.
    return { ...result.entity, id: newId };
  }

  private cloneFromAnchorMove(
    snapshot: SceneEntity,
    delta: WorldVector,
  ): SceneEntity | null {
    const updates = translateEntityByAnchor(snapshot as unknown as Entity, delta);
    if (Object.keys(updates).length === 0) return null;
    const newId = generateEntityId();
    return { ...snapshot, ...updates, id: newId };
  }
}
