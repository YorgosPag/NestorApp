'use client';

/**
 * ADR-452 — useCutPlaneRange: reactive cut-plane slider range, scope-aware.
 *
 * - Single-floor scope (2D, or 3D «ενεργός όροφος»): FFL-relative range
 *   `0 … storeyHeightMm` of the active storey (Revit per-level View Range).
 * - «Όλοι οι όροφοι» scope (3D `floor3DScope === 'all'`): the range spans the
 *   actual occupied vertical envelope across every floor that carries DXF **or**
 *   BIM entities — from the lowest material bottom (incl. πέδιλα that hang below
 *   their FFL) to the highest material top (Giorgio 2026-06-20). Occupancy +
 *   geometry are read from the EXISTING multi-floor stacks (`multi-floor-3d-source`
 *   + `multi-floor-dxf-source`); per-entity Z reuses the render-path SSoT
 *   `getEntityZExtents` — no new aggregation, no duplicate Z math.
 *
 * Pure range math lives in `./cut-plane-range` (single) + `./multi-floor-cut-range`
 * (all-floors). Returns `null` when nothing is in scope (slider hides).
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useActiveStoreyContext } from '../../systems/levels/useActiveStoreySync';
import { useViewMode3DStore, selectIs3D, selectFloor3DScope } from '../../bim-3d/stores/ViewMode3DStore';
import {
  getMultiFloorStack,
  subscribeMultiFloorStack,
  type FloorStackEntry,
} from '../../bim-3d/scene/multi-floor-3d-source';
import {
  getMultiFloorDxfStack,
  subscribeMultiFloorDxfStack,
  type DxfFloorStackEntry,
} from '../../bim-3d/scene/multi-floor-dxf-source';
import { DEFAULT_STOREY_HEIGHT_MM } from '../../systems/levels/active-storey-context';
import { getEntityZExtents } from '../../bim/visibility/entity-z-extents';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { computeCutPlaneRange, type CutPlaneRange } from './cut-plane-range';
import { computeMultiFloorCutRange, type FloorCutExtent } from './multi-floor-cut-range';

export type { CutPlaneRange } from './cut-plane-range';

/**
 * Resolve one floor's occupied vertical envelope (datum-relative mm) from its BIM
 * bundle + DXF occupancy. Each BIM entity's floor-relative Z (render-path SSoT
 * `getEntityZExtents`) is lifted into the datum frame by adding the floor's FFL.
 * The storey band `[ffl, ceiling]` seeds the envelope so DXF-only floors and any
 * entity with no Z extent still contribute their floor's full height.
 */
function resolveFloorExtent(
  bim: FloorStackEntry,
  dxfNonEmpty: boolean,
  fallbackStoreyHeightMm: number,
): FloorCutExtent {
  const ffl = bim.floorElevationMm;
  const ceiling =
    typeof bim.nextFloorElevationMm === 'number' && Number.isFinite(bim.nextFloorElevationMm)
      ? bim.nextFloorElevationMm
      : ffl + fallbackStoreyHeightMm;

  const entities = Object.values(bim.entities).flat() as DxfEntityUnion[];
  const hasEntities = entities.length > 0 || dxfNonEmpty;
  if (!hasEntities) return { hasEntities: false, minMm: 0, maxMm: 0 };

  // Seed with the storey band (covers DXF-only floors + null-extent entities).
  let minMm = Math.min(ffl, ceiling);
  let maxMm = Math.max(ffl, ceiling);
  for (const e of entities) {
    const ext = getEntityZExtents(e);
    if (!ext) continue;
    const lo = ffl + ext.zBottomMm;
    const hi = ffl + ext.zTopMm;
    if (lo < minMm) minMm = lo;
    if (hi > maxMm) maxMm = hi;
  }
  return { hasEntities: true, minMm, maxMm };
}

/** Merge the BIM + DXF multi-floor stacks into per-floor extents keyed by levelId. */
function buildFloorCutExtents(
  bim: readonly FloorStackEntry[],
  dxf: readonly DxfFloorStackEntry[],
  fallbackStoreyHeightMm: number,
): FloorCutExtent[] {
  const dxfNonEmptyByLevel = new Map<string, boolean>();
  for (const d of dxf) {
    dxfNonEmptyByLevel.set(d.levelId, (d.scene.entities?.length ?? 0) > 0);
  }

  const seenLevels = new Set<string>();
  const out: FloorCutExtent[] = [];
  for (const b of bim) {
    seenLevels.add(b.levelId);
    out.push(resolveFloorExtent(b, dxfNonEmptyByLevel.get(b.levelId) ?? false, fallbackStoreyHeightMm));
  }

  // DXF-only floors (no BIM stack entry): contribute their flat plan elevation.
  for (const d of dxf) {
    if (seenLevels.has(d.levelId)) continue;
    if ((d.scene.entities?.length ?? 0) === 0) continue;
    out.push({ hasEntities: true, minMm: d.floorElevationMm, maxMm: d.floorElevationMm + fallbackStoreyHeightMm });
  }

  return out;
}

/** Reactive hook: cut-plane range (single storey, or whole occupied stack). */
export function useCutPlaneRange(): CutPlaneRange | null {
  const storey = useActiveStoreyContext();
  const is3D = useViewMode3DStore(selectIs3D);
  const scope = useViewMode3DStore(selectFloor3DScope);
  const allFloors = is3D && scope === 'all';

  const bimStack = useSyncExternalStore(subscribeMultiFloorStack, getMultiFloorStack, getMultiFloorStack);
  const dxfStack = useSyncExternalStore(subscribeMultiFloorDxfStack, getMultiFloorDxfStack, getMultiFloorDxfStack);

  const storeyHeightMm = storey?.storeyHeightMm ?? null;

  return useMemo(() => {
    if (allFloors) {
      return computeMultiFloorCutRange(
        buildFloorCutExtents(bimStack, dxfStack, storeyHeightMm ?? DEFAULT_STOREY_HEIGHT_MM),
      );
    }
    return computeCutPlaneRange(storeyHeightMm);
  }, [allFloors, bimStack, dxfStack, storeyHeightMm]);
}
