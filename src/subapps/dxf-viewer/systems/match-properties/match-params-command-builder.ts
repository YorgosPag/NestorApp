/**
 * ADR-581 — Κοινός per-kind params command builder (SSoT).
 *
 * Εξάχθηκε (boy-scout, N.0.2) από το ιδιωτικό `buildSingleUpdateCommand` switch του
 * `bim/cascade/bim-bulk-update-builder.ts`, ώστε ΚΑΙ το multi-selection bulk-edit ΚΑΙ
 * ο Match/Transfer applier να μοιράζονται ΕΝΑ μόνο σημείο kind→`Update{Kind}ParamsCommand`.
 *
 * Παίρνει μια οντότητα + top-level params patch → φτιάχνει (δεν εκτελεί) το σωστό
 * per-kind command, το οποίο ξαναϋπολογίζει geometry+validation ατομικά. Ο caller
 * καλεί `commandHistory.executeCommand` ΚΑΙ (για BIM) `emitBimEntityParamsUpdated`.
 *
 * ΠΡΟΣΟΧΗ: το patch merge είναι FLAT (`{...prev, ...patch}`) — ασφαλές ΜΟΝΟ για
 * top-level params keys. Nested objects (reinforcement/finish/tilt) ΔΕΝ περνούν από εδώ.
 */

import type { ISceneManager, SceneEntity, ICommand } from '../../core/commands/interfaces';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import type { WallParams, WallKind } from '../../bim/types/wall-types';
import type { OpeningParams } from '../../bim/types/opening-types';
import type { SlabParams } from '../../bim/types/slab-types';
import type { ColumnParams } from '../../bim/types/column-types';
import type { BeamParams } from '../../bim/types/beam-types';
import type { StairParams } from '../../bim/types/stair-types';
import type { EntityType } from '../../types/entities';

/** Top-level params patch — flat merge only (βλ. header warning). */
export type ParamsPatch = Readonly<Record<string, unknown>>;

/** True αν ο τύπος υποστηρίζεται από τον κοινό builder (BIM parametric kinds). */
export function isParamsCommandKind(type: EntityType): boolean {
  return (
    type === 'wall' || type === 'opening' || type === 'slab' ||
    type === 'column' || type === 'beam' || type === 'stair'
  );
}

/**
 * Φτιάχνει το per-kind params command για μια οντότητα + patch. `null` αν ο τύπος
 * δεν υποστηρίζεται ή λείπουν τα params (defensive — scene races).
 */
export function buildParamsUpdateCommand(
  entity: SceneEntity,
  patch: ParamsPatch,
  sm: ISceneManager,
): ICommand | null {
  const kind = entity.type as EntityType;
  switch (kind) {
    case 'wall':    return buildWallCommand(entity, patch, sm);
    case 'opening': return buildOpeningCommand(entity, patch, sm);
    case 'slab':    return buildSlabCommand(entity, patch, sm);
    case 'column':  return buildColumnCommand(entity, patch, sm);
    case 'beam':    return buildBeamCommand(entity, patch, sm);
    case 'stair':   return buildStairCommand(entity, patch, sm);
    default:        return null;
  }
}

function buildWallCommand(entity: SceneEntity, patch: ParamsPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as WallParams | undefined;
  if (!prev) return null;
  const next: WallParams = { ...prev, ...patch } as WallParams;
  const wallKind = (entity as unknown as { kind?: WallKind }).kind ?? 'straight';
  return new UpdateWallParamsCommand(entity.id, next, prev, sm, false, wallKind);
}

function buildOpeningCommand(entity: SceneEntity, patch: ParamsPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as OpeningParams | undefined;
  if (!prev) return null;
  const next: OpeningParams = { ...prev, ...patch } as OpeningParams;
  return new UpdateOpeningParamsCommand(entity.id, next, prev, sm, false);
}

function buildSlabCommand(entity: SceneEntity, patch: ParamsPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as SlabParams | undefined;
  if (!prev) return null;
  const next: SlabParams = { ...prev, ...patch } as SlabParams;
  return new UpdateSlabParamsCommand(entity.id, next, prev, sm, false);
}

function buildColumnCommand(entity: SceneEntity, patch: ParamsPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as ColumnParams | undefined;
  if (!prev) return null;
  const next: ColumnParams = { ...prev, ...patch } as ColumnParams;
  return new UpdateColumnParamsCommand(entity.id, next, prev, sm, false);
}

function buildBeamCommand(entity: SceneEntity, patch: ParamsPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as BeamParams | undefined;
  if (!prev) return null;
  const next: BeamParams = { ...prev, ...patch } as BeamParams;
  return new UpdateBeamParamsCommand(entity.id, next, prev, sm, false);
}

function buildStairCommand(entity: SceneEntity, patch: ParamsPatch, sm: ISceneManager): ICommand | null {
  const prev = entity.params as StairParams | undefined;
  if (!prev) return null;
  const next: StairParams = { ...prev, ...patch } as StairParams;
  return new UpdateStairParamsCommand(entity.id, next, prev, sm, false);
}
