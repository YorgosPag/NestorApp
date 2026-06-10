/**
 * UPDATE FOUNDATION PARAMS COMMAND — ADR-436 Slice 1.
 *
 * Patches `params` on an existing `FoundationEntity` and recomputes `geometry` +
 * `validation` atomically via `computeFoundationGeometry()` +
 * `validateFoundationParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Mirrors `UpdateColumnParamsCommand` (ADR-363 §6 Phase 4.5) — supports command
 * merging (DEFAULT_MERGE_CONFIG.mergeTimeWindow ms, ADR-031) for grip-drag
 * operations (Slice 1b) so consecutive drag samples collapse into a single undo
 * entry. Root `kind` field is kept in sync με `params.kind`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FoundationGeometry, FoundationParams } from '../../../bim/types/foundation-types';
import { computeFoundationGeometry } from '../../../bim/geometry/foundation-geometry';
import { validateFoundationParams } from '../../../bim/validators/foundation-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateFoundationParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateFoundationParams';
  readonly type = 'update-foundation-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly foundationId: string,
    private readonly params: FoundationParams,
    private readonly previousParams: FoundationParams,
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

  private applyPatch(params: FoundationParams): void {
    const geometry: FoundationGeometry = computeFoundationGeometry(params);
    const validation = validateFoundationParams(params).bimValidation;
    this.sceneManager.updateEntity(this.foundationId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateFoundationParamsCommand)) return false;
    if (other.foundationId !== this.foundationId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateFoundationParamsCommand;
    return new UpdateFoundationParamsCommand(
      this.foundationId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update foundation params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.foundationId];
  }

  validate(): string | null {
    if (!this.foundationId) return 'Foundation entity ID is required';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.kind === 'pad' && this.params.length <= 0) return 'length must be > 0';
    if (this.params.thicknessMm <= 0) return 'thickness must be > 0';
    if (!Number.isFinite(this.params.topElevationMm)) return 'topElevation must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        foundationId: this.foundationId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
