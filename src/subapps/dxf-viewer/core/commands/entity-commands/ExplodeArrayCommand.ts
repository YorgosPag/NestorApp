/**
 * EXPLODE ARRAY COMMAND — ADR-353 Session A2 (Q14), updated B1
 *
 * Breaks an associative ArrayEntity into N independent entity copies
 * (one per item per source). The ArrayEntity is then removed from scene.
 *
 * execute/redo: compute transforms → addEntity N times → removeEntity(array).
 * undo: removeEntity for each created ID → addEntity(arraySnapshot).
 *
 * Supports: rect (Phase A), polar (Phase B). Path: Phase C.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ArrayEntity } from '../../../types/entities';
import type { ItemTransform, SourceBbox } from '../../../systems/array/types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { computeRectTransforms } from '../../../systems/array/rect-transform';
import { computePolarTransforms } from '../../../systems/array/polar-transform';
import { applyTransformToEntity } from '../../../systems/array/array-entity-transform';
import { computeSourceGroupBbox } from '../../../systems/array/array-bbox';

export class ExplodeArrayCommand implements ICommand {
  readonly id: string;
  readonly name = 'ExplodeArray';
  readonly type = 'explode-array';
  readonly timestamp: number;

  private createdEntityIds: string[] = [];
  private arraySnapshot: SceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly arrayId: string,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this._doExplode();
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted || !this.arraySnapshot) return;
    for (const id of this.createdEntityIds) {
      this.sceneManager.removeEntity(id);
    }
    this.sceneManager.addEntity(this.arraySnapshot);
  }

  redo(): void {
    // ArrayEntity is back in scene from undo — explode again.
    this._doExplode();
  }

  canMergeWith(): boolean {
    return false;
  }

  private _doExplode(): void {
    const raw = this.sceneManager.getEntity(this.arrayId);
    if (!raw) return;

    this.arraySnapshot = deepClone(raw);
    const arrayEntity = raw as unknown as ArrayEntity;
    const bbox = computeSourceGroupBbox(arrayEntity.hiddenSources);
    const transforms = this._computeTransforms(arrayEntity, bbox);

    this.createdEntityIds = [];

    for (const transform of transforms) {
      for (const source of arrayEntity.hiddenSources) {
        const newId = generateEntityId();
        const transformed = applyTransformToEntity(source, transform, bbox.center);
        this.sceneManager.addEntity({ ...transformed, id: newId } as unknown as SceneEntity);
        this.createdEntityIds.push(newId);
      }
    }

    this.sceneManager.removeEntity(this.arrayId);
  }

  private _computeTransforms(arrayEntity: ArrayEntity, bbox: SourceBbox): ItemTransform[] {
    const { arrayKind, params } = arrayEntity;

    if (arrayKind === 'rect' && params.kind === 'rect') {
      return computeRectTransforms(params, bbox);
    }

    if (arrayKind === 'polar' && params.kind === 'polar') {
      return computePolarTransforms(params, bbox);
    }

    // Path: Phase C
    throw new Error(
      `ExplodeArrayCommand: array kind '${arrayKind}' is not yet supported. ` +
      `Implement path-transform.ts (Phase C) first.`,
    );
  }

  getDescription(): string {
    return `Explode array into ${this.createdEntityIds.length} entities`;
  }

  getAffectedEntityIds(): string[] {
    return [this.arrayId, ...this.createdEntityIds];
  }

  validate(): string | null {
    if (!this.arrayId) return 'Array entity ID is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        arrayId: this.arrayId,
        createdEntityIds: this.createdEntityIds,
        arraySnapshot: this.arraySnapshot,
      },
      version: 1,
    };
  }
}
