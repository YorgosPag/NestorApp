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
 *
 * ADR-615 — SELF-HOSTED branch (additive, guarded by `isSelfHostedOpening`): a
 * free-standing opening has no `wallId` to resolve a `WallEntity` host from, so
 * both commits short-circuit to a host-less patch BEFORE the wall lookup —
 * `commitOpeningGripDrag` skips straight to `applyOpeningGripDrag` (corner
 * resize / rotation / facing edit the opening's OWN geometry); `commitOpeningAltMove`
 * skips `resolveOpeningAltMove` entirely (REHOST is N/A without a wall) and calls
 * `applyOpeningAltSlide` directly for the free 2D whole-object move. The
 * wall-hosted branches below stay byte-identical.
 */
import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../bim/types/opening-types';
import { isSelfHostedOpening } from '../../bim/types/opening-types';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import {
  applyOpeningGripDrag,
  applyOpeningAltSlide,
  resolveOpeningAltMove,
  openingRehostToleranceWorld,
} from '../../bim/walls/opening-grips';
import { isWallEntity, type Entity } from '../../types/entities';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { createSceneManagerAdapter } from './grip-commit-adapters';
import { gripKindOf } from '../grip-kinds';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { SceneUnits } from '../../utils/scene-units';

/**
 * ADR-615 — resolve the scene's mm↔scene-units factor for a self-hosted
 * opening's grip math (no host wall to read `sceneUnits` from). Reads the
 * active level's `SceneModel.units` (ADR-462 canonical-mm scenes declare this
 * on import); defaults to `'mm'` when the level scene is unavailable.
 */
function resolveSelfHostedOpeningSceneUnits(deps: DxfCommitDeps): SceneUnits {
  if (!deps.currentLevelId) return 'mm';
  return deps.getLevelScene(deps.currentLevelId)?.units ?? 'mm';
}

/**
 * Shared commit tail: build + validate + execute `UpdateOpeningParamsCommand`,
 * emit params-updated. ADR-615 — `sceneUnits` is threaded to the command so a
 * self-hosted opening re-derives geometry from its synthetic host with the right
 * mm↔scene factor (wall-hosted ignores it; it reads the host wall's own units).
 */
function commitOpeningParamsPatch(
  entityId: string,
  newParams: OpeningParams,
  originalParams: OpeningParams,
  sceneManager: ISceneManager,
  deps: DxfCommitDeps,
  sceneUnits: SceneUnits = 'mm',
): void {
  const command = new UpdateOpeningParamsCommand(entityId, newParams, originalParams, sceneManager, true, sceneUnits);
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('opening', entityId);
}

/** Resolve the `OpeningEntity` a grip belongs to, or `null` when it isn't one (shared by both commits). */
function resolveOpeningEntity(grip: UnifiedGripInfo, sceneManager: ISceneManager): OpeningEntity | null {
  if (!grip.entityId) return null;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return null;
  const candidate = raw as unknown as Partial<OpeningEntity>;
  if (candidate.type !== 'opening' || !candidate.params) return null;
  return candidate as OpeningEntity;
}

/** Resolve a well-formed `WallEntity` host by id, or `null` (soft-orphan policy, ADR-363 §5.4). Shared by both commits. */
function resolveOpeningHostWall(sceneManager: ISceneManager, wallId: string | undefined): WallEntity | null {
  if (!wallId) return null;
  const hostRaw = sceneManager.getEntity(wallId);
  if (!hostRaw) return null;
  const hostCandidate = hostRaw as unknown as Partial<WallEntity>;
  if (hostCandidate.type !== 'wall' || !hostCandidate.params || !hostCandidate.geometry) return null;
  return hostCandidate as WallEntity;
}

/**
 * ADR-363 Phase 2.5 — Parametric opening grip commit (drag-along-wall).
 * Mirrors `commitWallGripDrag` semantics: routes through `applyOpeningGripDrag()`
 * + `UpdateOpeningParamsCommand` so geometry + validation recompute atomically
 * and the merge window (ADR-031) collapses a continuous drag into one undo
 * entry. Host wall is resolved via `params.wallId`; commit is a no-op when the
 * host is missing (soft-orphan policy, ADR-363 §5.4).
 *
 * ADR-615 — a self-hosted opening (`isSelfHostedOpening`) has no `wallId` to
 * resolve, so it short-circuits straight to `applyOpeningGripDrag` (which edits
 * `params.selfHost` directly) BEFORE the wall lookup below. The wall-hosted
 * path is unchanged.
 */
export function commitOpeningGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  const openingKind = gripKindOf(grip, 'opening');
  if (!grip.entityId || !openingKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const opening = resolveOpeningEntity(grip, sceneManager);
  if (!opening) return;
  const originalParams = opening.params;
  const currentPos: Point2D = translatePoint(grip.position, delta);

  if (isSelfHostedOpening(originalParams)) {
    // ADR-615 — free-standing opening = centred-box drag (move / rotate / resize).
    // Pass the world `delta` (grip → cursor); the box SSoT consumes deltas, not the
    // wall-axis-projected `currentPos`.
    const sceneUnits = resolveSelfHostedOpeningSceneUnits(deps);
    const newParams = applyOpeningGripDrag(openingKind, {
      originalParams,
      currentPos,
      delta,
      sceneUnits,
    });
    if (newParams === originalParams) return;
    commitOpeningParamsPatch(grip.entityId, newParams, originalParams, sceneManager, deps, sceneUnits);
    return;
  }

  const hostWall = resolveOpeningHostWall(sceneManager, originalParams.wallId);
  if (!hostWall) return;
  const newParams = applyOpeningGripDrag(openingKind, {
    originalParams,
    currentPos,
    hostWall,
  });
  if (newParams === originalParams) return;
  commitOpeningParamsPatch(grip.entityId, newParams, originalParams, sceneManager, deps);
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
 *
 * ADR-615 — a self-hosted opening skips `resolveOpeningAltMove` ENTIRELY (REHOST
 * is N/A without a wall to pick) and calls `applyOpeningAltSlide` directly for
 * the free 2D whole-object anchor translate. The wall-hosted path is unchanged.
 */
export function commitOpeningAltMove(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !gripKindOf(grip, 'opening')) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const opening = resolveOpeningEntity(grip, sceneManager);
  if (!opening) return;
  const originalParams = opening.params;

  if (isSelfHostedOpening(originalParams)) {
    const sceneUnits = resolveSelfHostedOpeningSceneUnits(deps);
    const newParams = applyOpeningAltSlide({
      originalParams,
      basePoint: grip.position,
      currentPos: translatePoint(grip.position, delta),
      sceneUnits,
    });
    if (newParams === originalParams) return;
    commitOpeningParamsPatch(grip.entityId, newParams, originalParams, sceneManager, deps, sceneUnits);
    return;
  }

  const currentHost = resolveOpeningHostWall(sceneManager, originalParams.wallId);
  if (!currentHost) return;
  const candidateWalls = ((sceneManager.getEntities?.() ?? []) as unknown as Entity[]).filter(isWallEntity);
  const resolved = resolveOpeningAltMove({
    originalParams,
    basePoint: grip.position,
    currentPos: translatePoint(grip.position, delta),
    currentHost,
    candidateWalls,
    rehostToleranceWorld: openingRehostToleranceWorld(currentHost),
  });
  if (!resolved) return;
  commitOpeningParamsPatch(grip.entityId, resolved.params, originalParams, sceneManager, deps);
}
