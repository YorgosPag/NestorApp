/**
 * UPDATE COLUMN PARAMS COMMAND — ADR-363 Phase 4.5.
 *
 * Patches `params` on an existing `ColumnEntity` and recomputes `geometry` +
 * `validation` atomically via `computeColumnGeometry()` +
 * `validateColumnParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * Root `kind` field is kept in sync με `params.kind` so the ribbon's kind
 * switch remains undoable και ο `ColumnEntity.kind` discriminator δεν
 * αποκλίνει από το `params.kind`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { ColumnGeometry, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import { useStructuralSettingsStore } from '../../../state/structural-settings-store';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateColumnParamsCommand extends MergeableUpdateCommand<ColumnParams> {
  readonly name = 'UpdateColumnParams';
  readonly type = 'update-column-params';

  constructor(
    columnId: string,
    params: ColumnParams,
    previousParams: ColumnParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(columnId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: ColumnParams): void {
    const geometry: ColumnGeometry = computeColumnGeometry(params);
    // ADR-456 — ο ρ-έλεγχος οπλισμού χρησιμοποιεί τον building-level ενεργό
    // κανονισμό (SSoT) ώστε κάθε recompute (ribbon edit / grip-drag) να κρίνεται
    // με τα ίδια όρια.
    const { codeId } = useStructuralSettingsStore.getState();
    const validation = validateColumnParams(params, codeId).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: ColumnParams): UpdateColumnParamsCommand {
    return new UpdateColumnParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update column params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Column entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.kind !== 'circular' && this.patch.depth <= 0) {
      return 'depth must be > 0';
    }
    if (this.patch.height <= 0) return 'height must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }
}
