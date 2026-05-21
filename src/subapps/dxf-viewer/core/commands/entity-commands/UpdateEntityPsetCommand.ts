/**
 * UPDATE ENTITY PSET COMMAND — ADR-369 §9 Q8.2
 *
 * Generic command that patches the `pset` field on any BIM entity via
 * `ISceneManager.updateEntity`. Works for wall / slab / column / beam / opening
 * without entity-type-specific geometry recomputation (pset is metadata only).
 *
 * Supports undo/redo. Does NOT merge (each Pset save = discrete undo entry).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §Q8.2
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { IfcPropertySet } from '../../../bim/types/ifc-entity-mixin';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class UpdateEntityPsetCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateEntityPset';
  readonly type = 'update-entity-pset';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly nextPset: IfcPropertySet | undefined,
    private readonly previousPset: IfcPropertySet | undefined,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPset(this.nextPset);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPset(this.previousPset);
  }

  redo(): void {
    this.applyPset(this.nextPset);
  }

  private applyPset(pset: IfcPropertySet | undefined): void {
    this.sceneManager.updateEntity(
      this.entityId,
      { pset } as unknown as Record<string, unknown>,
    );
  }

  canMergeWith(_other: ICommand): boolean {
    return false;
  }

  mergeWith(_other: ICommand): ICommand {
    return this;
  }

  getDescription(): string {
    const keyCount = this.nextPset ? Object.keys(this.nextPset).length : 0;
    return `Update entity pset (${keyCount} fields)`;
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity ID is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        nextPset: this.nextPset ?? null,
        previousPset: this.previousPset ?? null,
      },
      version: 1,
    };
  }
}
