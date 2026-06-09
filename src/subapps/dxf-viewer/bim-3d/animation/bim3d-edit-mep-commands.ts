'use client';

/**
 * bim3d-edit-mep-commands.ts — MEP per-type vertical-move command mapping (ADR-408 Φ-C).
 *
 * Extracted from `bim3d-edit-command-builders` (Google N.7.1 — the builders file crossed
 * 500 lines). Pure mapping: an MEP entity + a vertical (axis-Y) delta / explicit next
 * params → ONE `Update*ParamsCommand`. No React, no scene mutation, no dispatch.
 */

import type { Entity } from '../../types/entities';
import type { MepSegmentParams } from '../../bim/types/mep-segment-types';
import type { MepFixtureParams } from '../../bim/types/mep-fixture-types';
import type { MepManifoldParams } from '../../bim/types/mep-manifold-types';
import type { MepRadiatorParams } from '../../bim/types/mep-radiator-types';
import type { MepBoilerParams } from '../../bim/types/mep-boiler-types';
import type { MepWaterHeaterParams } from '../../bim/types/mep-water-heater-types';
import { UpdateMepSegmentParamsCommand } from '../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { UpdateMepFixtureParamsCommand } from '../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { UpdateMepManifoldParamsCommand } from '../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import { UpdateMepRadiatorParamsCommand } from '../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand';
import { UpdateMepBoilerParamsCommand } from '../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import { UpdateMepWaterHeaterParamsCommand } from '../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand';
import {
  computeMepHostVerticalMove,
  computeMepSegmentVerticalMove,
} from '../gizmo/bim3d-vertical-move';
import type { SceneManager } from './bim3d-edit-command-builders';

/** The per-type MEP `Update*ParamsCommand`s these builders emit (a subset of `EditCommand`). */
export type MepEditCommand =
  | UpdateMepSegmentParamsCommand
  | UpdateMepFixtureParamsCommand
  | UpdateMepManifoldParamsCommand
  | UpdateMepRadiatorParamsCommand
  | UpdateMepBoilerParamsCommand
  | UpdateMepWaterHeaterParamsCommand;

/**
 * ADR-408 Φ-C — vertical (axis-Y) move command for an MEP entity. Point hosts bump
 * `mountingElevationMm`; a pipe shifts both endpoint z's. Each routes through its own
 * `Update*ParamsCommand` (geometry recomputed atomically). `null` = non-MEP / no-op.
 */
export function mepVerticalCommand(entity: Entity, deltaUpMm: number, sm: SceneManager): MepEditCommand | null {
  if (entity.type === 'mep-segment') {
    const next = computeMepSegmentVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateMepSegmentParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'mep-fixture') {
    const next = computeMepHostVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateMepFixtureParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'mep-manifold') {
    const next = computeMepHostVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateMepManifoldParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'mep-radiator') {
    const next = computeMepHostVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateMepRadiatorParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'mep-boiler') {
    const next = computeMepHostVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateMepBoilerParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  if (entity.type === 'mep-water-heater') {
    const next = computeMepHostVerticalMove(entity.params, deltaUpMm);
    return next ? new UpdateMepWaterHeaterParamsCommand(entity.id, next, entity.params, sm, false) : null;
  }
  return null;
}

/** Per-type `Update*ParamsCommand` for an MEP entity from explicit next params (prev = current). */
export function mepUpdateCommandFromNext(entity: Entity, next: unknown, sm: SceneManager): MepEditCommand | null {
  switch (entity.type) {
    case 'mep-segment':      return new UpdateMepSegmentParamsCommand(entity.id, next as MepSegmentParams, entity.params, sm, false);
    case 'mep-fixture':      return new UpdateMepFixtureParamsCommand(entity.id, next as MepFixtureParams, entity.params, sm, false);
    case 'mep-manifold':     return new UpdateMepManifoldParamsCommand(entity.id, next as MepManifoldParams, entity.params, sm, false);
    case 'mep-radiator':     return new UpdateMepRadiatorParamsCommand(entity.id, next as MepRadiatorParams, entity.params, sm, false);
    case 'mep-boiler':       return new UpdateMepBoilerParamsCommand(entity.id, next as MepBoilerParams, entity.params, sm, false);
    case 'mep-water-heater': return new UpdateMepWaterHeaterParamsCommand(entity.id, next as MepWaterHeaterParams, entity.params, sm, false);
    default: return null;
  }
}

/** Next params for an MEP entity's vertical move (for the connectivity follow). */
export function mepVerticalNextParams(entity: Entity, deltaUpMm: number): unknown | null {
  if (entity.type === 'mep-segment') return computeMepSegmentVerticalMove(entity.params, deltaUpMm);
  if (
    entity.type === 'mep-fixture' ||
    entity.type === 'mep-manifold' ||
    entity.type === 'mep-radiator' ||
    entity.type === 'mep-boiler' ||
    entity.type === 'mep-water-heater'
  ) {
    return computeMepHostVerticalMove(entity.params, deltaUpMm);
  }
  return null;
}
