/**
 * UPDATE MEP SEGMENT PARAMS COMMAND — ADR-408 Φ8.
 *
 * Patches `params` on an existing `MepSegmentEntity` and recomputes
 * `geometry` atomically via `computeMepSegmentGeometry()` so renderer reads
 * never diverge from the parametric source of truth. Mirrors
 * `UpdateElectricalPanelParamsCommand` — supports command merging for
 * grip-drag operations so consecutive drag samples collapse into a single
 * undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { MepSegmentParams } from '../../../bim/types/mep-segment-types';
import { computeMepSegmentGeometry } from '../../../bim/geometry/mep-segment-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateMepSegmentParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepSegmentParams';
  readonly type = 'update-mep-segment-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly segmentId: string,
    private readonly params: MepSegmentParams,
    private readonly previousParams: MepSegmentParams,
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

  private applyPatch(params: MepSegmentParams): void {
    const geometry = computeMepSegmentGeometry(params);
    this.sceneManager.updateEntity(this.segmentId, {
      kind: params.domain,
      params,
      geometry,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepSegmentParamsCommand)) return false;
    if (other.segmentId !== this.segmentId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepSegmentParamsCommand;
    return new UpdateMepSegmentParamsCommand(
      this.segmentId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP segment params (${this.params.domain}/${this.params.sectionKind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.segmentId];
  }

  validate(): string | null {
    if (!this.segmentId) return 'MEP segment entity ID is required';
    if (!this.params.domain) return 'domain is required';
    if (!this.params.sectionKind) return 'sectionKind is required';
    if (!Number.isFinite(this.params.centerlineElevationMm)) {
      return 'centerlineElevationMm must be finite';
    }
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        segmentId: this.segmentId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
