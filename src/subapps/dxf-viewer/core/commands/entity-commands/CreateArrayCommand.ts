/**
 * CREATE ARRAY COMMAND — ADR-353 Session A2
 *
 * Creates an associative ArrayEntity from pre-selected source entities.
 * Sources are extracted (deep-cloned + removed from scene) and stored
 * inside the ArrayEntity as hiddenSources (Q13 pattern).
 *
 * execute/undo/redo are all idempotent: the same arrayEntityId is reused.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ArrayEntity, Entity } from '../../../types/entities';
import type { ArrayKind, ArrayParams } from '../../../systems/array/types';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import {
  extractSourcesFromScene,
  restoreSourcesToScene,
} from '../../../systems/array/array-source-extraction';

export class CreateArrayCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateArray';
  readonly type = 'create-array';
  readonly timestamp: number;

  private readonly arrayEntityId: string;
  private hiddenSources: Entity[] = [];
  private wasExecuted = false;

  constructor(
    private readonly sourceEntityIds: string[],
    private readonly arrayKind: ArrayKind,
    private readonly params: ArrayParams,
    private readonly sceneManager: ISceneManager,
    private readonly pathEntityId?: string,
    private readonly basePointOverride?: Point2D,
  ) {
    this.id = generateEntityId();
    this.arrayEntityId = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this._doCreate();
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.removeEntity(this.arrayEntityId);
    restoreSourcesToScene(this.hiddenSources, this.sceneManager);
  }

  redo(): void {
    // Sources are back in scene (undo restored them) — re-extract and re-add.
    this._doCreate();
  }

  private _doCreate(): void {
    const sources: Entity[] = [];
    for (const id of this.sourceEntityIds) {
      const e = this.sceneManager.getEntity(id);
      if (e) sources.push(e as unknown as Entity);
    }
    if (sources.length === 0) return;

    this.hiddenSources = extractSourcesFromScene(sources, this.sceneManager);

    const layer = (sources[0] as { layer?: string }).layer ?? '0';

    const arrayEntity: ArrayEntity = {
      id: this.arrayEntityId,
      type: 'array',
      layer,
      visible: true,
      arrayKind: this.arrayKind,
      hiddenSources: this.hiddenSources,
      params: this.params,
      ...(this.pathEntityId !== undefined ? { pathEntityId: this.pathEntityId } : {}),
      ...(this.basePointOverride !== undefined ? { basePointOverride: this.basePointOverride } : {}),
    };

    this.sceneManager.addEntity(arrayEntity as unknown as SceneEntity);
  }

  getDescription(): string {
    const n = this.sourceEntityIds.length;
    return `Create ${this.arrayKind} array from ${n} ${n === 1 ? 'entity' : 'entities'}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.arrayEntityId, ...this.sourceEntityIds];
  }

  validate(): string | null {
    if (this.sourceEntityIds.length === 0) return 'At least one source entity is required';
    return null;
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
        sourceEntityIds: this.sourceEntityIds,
        arrayEntityId: this.arrayEntityId,
        arrayKind: this.arrayKind,
        params: this.params,
        pathEntityId: this.pathEntityId ?? null,
        basePointOverride: this.basePointOverride ?? null,
      },
      version: 1,
    };
  }
}
