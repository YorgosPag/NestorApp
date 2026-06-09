'use client';

/**
 * bim3d-edit-shape-commands.ts — resize / tilt drag outcome → command (ADR-402/404).
 *
 * Extracted from `bim3d-edit-command-builders` (Google N.7.1 — that file crossed 500
 * lines). The two "shape edit" builders are siblings: each maps a SINGLE-entity gizmo
 * drag to ONE per-type `Update*ParamsCommand`, bridging to its compute SSoT (resize →
 * `bim3d-resize-bridge` ADR-402 Phase B, tilt → `bim3d-tilt-bridge` ADR-404 Phase 2).
 * No React, no scene mutation, no dispatch — the handler owns `execute()`.
 *
 * The `CommandBuildCtx` / `EditCommand` types are `import type`-only from the parent
 * module, so there is NO runtime import cycle (the parent imports these builders).
 */

import type { CommandBuildCtx, EditCommand } from './bim3d-edit-command-builders';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import {
  computeColumnResizeParams,
  computeWallResizeParams,
  computeBeamResizeParams,
  computeSlabResizeParams,
  computeStairResizeParams,
  type ResizeDragMm,
} from '../gizmo/bim3d-resize-bridge';
import {
  computeColumnTiltParams,
  computeWallTiltParams,
  computeBeamTiltParams,
  computeSlabTiltParams,
  type TiltDragDeg,
} from '../gizmo/bim3d-tilt-bridge';

type ResizeOutcome = Extract<BridgeOutcome, { kind: 'resize' }>;
type TiltOutcome = Extract<BridgeOutcome, { kind: 'tilt' }>;

/**
 * Tilt → per-type `Update*ParamsCommand`, bridging to the tilt SSoT
 * (`bim3d-tilt-bridge`, ADR-404 Phase 2). Reuses the SAME view-agnostic commands as
 * resize (column/wall `tilt`, beam `topElevationEnd`, slab `slope`+`geometryType`) —
 * NO new command. `null` = no-op / roll ring / unsupported type (stair has no tilt).
 */
export function buildTiltCommand(outcome: TiltOutcome, c: CommandBuildCtx): EditCommand | null {
  const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
  if (!entity) return null;
  const drag: TiltDragDeg = { axis: outcome.axis, angleDeg: outcome.angleDeg };
  if (entity.type === 'column') {
    const next = computeColumnTiltParams(entity.params, drag);
    return next ? new UpdateColumnParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'wall') {
    const next = computeWallTiltParams(entity.params, drag);
    return next
      ? new UpdateWallParamsCommand(c.entityId, next, entity.params, c.sm, false, entity.kind ?? 'straight')
      : null;
  }
  if (entity.type === 'beam') {
    const next = computeBeamTiltParams(entity.params, drag);
    return next ? new UpdateBeamParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'slab') {
    const next = computeSlabTiltParams(entity.params, drag);
    return next ? new UpdateSlabParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  return null;
}

/**
 * Resize → per-type `Update*ParamsCommand`, bridging to the resize SSoT
 * (`bim3d-resize-bridge`, ADR-402 Phase B). Plan axes (X/Z) delegate to the 2D
 * grip-drag SSoT; axis-Y patches the element's vertical field. column/wall/beam/
 * slab ship in Phase B; stair (plan width / run, ADR-402 Sub-Phase 1) reuses the
 * 2D stair grip SSoT. `null` = no-op drag / unsupported axis for the type.
 */
export function buildResizeCommand(outcome: ResizeOutcome, c: CommandBuildCtx): EditCommand | null {
  const entity = c.levels.getLevelScene(c.levelId)?.entities?.find((e) => e.id === c.entityId);
  if (!entity) return null;
  const drag: ResizeDragMm = {
    axis: outcome.axis,
    mode: outcome.mode,
    deltaMm: outcome.deltaMm,
    deltaUpMm: outcome.deltaUpMm,
    cursorMm: outcome.cursorMm,
  };
  if (entity.type === 'column') {
    const next = computeColumnResizeParams(entity.params, drag);
    return next ? new UpdateColumnParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'wall') {
    const next = computeWallResizeParams(entity.params, drag);
    return next
      ? new UpdateWallParamsCommand(c.entityId, next, entity.params, c.sm, false, entity.kind ?? 'straight')
      : null;
  }
  if (entity.type === 'beam') {
    const next = computeBeamResizeParams(entity.params, drag);
    return next ? new UpdateBeamParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'slab') {
    const next = computeSlabResizeParams(entity.params, drag);
    return next ? new UpdateSlabParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  if (entity.type === 'stair') {
    // ADR-402 Sub-Phase 1 — stair needs the full entity (geometry is the anchor SSoT).
    const next = computeStairResizeParams(entity, drag);
    return next ? new UpdateStairParamsCommand(c.entityId, next, entity.params, c.sm, false) : null;
  }
  return null;
}
