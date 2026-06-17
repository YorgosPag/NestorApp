/**
 * Polygon-footprint parametric grip commit handlers (underfloor / future area entities).
 *
 * Extracted from grip-parametric-commits.ts (N.7.1 file-size split). Each handler
 * bypasses the generic stretch / move path because the entity is parametric: geometry
 * is derived from `params`, so the commit recomputes geometry atomically via a
 * dedicated command. Merge window (ADR-031) is enabled so a continuous drag collapses
 * into a single undo entry. Re-exported from grip-parametric-commits.ts so the public
 * commit API stays single-import.
 *
 * @see ./grip-parametric-commits.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import { applyMepUnderfloorGripDrag } from '../../bim/mep-underfloor/mep-underfloor-grips';
import { UpdateMepUnderfloorParamsCommand } from '../../core/commands/entity-commands/UpdateMepUnderfloorParamsCommand';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * ADR-408 Εύρος Β #3 — Parametric underfloor heating loop grip commit (per-vertex
 * translate + edge-midpoint insertion). Mirrors `commitFloorFinishGripDrag`
 * (ADR-419) semantics: routes through `applyMepUnderfloorGripDrag()` +
 * `UpdateMepUnderfloorParamsCommand` so geometry + connectors recompute atomically
 * and the merge window (ADR-031) collapses a continuous drag into one undo entry.
 * Shift drives rectilinear constraint via `ShiftKeyTracker`.
 */
export function commitMepUnderfloorGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepUnderfloorGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepUnderfloorEntity>;
  if (candidate.type !== 'mep-underfloor' || !candidate.params) return;
  const underfloor = candidate as MepUnderfloorEntity;
  const originalParams = underfloor.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applyMepUnderfloorGripDrag(grip.mepUnderfloorGripKind, {
    originalParams,
    delta,
    rectilinear,
  });
  if (newParams === originalParams) return;
  const command = new UpdateMepUnderfloorParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('mep-underfloor', grip.entityId);
}
