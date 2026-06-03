/**
 * SSOT — hosted-opening visibility filters (BimSceneLayer)
 *
 * Pure per-host filtering of wall openings / slab openings by the ADR-382
 * visibility intersection (V/G category + Layer + Floor + Building). Extracted
 * from `BimSceneLayer.ts` (2026-06-04 file-size split). No `this`, no state.
 *
 * @see bim-3d/scene/BimSceneLayer — consumer (syncWalls / syncSlabs)
 * @see ADR-382 — 2D⟷3D visibility parity
 * @see ADR-040 — Preview Canvas Performance (BimSceneLayer ownership)
 */

import type { SyncContext } from './bim-scene-context';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { getLayer } from '../../stores/LayerStore';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { BuildingVisMode } from '../utils/building-visibility-state';

/** Filter hosted openings by per-entity visibility (V/G + Layer + Floor + Building). */
export function filterHostedOpenings(
  openings: readonly OpeningEntity[],
  hostKey: 'wallId',
  hostId: string,
  parentBuildingMode: BuildingVisMode | undefined,
  ctx: SyncContext,
): readonly OpeningEntity[] {
  return openings.filter((o) =>
    o.params[hostKey] === hostId && resolveIsEntityVisible(
      { category: 'opening', layerId: o.layerId, discipline: o.discipline },
      {
        objectStyles: ctx.objectStyles,
        disciplineVisibility: ctx.disciplineVisibility,
        layer: o.layerId ? getLayer(o.layerId) : null,
        floorMode: ctx.floorMode,
        buildingMode: parentBuildingMode,
      },
    )
  );
}

export function filterHostedSlabOpenings(
  slabOpenings: readonly SlabOpeningEntity[],
  slabId: string,
  parentBuildingMode: BuildingVisMode | undefined,
  ctx: SyncContext,
): readonly SlabOpeningEntity[] {
  return slabOpenings.filter((o) =>
    o.params.slabId === slabId && resolveIsEntityVisible(
      { category: 'slab-opening', layerId: o.layerId, discipline: o.discipline },
      {
        objectStyles: ctx.objectStyles,
        disciplineVisibility: ctx.disciplineVisibility,
        layer: o.layerId ? getLayer(o.layerId) : null,
        floorMode: ctx.floorMode,
        buildingMode: parentBuildingMode,
      },
    )
  );
}
