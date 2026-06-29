'use client';

/**
 * ADR-408 Φ-D/Φ1 — per-endpoint shape-handle placement for a single-select LINEAR
 * element (Revit shape handles at each axis end). Extracted from
 * `bim3d-edit-interaction-handlers` (file-size N.7.1). Pure, ctx-driven leaves called
 * by `refreshLinearEndpointHandles` after the gizmo anchor is set.
 */

import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
// ADR-408 Φ-D — endpoint shape handles: world positions of a segment's two axis ends.
import { segmentAxisEndpointsWorld } from '../converters/mep-segment-to-mesh';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

// ADR-535 Φ8/Φ9 — wall/beam no longer expose endpoint rings (their length+ends are the 2D
// reshape grips); the `refreshStructuralEndpointHandles` positioner + its `linearEndpointHandleWorld`
// SSoT were removed as dead code. Only the free-3D pipe positioner below remains.

/** MEP pipe end handles (free-3D, per-endpoint elevation — the run may slope). */
export function refreshSegmentEndpointHandles(ctx: EditInteractionCtx, id: string): void {
  const s = useBim3DEntitiesStore.getState();
  const segment = s.mepSegments.find((seg) => seg.id === id);
  if (!segment) {
    ctx.overlay.setEndpointHandles(null, null);
    return;
  }
  const baseElevationM = resolveEntityBuilding(segment, s.floors, s.buildings)?.baseElevation ?? 0;
  const { startW, endW } = segmentAxisEndpointsWorld(segment.params, baseElevationM);
  ctx.overlay.setEndpointHandles(startW, endW, 'free-3d');
}
