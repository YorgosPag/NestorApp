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
import { computeStructuralHorizontalFinishFaces } from '../../bim/finishes/structural-finish-scene-horizontal';
import { buildHorizontalFinishSkin } from '../converters/structural-finish-horizontal-3d';
import type { SceneUnits } from '../../utils/scene-units';

/**
 * ADR-449 Slice X1 — η ενιαία silhouette είναι **ΕΝΕΡΓΗ** (αντικαθιστά το per-element 3D σκιν):
 * ένα συνεχές δέρμα σοβά τυλίγει τη συνολική σιλουέτα του μπετόν ανά ζώνη ύψους → μηδέν
 * αλληλοδιείσδυση/overlap (η v3 corner-fill-via-overlap του Slice 10) και μηδέν διπλή γραμμή
 * στις συμβολές κολόνα↔δοκάρι (Giorgio 2026-06-14). Λύνει ΚΑΙ center-justified (το union των
 * finish bands δεν τους ένωνε — 75mm inset).
 *
 * Το παλιό «μία όψη μόνο» bug (Slice 7-revert) **ΔΕΝ ήταν τοπολογικό**: ήταν naive wall coverage
 * (un-dilated, height-unaware) — οι grid τοίχοι είναι **ταυτόσημοι σε κάτοψη** με τα δοκάρια
 * (ίδιος άξονας/πάχος) κι έτρωγαν τη μία όψη. Διορθώθηκε με port των Slice 8/8b: height-aware
 * `WallObstacle` z-extents (attached-top στήριγμα → resolved top = beam underside → εκτός της
 * ζώνης δοκαριού). Βλ. `structural-finish-silhouette.ts` + `structural-finish-scene-silhouette.ts`.
 */
const STRUCTURAL_SILHOUETTE_ENABLED: boolean = true;

type ResolveEntity = (
  entity: { id?: string; layerId?: string; discipline?: Discipline },
  category: BimCategory,
  ctx: SyncContext,
) => EntityResolution | null;

/**
 * ADR-449 Slice 7 — ΕΝΑ scene-level pass για τον ΕΝΙΑΙΟ σοβά (merged silhouette):
 * ενώνει τα δομικά cores (κολόνες+δοκάρια) ανά ζώνη ύψους και offset-άρει ΜΙΑ φορά →
 * coplanar + connected στις συμβολές. Group ανά κτίριο (baseElevation = world datum).
 * Walls = height-aware obstacles (Slice X1). **Slice X1: ΕΝΕΡΓΟ** πίσω από
 * `STRUCTURAL_SILHOUETTE_ENABLED` — αντικαθιστά το per-element 3D σκιν (τα scene converters
 * δίνουν πλέον `suppressFinishSkin=true`). No-op όταν disabled, view-hidden ή χωρίς δομικά μέλη.
 */
export function syncStructuralFinishSkin(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolve: ResolveEntity,
): void {
  // ADR-449 Slice X1 — ΕΝΕΡΓΟ· no-op μόνο όταν ο διακόπτης «Σοβατισμένη όψη» είναι κλειστός.
  if (!STRUCTURAL_SILHOUETTE_ENABLED || !isStructuralFinishVisible()) return;
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
    addHorizontalFinish(group, g, entities, ctx, buildingId, sceneUnits);
  }
}

/**
 * ADR-449 Slice 11 — εκτεθειμένες ΟΡΙΖΟΝΤΙΕΣ όψεις (κολόνα top/base cap, δοκάρι top/soffit)
 * ως λεπτές per-element πλάκες σοβά. Συμπληρωματικό του ενιαίου (κατακόρυφου) silhouette:
 * coverage = γεωμετρική (πλάκα/δοκάρι από πάνω, τοίχος από κάτω) → associative (μπει πλάκα
 * → re-sync → εξαφανίζεται). Μη-pickable (derived διακόσμηση). Walls/slabs = όλου του ορόφου
 * (geometric bbox+overlap φιλτράρει cross-building).
 */
function addHorizontalFinish(
  group: THREE.Group,
  g: { baseElevation: number; columns: ColumnEntity[]; beams: BeamEntity[] },
  entities: Bim3DEntities,
  ctx: SyncContext,
  buildingId: string,
  sceneUnits: SceneUnits,
): void {
  const { columnFaces, beamFaces } = computeStructuralHorizontalFinishFaces({
    columns: g.columns,
    beams: g.beams,
    walls: entities.walls,
    slabs: entities.slabs,
    beamObstacles: g.beams,
    floorElevationMm: ctx.floorElevationMm,
  });
  const colSkin = buildHorizontalFinishSkin(
    columnFaces, 'column', g.baseElevation, sceneUnits, ctx.activeLevelId, `structural-finish-hcol-${buildingId}`,
  );
  if (colSkin) { colSkin.userData['buildingId'] = buildingId; group.add(colSkin); }
  const beamSkin = buildHorizontalFinishSkin(
    beamFaces, 'beam', g.baseElevation, sceneUnits, ctx.activeLevelId, `structural-finish-hbeam-${buildingId}`,
  );
  if (beamSkin) { beamSkin.userData['buildingId'] = buildingId; group.add(beamSkin); }
}
