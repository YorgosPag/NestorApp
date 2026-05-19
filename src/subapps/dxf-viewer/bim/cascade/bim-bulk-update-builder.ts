/**
 * ADR-363 Phase 7.1 Step 6.6 — Bulk update command builder για multi-selection.
 *
 * Παίρνει `ids[]` + `patch` (partial subset των editable numeric props) και
 * δημιουργεί CompoundCommand που πατάει το patch σε κάθε entity με τον σωστό
 * per-kind Update*ParamsCommand. Single undo step.
 *
 * Skip rules:
 *  - Entity missing από scene → skip silently (defensive, scene races)
 *  - Patch key δεν αντιστοιχεί σε editable property του kind → skip το key
 *  - Όλες οι patch keys skipped για το entity → entity δεν παράγει command
 *  - Patch empty → returns CompoundCommand άδειο (no-op execute)
 *
 * @see bim-common-properties.ts SSoT για το «τι είναι editable per kind»
 * @see CompoundCommand atomic execution + rollback
 */

import type { ISceneManager, SceneEntity, ICommand } from '../../core/commands/interfaces';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import type { WallParams, WallKind } from '../types/wall-types';
import type { OpeningParams } from '../types/opening-types';
import type { SlabParams } from '../types/slab-types';
import type { ColumnParams } from '../types/column-types';
import type { BeamParams } from '../types/beam-types';
import type { StairParams } from '../types/stair-types';
import {
  COMMON_PROPERTIES_BY_KIND,
  type BimEditablePropertyKey,
} from '../types/bim-common-properties';
import type { EntityType } from '../../types/entities';

export type BimBulkEditPatch = Readonly<Partial<Record<BimEditablePropertyKey, number>>>;

/**
 * Φτιάχνει `CompoundCommand` που πατάει το `patch` σε κάθε entity από τα `ids`.
 * Δεν εκτελεί το command — caller καλεί `commandHistory.executeCommand(cmd)`.
 */
export function buildBulkUpdateCommand(
  ids: readonly string[],
  patch: BimBulkEditPatch,
  sceneManager: ISceneManager,
): CompoundCommand {
  const commands: ICommand[] = [];
  for (const id of ids) {
    const entity = sceneManager.getEntity(id);
    if (!entity) continue;
    const cmd = buildSingleUpdateCommand(entity, patch, sceneManager);
    if (cmd) commands.push(cmd);
  }
  return new CompoundCommand(`Bulk Update (${commands.length} entities)`, commands);
}

// ─── Per-kind dispatch ───────────────────────────────────────────────────────

function buildSingleUpdateCommand(
  entity: SceneEntity,
  patch: BimBulkEditPatch,
  sceneManager: ISceneManager,
): ICommand | null {
  const kind = entity.type as EntityType;
  const filteredPatch = filterPatchForKind(kind, patch);
  if (filteredPatch === null) return null;

  switch (kind) {
    case 'wall':         return buildWallCommand(entity, filteredPatch, sceneManager);
    case 'opening':      return buildOpeningCommand(entity, filteredPatch, sceneManager);
    case 'slab':         return buildSlabCommand(entity, filteredPatch, sceneManager);
    case 'column':       return buildColumnCommand(entity, filteredPatch, sceneManager);
    case 'beam':         return buildBeamCommand(entity, filteredPatch, sceneManager);
    case 'stair':        return buildStairCommand(entity, filteredPatch, sceneManager);
    // slab-opening: registry empty για Phase 7.1 — δεν φτάνει εδώ μέσω filteredPatch.
    default:             return null;
  }
}

/** Επιστρέφει patch περιορισμένο σε editable keys του kind, ή null αν τίποτα δεν εφαρμόζεται. */
function filterPatchForKind(
  kind: EntityType,
  patch: BimBulkEditPatch,
): BimBulkEditPatch | null {
  const editable = COMMON_PROPERTIES_BY_KIND[kind];
  if (!editable || editable.length === 0) return null;
  const allowedKeys = new Set(editable.map((p) => p.key));
  const filtered: Partial<Record<BimEditablePropertyKey, number>> = {};
  let hasAny = false;
  for (const [key, value] of Object.entries(patch) as [BimEditablePropertyKey, number][]) {
    if (allowedKeys.has(key)) {
      filtered[key] = value;
      hasAny = true;
    }
  }
  return hasAny ? filtered : null;
}

// ─── Per-kind builders (each reads current params, merges patch immutably) ───

function buildWallCommand(entity: SceneEntity, patch: BimBulkEditPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as WallParams | undefined;
  if (!prev) return null;
  const next: WallParams = { ...prev, ...patch } as WallParams;
  const wallKind = (entity as unknown as { kind?: WallKind }).kind ?? 'straight';
  return new UpdateWallParamsCommand(entity.id, next, prev, sm, false, wallKind);
}

function buildOpeningCommand(entity: SceneEntity, patch: BimBulkEditPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as OpeningParams | undefined;
  if (!prev) return null;
  const next: OpeningParams = { ...prev, ...patch } as OpeningParams;
  return new UpdateOpeningParamsCommand(entity.id, next, prev, sm, false);
}

function buildSlabCommand(entity: SceneEntity, patch: BimBulkEditPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as SlabParams | undefined;
  if (!prev) return null;
  const next: SlabParams = { ...prev, ...patch } as SlabParams;
  return new UpdateSlabParamsCommand(entity.id, next, prev, sm, false);
}

function buildColumnCommand(entity: SceneEntity, patch: BimBulkEditPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as ColumnParams | undefined;
  if (!prev) return null;
  const next: ColumnParams = { ...prev, ...patch } as ColumnParams;
  return new UpdateColumnParamsCommand(entity.id, next, prev, sm, false);
}

function buildBeamCommand(entity: SceneEntity, patch: BimBulkEditPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as BeamParams | undefined;
  if (!prev) return null;
  const next: BeamParams = { ...prev, ...patch } as BeamParams;
  return new UpdateBeamParamsCommand(entity.id, next, prev, sm, false);
}

function buildStairCommand(entity: SceneEntity, patch: BimBulkEditPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as StairParams | undefined;
  if (!prev) return null;
  const next: StairParams = { ...prev, ...patch } as StairParams;
  return new UpdateStairParamsCommand(entity.id, next, prev, sm, false);
}
