/**
 * @module core/commands/entity-commands/replace-entities-command
 * @description SSoT factory για την εντολή «Ν πηγές → Μ αντικαταστάτες» ενός είδους BIM: μία
 * αναιρέσιμη ενέργεια που αφαιρεί οντότητες και βάζει στη θέση τους άλλες, **συμμετρικά σε σκηνή
 * ΚΑΙ Firestore** σε execute / undo / redo.
 *
 * Το σώμα γράφτηκε πρώτη φορά στη `MergeColumnsCommand` (ADR-363: Ν κολόνες → ένα τοιχίο). Η
 * ADR-911 Φ4-2 χρειάζεται ακριβώς το ίδιο για τοίχους (Ν ομοαξονικοί → ένας συνεχής, πάνω από τα
 * κενά των θυρών). Η `WallMergeCommand` (ADR-566) ΔΕΝ είναι αυτό: αναιρεί τη σκηνή, αλλά την
 * αποθήκευση την εκπέμπει ο καλών, μία φορά — το undo δεν φτάνει ποτέ στο Firestore.
 *
 * Firestore, πάντα σε microtask (μετά το σύγχρονο `CommandHistory.execute` — καμία ένθετη εντολή
 * από αντίδραση στο `drawing:entity-created`):
 *   - apply (execute/redo): `bim:<type>-delete-requested` ανά πηγή + `drawing:entity-created`
 *     ανά αντικαταστάτη.
 *   - revert (undo): `bim:<type>-delete-requested` ανά αντικαταστάτη +
 *     `bim:entity-restore-requested` ανά πηγή (ίδιο id, `action='restored'`).
 *
 * @see ./MergeColumnsCommand.ts · ./ReplaceWallsCommand.ts — τα δύο δεσίματα
 * @see ./create-batch-entities-command.ts — το αδελφό εργοστάσιο της απλής μαζικής δημιουργίας
 * @see ../../../systems/events/bim-entity-lifecycle-events.ts — το SSoT των τριών εκπομπών
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';
import type { BimEventMap } from '../../../systems/events/drawing-event-map-bim';
import type { EntityCreatedOrigin } from '../../../systems/events/drawing-event-map';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import {
  emitBimEntityCreated,
  emitBimEntityDeleteRequested,
  emitBimEntityRestoreRequested,
} from '../../../systems/events/bim-entity-lifecycle-events';

export interface ReplaceEntitiesCommandConfig {
  readonly name: string;
  readonly type: string;
  /** Το είδος BIM και των δύο πλευρών — πρέπει να είναι restore-able (ADR-390). */
  readonly bimType: BimEventMap['bim:entity-restore-requested']['entityType'];
  readonly describe: (sourceCount: number, replacementCount: number) => string;
  /** `null` = έγκυρο· αλλιώς το μήνυμα του `validate()`. */
  readonly validate: (sourceCount: number, replacementIds: readonly string[]) => string | null;
  readonly serializeData: (sourceIds: readonly string[], replacementIds: readonly string[]) => Record<string, unknown>;
}

export interface ReplaceEntitiesCommandOptions {
  /** Το `origin` των εκπομπών δημιουργίας των αντικαταστατών (ADR-911 Φ2). */
  readonly origin?: EntityCreatedOrigin;
}

export interface ReplaceEntitiesCommandClass<TEntity> {
  new (
    sources: readonly TEntity[],
    replacements: readonly TEntity[],
    sceneManager: ISceneManager,
    options?: ReplaceEntitiesCommandOptions,
  ): ICommand;
}

export function createReplaceEntitiesCommand<TEntity extends { readonly id: string }>(
  config: ReplaceEntitiesCommandConfig,
): ReplaceEntitiesCommandClass<TEntity> {
  return class ReplaceEntitiesCommand implements ICommand {
    readonly id: string;
    readonly name = config.name;
    readonly type = config.type;
    readonly timestamp: number;

    private readonly sources: readonly TEntity[];
    private readonly replacements: readonly TEntity[];
    private wasExecuted = false;

    constructor(
      sources: readonly TEntity[],
      replacements: readonly TEntity[],
      private readonly sceneManager: ISceneManager,
      private readonly options: ReplaceEntitiesCommandOptions = {},
    ) {
      // Defensive deep-clone: τα στιγμιότυπα είναι ανεξάρτητα από μετέπειτα αλλαγές της σκηνής.
      this.sources = sources.map((s) => deepClone(s));
      this.replacements = replacements.map((r) => deepClone(r));
      this.id = generateEntityId();
      this.timestamp = Date.now();
    }

    execute(): void {
      this.swap(this.sources, this.replacements);
      this.wasExecuted = true;
      this.deferFirestore('apply');
    }

    redo(): void {
      this.swap(this.sources, this.replacements);
      this.deferFirestore('apply');
    }

    undo(): void {
      if (!this.wasExecuted) return;
      this.swap(this.replacements, this.sources);
      this.deferFirestore('revert');
    }

    /** scene: αφαίρεσε τη μία πλευρά, βάλε την άλλη. */
    private swap(out: readonly TEntity[], into: readonly TEntity[]): void {
      for (const e of out) this.sceneManager.removeEntity(e.id);
      for (const e of into) this.sceneManager.addEntity(deepClone(e) as unknown as SceneEntity);
    }

    private deferFirestore(direction: 'apply' | 'revert'): void {
      const { sources, replacements } = this;
      const origin = this.options.origin;
      queueMicrotask(() => {
        if (direction === 'apply') {
          for (const s of sources) emitBimEntityDeleteRequested(config.bimType, s.id);
          for (const r of replacements) {
            emitBimEntityCreated(deepClone(r) as unknown as AnySceneEntity, config.bimType, origin);
          }
          return;
        }
        for (const r of replacements) emitBimEntityDeleteRequested(config.bimType, r.id);
        for (const s of sources) {
          emitBimEntityRestoreRequested(config.bimType, deepClone(s) as unknown as AnySceneEntity, 'undo-delete');
        }
      });
    }

    canMergeWith(): boolean {
      return false;
    }

    getDescription(): string {
      return config.describe(this.sources.length, this.replacements.length);
    }

    getAffectedEntityIds(): string[] {
      return [...this.replacements.map((r) => r.id), ...this.sources.map((s) => s.id)];
    }

    validate(): string | null {
      return config.validate(this.sources.length, this.replacements.map((r) => r.id));
    }

    serialize(): SerializedCommand {
      return {
        type: this.type,
        id: this.id,
        name: this.name,
        timestamp: this.timestamp,
        data: config.serializeData(this.sources.map((s) => s.id), this.replacements.map((r) => r.id)),
        version: 1,
      };
    }
  };
}
