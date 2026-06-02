/**
 * DISSOLVE MEP SYSTEM COMMAND — ADR-408 Φ4.
 *
 * Deletes a whole `MepSystem` (a circuit) when its **source** equipment is
 * removed — Revit "deleting the panel deletes its circuits". Holds the full
 * `MepSystemEntity` snapshot so `undo()` re-creates it **id-preserving** via
 * the `MepSystemMutator` port (the `MepSystemFirestoreService.saveSystem`
 * accepts an explicit `id`). Bundled with the entity `DeleteEntityCommand`
 * inside a `CompoundCommand`, so a single Ctrl+Z restores both.
 *
 * The System is geometry-less and not a scene entity, so this command targets
 * the mutator port rather than an `ISceneManager`.
 *
 * @see ../../../bim/mep-systems/mep-system-mutator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';
import { getMepSystemMutator } from '../../../bim/mep-systems/mep-system-mutator';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class DissolveMepSystemCommand implements ICommand {
  readonly id: string;
  readonly name = 'DissolveMepSystem';
  readonly type = 'dissolve-mep-system';
  readonly timestamp: number;

  constructor(private readonly snapshot: MepSystemEntity) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    getMepSystemMutator()?.dissolveSystem(this.snapshot.id);
  }

  undo(): void {
    getMepSystemMutator()?.restoreSystem(this.snapshot);
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Dissolve MEP circuit (${this.snapshot.params.name})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.snapshot.id];
  }

  validate(): string | null {
    if (!this.snapshot?.id) return 'MEP system snapshot id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { snapshot: this.snapshot as unknown as Record<string, unknown> },
      version: 1,
    };
  }
}
