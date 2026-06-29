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
// ADR-408 Φ1 — structural length handles (wall/beam): horizontal endpoint world SSoT.
import { linearEndpointHandleWorld } from '../gizmo/linear-endpoint-world';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

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

/** Wall/beam LENGTH handles (horizontal; both ends at the gizmo-anchor Y). */
export function refreshStructuralEndpointHandles(ctx: EditInteractionCtx, id: string, bimType: 'wall' | 'beam'): void {
  const s = useBim3DEntitiesStore.getState();
  const worldY = ctx.overlay.getPosition().y;
  const wall = bimType === 'wall' ? s.walls.find((w) => w.id === id) : undefined;
  if (wall) {
    const { startW, endW } = linearEndpointHandleWorld(wall.params.start, wall.params.end, wall.params.sceneUnits, worldY);
    ctx.overlay.setEndpointHandles(startW, endW, 'horizontal');
    return;
  }
  const beam = bimType === 'beam' ? s.beams.find((b) => b.id === id) : undefined;
  if (beam) {
    const { startW, endW } = linearEndpointHandleWorld(beam.params.startPoint, beam.params.endPoint, beam.params.sceneUnits, worldY);
    ctx.overlay.setEndpointHandles(startW, endW, 'horizontal');
    return;
  }
  ctx.overlay.setEndpointHandles(null, null);
}
