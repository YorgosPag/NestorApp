/**
 * UPDATE MEP SYSTEM PARAMS COMMAND — ADR-408 Φ4.
 *
 * Patches `params` on a persisted `MepSystem` (member removal in the Φ4 delete
 * cascade; rename / assign in the Φ5 circuit UI). Unlike the fixture/panel
 * commands the System is **NOT a scene entity** (geometry-less, own store), so
 * the command targets the `MepSystemMutator` port instead of an
 * `ISceneManager` — the port forwards to `useMepSystemPersistence`, the single
 * Firestore writer. Mirrors `UpdateElectricalPanelParamsCommand` structure
 * (incl. drag-merge, for a future debounced rename in Φ5).
 *
 * @see ../../../bim/mep-systems/mep-system-mutator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { isWithinMergeWindow } from '../merge-window';
import type { MepSystemParams } from '../../../bim/types/mep-system-types';
import { getMepSystemMutator } from '../../../bim/mep-systems/mep-system-mutator';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class UpdateMepSystemParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepSystemParams';
  readonly type = 'update-mep-system-params';
  readonly timestamp: number;

  constructor(
    private readonly systemId: string,
    private readonly params: MepSystemParams,
    private readonly previousParams: MepSystemParams,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    getMepSystemMutator()?.updateSystemParams(this.systemId, this.params);
  }

  undo(): void {
    getMepSystemMutator()?.updateSystemParams(this.systemId, this.previousParams);
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepSystemParamsCommand)) return false;
    if (other.systemId !== this.systemId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return isWithinMergeWindow(this, other);
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepSystemParamsCommand;
    return new UpdateMepSystemParamsCommand(this.systemId, o.params, this.previousParams, true);
  }

  getDescription(): string {
    return `Update MEP system params (${this.params.name})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.systemId];
  }

  validate(): string | null {
    if (!this.systemId) return 'MEP system ID is required';
    if (!Array.isArray(this.params.members)) return 'members must be an array';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        systemId: this.systemId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
