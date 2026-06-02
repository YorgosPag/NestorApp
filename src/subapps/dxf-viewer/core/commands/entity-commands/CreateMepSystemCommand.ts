/**
 * CREATE MEP SYSTEM COMMAND — ADR-408 Φ5.
 *
 * Creates a new `MepSystem` (an electrical circuit) from the circuit UI. Holds a
 * fully-built `MepSystemEntity` with a **pre-minted enterprise id** so
 * create / undo / redo are id-stable. Targets the `MepSystemMutator` port (the
 * System is geometry-less and not a scene entity), which forwards to
 * `useMepSystemPersistence` — the single Firestore writer.
 *
 * Inverse of `DissolveMepSystemCommand`: `execute/redo` create, `undo`
 * dissolves. When the new circuit reassigns members away from existing
 * circuits, the caller bundles this with `UpdateMepSystemParamsCommand`s in a
 * `CompoundCommand` for a single coherent undo (Revit single-circuit rule).
 *
 * @see ../../../bim/mep-systems/mep-system-mutator.ts
 * @see ./DissolveMepSystemCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';
import { getMepSystemMutator } from '../../../bim/mep-systems/mep-system-mutator';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class CreateMepSystemCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateMepSystem';
  readonly type = 'create-mep-system';
  readonly timestamp: number;

  constructor(private readonly entity: MepSystemEntity) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    getMepSystemMutator()?.createSystem(this.entity);
  }

  undo(): void {
    getMepSystemMutator()?.dissolveSystem(this.entity.id);
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create MEP circuit (${this.entity.params.name})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.entity.id];
  }

  validate(): string | null {
    if (!this.entity?.id) return 'MEP system id is required';
    if (!this.entity.params?.sourceEntityId) return 'MEP system source is required';
    if (!Array.isArray(this.entity.params.members)) return 'members must be an array';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entity: this.entity as unknown as Record<string, unknown> },
      version: 1,
    };
  }
}
