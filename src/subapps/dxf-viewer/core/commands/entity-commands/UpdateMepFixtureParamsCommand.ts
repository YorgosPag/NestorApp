/**
 * UPDATE MEP FIXTURE PARAMS COMMAND — ADR-406.
 *
 * Patches `params` on an existing `MepFixtureEntity` and recomputes `geometry`
 * + `validation` atomically via `computeMepFixtureGeometry()` +
 * `validateMepFixtureParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateColumnParamsCommand` (ADR-363
 * §5.6) — supports command merging for grip-drag operations so consecutive drag
 * samples collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { MepFixtureGeometry, MepFixtureParams } from '../../../bim/types/mep-fixture-types';
import { computeMepFixtureGeometry, validateMepFixtureParams } from '../../../bim/mep-fixtures/mep-fixture-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateMepFixtureParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepFixtureParams';
  readonly type = 'update-mep-fixture-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly fixtureId: string,
    private readonly params: MepFixtureParams,
    private readonly previousParams: MepFixtureParams,
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

  private applyPatch(params: MepFixtureParams): void {
    const geometry: MepFixtureGeometry = computeMepFixtureGeometry(params);
    const validation = validateMepFixtureParams(params).bimValidation;
    this.sceneManager.updateEntity(this.fixtureId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepFixtureParamsCommand)) return false;
    if (other.fixtureId !== this.fixtureId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepFixtureParamsCommand;
    return new UpdateMepFixtureParamsCommand(
      this.fixtureId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP fixture params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.fixtureId];
  }

  validate(): string | null {
    if (!this.fixtureId) return 'MEP fixture entity ID is required';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.shape === 'rectangular' && this.params.length <= 0) {
      return 'length must be > 0';
    }
    if (this.params.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.params.rotation)) return 'rotation must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        fixtureId: this.fixtureId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
