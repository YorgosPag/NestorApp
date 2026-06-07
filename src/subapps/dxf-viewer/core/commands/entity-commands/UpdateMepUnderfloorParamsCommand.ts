/**
 * UPDATE MEP UNDERFLOOR PARAMS COMMAND — ADR-408 Εύρος Β #3.
 *
 * Patches `params` on an existing `MepUnderfloorEntity` and recomputes
 * `geometry` atomically via `computeMepUnderfloorGeometry()` so the renderer
 * never reads stale data.
 *
 * Mirrors `UpdateFloorFinishParamsCommand` (ADR-419 merge pattern) — consecutive
 * drag samples collapse into a single undo entry within the merge window.
 * Persistence picks up the patched entity via debounced auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { MepUnderfloorParams } from '../../../bim/types/mep-underfloor-types';
import { computeMepUnderfloorGeometry } from '../../../bim/mep-underfloor/mep-underfloor-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateMepUnderfloorParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepUnderfloorParams';
  readonly type = 'update-mep-underfloor-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly underfloorId: string,
    private readonly params: MepUnderfloorParams,
    private readonly previousParams: MepUnderfloorParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPatch(this.params);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousParams);
  }

  redo(): void {
    this.applyPatch(this.params);
  }

  private applyPatch(params: MepUnderfloorParams): void {
    const geometry = computeMepUnderfloorGeometry(params);
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.underfloorId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepUnderfloorParamsCommand)) return false;
    if (other.underfloorId !== this.underfloorId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepUnderfloorParamsCommand;
    return new UpdateMepUnderfloorParamsCommand(
      this.underfloorId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update underfloor heating params (${this.underfloorId})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.underfloorId];
  }

  validate(): string | null {
    if (!this.underfloorId) return 'Underfloor entity ID is required';
    if (!this.params.footprint || this.params.footprint.vertices.length < 3) {
      return 'footprint must have at least 3 vertices';
    }
    if (this.params.pipeSpacingMm <= 0) return 'pipeSpacingMm must be > 0';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        underfloorId: this.underfloorId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
