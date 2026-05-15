/**
 * UPDATE ARRAY PARAMS COMMAND — ADR-353 Session A2
 *
 * Patches params on an existing ArrayEntity. Supports command merging
 * (500 ms window, ADR-031 pattern) for grip-drag operations so that
 * rapid drag updates collapse into a single undo history entry.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { ArrayParams } from '../../../systems/array/types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateArrayParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateArrayParams';
  readonly type = 'update-array-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly arrayId: string,
    private readonly params: ArrayParams,
    private readonly previousParams: ArrayParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.sceneManager.updateEntity(this.arrayId, { params: this.params } as Record<string, unknown>);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.updateEntity(this.arrayId, { params: this.previousParams } as Record<string, unknown>);
  }

  redo(): void {
    this.sceneManager.updateEntity(this.arrayId, { params: this.params } as Record<string, unknown>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateArrayParamsCommand)) return false;
    if (other.arrayId !== this.arrayId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateArrayParamsCommand;
    // Keep earliest previousParams (this) and latest params (other).
    return new UpdateArrayParamsCommand(
      this.arrayId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update array params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.arrayId];
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
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
