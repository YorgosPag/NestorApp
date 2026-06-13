/**
 * bim-scene-structural-finish-sync — ADR-449 Slice 7 scene-level ΕΝΙΑΙΟΣ σοβάς.
 *
 * Extracted from `BimSceneLayer` (file-size SSoT N.7.1). Free function mirroring
 * the `syncWalls` / `syncColumns` pattern: takes the target group, the floor's
 * entities, the sync context and a bound `resolveEntity` callback.
 */

import type * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { SyncContext } from './bim-scene-context';
import type { EntityResolution } from './BimSceneLayer';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import { isStructuralFinishVisible } from '../../bim/finishes/structural-finish-visibility';
import { computeStructuralFinishSilhouette } from '../../bim/finishes/structural-finish-scene';
import { buildStructuralSilhouetteSkin } from '../converters/structural-finish-silhouette-3d';

type ResolveEntity = (
  entity: { id?: string; layerId?: string; discipline?: Discipline },
  category: BimCategory,
  ctx: SyncContext,
) => EntityResolution | null;

/**
 * ADR-449 Slice 7 — ΕΝΑ scene-level pass για τον ΕΝΙΑΙΟ σοβά (merged silhouette):
 * ενώνει τα δομικά cores (κολόνες+δοκάρια) ανά ζώνη ύψους και offset-άρει ΜΙΑ φορά →
 * coplanar + connected στις συμβολές (αντικαθιστά τα per-element skins, που τα
 * converters παραλείπουν με `suppressFinishSkin`). Group ανά κτίριο (baseElevation =
 * world datum). Walls = obstacles (όλοι, όπως το per-element). No-op όταν ο σοβάς
 * είναι view-hidden ή δεν υπάρχουν ορατά δομικά μέλη.
 */
export function syncStructuralFinishSkin(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolve: ResolveEntity,
): void {
  if (!isStructuralFinishVisible()) return;
  const groups = new Map<string, { baseElevation: number; columns: ColumnEntity[]; beams: BeamEntity[] }>();
  const groupFor = (buildingId: string, baseElevation: number) => {
    let g = groups.get(buildingId);
    if (!g) { g = { baseElevation, columns: [], beams: [] }; groups.set(buildingId, g); }
    return g;
  };
  for (const column of entities.columns) {
    const r = resolve(column, 'column', ctx);
    if (r) groupFor(r.buildingId, r.baseElevation).columns.push(column);
  }
  for (const beam of entities.beams) {
    const r = resolve(beam, 'beam', ctx);
    if (r) groupFor(r.buildingId, r.baseElevation).beams.push(beam);
  }
  for (const [buildingId, g] of groups) {
    const bands = computeStructuralFinishSilhouette(g.columns, g.beams, entities.walls, ctx.floorElevationMm);
    const sceneUnits = g.columns[0]?.params.sceneUnits ?? g.beams[0]?.params.sceneUnits ?? 'mm';
    const skin = buildStructuralSilhouetteSkin(
      bands, sceneUnits, g.baseElevation, ctx.activeLevelId, `structural-finish-${buildingId}`,
    );
    if (skin) { skin.userData['buildingId'] = buildingId; group.add(skin); }
  }
}
