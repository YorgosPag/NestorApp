/**
 * ADR-607 — createBatchEntitiesCommand SSoT factory.
 *
 * The 6 `Create<Entity>Command` batch grid-gen commands (`CreateBeamsCommand` ·
 * `CreateColumnsCommand` · `CreateFoundationsCommand` · `CreateSlabsCommand` ·
 * `CreateWallsCommand` · `CreateMepSegmentsCommand`) each batch-create N pre-built BIM
 * entities in ONE undoable transaction (one Ctrl+Z removes ALL), with Firestore
 * side-effects deferred to a microtask so they run AFTER the synchronous
 * `CommandHistory.execute()` (mirror of the manual-draw `appendEntityToScene` path,
 * ADR-390/441). All six repeated the SAME ~100-line `ICommand` body verbatim —
 * execute/redo/undo, `applyScene`/`revertScene`, `deferFirestore`, `validate`,
 * `serialize`, `getDescription`/`getAffectedEntityIds` — differing ΜΟΝΟ σε 6
 * παραμέτρους (the entity type + tool/`type`/name strings + description noun +
 * serialize key + validation noun). This factory is that single source; each command is
 * now a ~12-line config binding that keeps its exact public API (`new XCommand(entities,
 * sceneManager)`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-607-batch-entities-command-ssot.md
 * @see ../../../systems/events/bim-entity-lifecycle-events.ts — create + delete-event SSoT
 * @see ./CreateBimEntityCommand.ts — the SINGLE-entity sibling (manual draw + Ctrl-COPY)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import {
  emitBimEntityCreated,
  emitBimEntityDeleteRequested,
} from '../../../systems/events/bim-entity-lifecycle-events';

export interface BatchCreateEntitiesCommandConfig {
  /** `ICommand.name` — e.g. `'CreateColumns'`. */
  readonly name: string;
  /** `ICommand.type` discriminant — e.g. `'create-columns'`. */
  readonly type: string;
  /** BIM type/tool passed to the create + delete lifecycle events — e.g. `'column'`. */
  readonly bimType: string;
  /** Noun phrase for `getDescription()` — e.g. `'grid columns'` / `'MEP pipe segments'`. */
  readonly descriptionNoun: string;
  /** Key under `serialize().data` for the entity-id list — e.g. `'columnIds'`. */
  readonly serializeIdsKey: string;
  /** Singular noun for `validate()` messages — e.g. `'column'`. */
  readonly validationNoun: string;
}

/** Constructor shape every batch-create command shares. */
export interface BatchCreateEntitiesCommandClass<TEntity> {
  new (entities: readonly TEntity[], sceneManager: ISceneManager): ICommand;
}

/**
 * Build the `ICommand` class for a batch grid-gen of one BIM entity kind. The returned
 * class is the parametric SSoT for all 6 `Create<Entity>Command` cells.
 */
export function createBatchEntitiesCommand<TEntity extends { readonly id: string }>(
  config: BatchCreateEntitiesCommandConfig,
): BatchCreateEntitiesCommandClass<TEntity> {
  return class BatchCreateEntitiesCommand implements ICommand {
    readonly id: string;
    readonly name = config.name;
    readonly type = config.type;
    readonly timestamp: number;

    private readonly entities: readonly TEntity[];
    private wasExecuted = false;

    constructor(
      entities: readonly TEntity[],
      private readonly sceneManager: ISceneManager,
    ) {
      // Defensive deep-clone: snapshots ανεξάρτητα από μετέπειτα live-scene edits.
      this.entities = entities.map((e) => deepClone(e));
      this.id = generateEntityId();
      this.timestamp = Date.now();
    }

    execute(): void {
      this.applyScene();
      this.wasExecuted = true;
      this.deferFirestore('apply');
    }

    redo(): void {
      this.applyScene();
      this.deferFirestore('apply');
    }

    undo(): void {
      if (!this.wasExecuted) return;
      this.revertScene();
      this.deferFirestore('revert');
    }

    /** scene: add every entity. */
    private applyScene(): void {
      for (const e of this.entities) {
        this.sceneManager.addEntity(deepClone(e) as unknown as SceneEntity);
      }
    }

    /** scene: remove every entity. */
    private revertScene(): void {
      for (const e of this.entities) this.sceneManager.removeEntity(e.id);
    }

    /**
     * Firestore side-effects, deferred σε microtask ώστε να τρέχουν μετά το synchronous
     * command dispatch (avoids re-entrancy when a structural reaction to
     * `drawing:entity-created` calls `history.appendToLast`).
     */
    private deferFirestore(direction: 'apply' | 'revert'): void {
      const entities = this.entities;
      queueMicrotask(() => {
        if (direction === 'apply') {
          for (const e of entities) {
            emitBimEntityCreated(deepClone(e) as unknown as AnySceneEntity, config.bimType);
          }
        } else {
          for (const e of entities) {
            emitBimEntityDeleteRequested(config.bimType, e.id);
          }
        }
      });
    }

    canMergeWith(): boolean {
      return false;
    }

    getDescription(): string {
      return `Create ${this.entities.length} ${config.descriptionNoun}`;
    }

    getAffectedEntityIds(): string[] {
      return this.entities.map((e) => e.id);
    }

    validate(): string | null {
      if (this.entities.length === 0) return `At least one ${config.validationNoun} is required`;
      if (this.entities.some((e) => !e.id)) return `Every ${config.validationNoun} must have an id`;
      return null;
    }

    serialize(): SerializedCommand {
      return {
        type: this.type,
        id: this.id,
        name: this.name,
        timestamp: this.timestamp,
        data: { [config.serializeIdsKey]: this.entities.map((e) => e.id) },
        version: 1,
      };
    }
  };
}
