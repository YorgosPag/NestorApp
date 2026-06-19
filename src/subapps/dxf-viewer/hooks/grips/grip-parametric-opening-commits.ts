/**
 * Parametric opening grip commit handlers (drag-along-wall + Alt-move re-host).
 *
 * Extracted from grip-parametric-commits.ts (ADR-363 Phase 2.5 / Φ1G.5,
 * N.7.1 file-size split). Re-exported from the commit hub so the public API
 * stays one import. Both handlers bypass the generic stretch/move path because
 * `OpeningEntity` is parametric: geometry is derived from `params` (offset along
 * the host wall), so the commit recomputes geometry atomically via
 * `UpdateOpeningParamsCommand`. Merge window (ADR-031) enabled so a continuous
 * drag collapses into a single undo entry.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { applyOpeningGripDrag, resolveOpeningAltMove, openingRehostToleranceWorld } from '../../bim/walls/opening-grips';
import { isWallEntity, type Entity } from '../../types/entities';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * ADR-363 Phase 2.5 — Parametric opening grip commit (drag-along-wall).
 * Mirrors `commitWallGripDrag` semantics: routes through `applyOpeningGripDrag()`
 * + `UpdateOpeningParamsCommand` so geometry + validation recompute atomically
 * and the merge window (ADR-031) collapses a continuous drag into one undo
 * entry. Host wall is resolved via `params.wallId`; commit is a no-op when the
 * host is missing (soft-orphan policy, ADR-363 §5.4).
 */
export function commitOpeningGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.openingGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<OpeningEntity>;
  if (candidate.type !== 'opening' || !candidate.params) return;
  const opening = candidate as OpeningEntity;
  const hostRaw = sceneManager.getEntity(opening.params.wallId);
  if (!hostRaw) return;
  const hostCandidate = hostRaw as unknown as Partial<WallEntity>;
  if (hostCandidate.type !== 'wall' || !hostCandidate.params || !hostCandidate.geometry) return;
  const hostWall = hostCandidate as WallEntity;
  const originalParams = opening.params;
  const currentPos: Point2D = {
    x: grip.position.x + delta.x,
    y: grip.position.y + delta.y,
  };
  const newParams = applyOpeningGripDrag(grip.openingGripKind, {
    originalParams,
    currentPos,
    hostWall,
  });
  if (newParams === originalParams) return;
  const command = new UpdateOpeningParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('opening', grip.entityId);
}

/**
 * ADR-363 Φ1G.5 Slice 2 — Alt-drag «move-from-characteristic-point» commit for a
 * hosted opening. Mirrors `commitOpeningGripDrag` (same host resolution +
 * `UpdateOpeningParamsCommand` + merge-window) but routes through
 * `resolveOpeningAltMove`, the SSoT shared with the live ghost: cursor near the
 * current wall → slide along it; cursor near ANOTHER wall → RE-HOST (Revit «Pick
 * New Host», `wallId` changes). Geometry recomputes against the resolved host
 * inside `UpdateOpeningParamsCommand` (re-resolves `params.wallId`), so the
 * auto-rotation + auto-thickness on the new wall come for free.
 */
export function commitOpeningAltMove(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.openingGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<OpeningEntity>;
  if (candidate.type !== 'opening' || !candidate.params) return;
  const opening = candidate as OpeningEntity;
  const hostRaw = sceneManager.getEntity(opening.params.wallId);
  if (!hostRaw) return;
  const hostCandidate = hostRaw as unknown as Partial<WallEntity>;
  if (hostCandidate.type !== 'wall' || !hostCandidate.params || !hostCandidate.geometry) return;
  const currentHost = hostCandidate as WallEntity;
  const candidateWalls = ((sceneManager.getEntities?.() ?? []) as unknown as Entity[]).filter(isWallEntity);
  const originalParams = opening.params;
  const resolved = resolveOpeningAltMove({
    originalParams,
    basePoint: grip.position,
    currentPos: { x: grip.position.x + delta.x, y: grip.position.y + delta.y },
    currentHost,
    candidateWalls,
    rehostToleranceWorld: openingRehostToleranceWorld(currentHost),
  });
  if (!resolved) return;
  const command = new UpdateOpeningParamsCommand(
    grip.entityId,
    resolved.params,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('opening', grip.entityId);
}
