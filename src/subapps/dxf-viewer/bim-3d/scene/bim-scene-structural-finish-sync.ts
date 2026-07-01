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
import type { WallEntity } from '../../bim/types/wall-types';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import { isStructuralFinishVisible } from '../../bim/finishes/structural-finish-visibility';
import { isColumnTilted } from '../../bim/geometry/column-tilt';
import { isBeamTilted } from '../../bim/geometry/beam-slope';
import { isWallTilted } from '../../bim/geometry/wall-tilt';
import { computeStructuralFinishSilhouette } from '../../bim/finishes/structural-finish-scene';
import type { ColumnVerticalExtentLookup } from '../../bim/finishes/structural-finish-scene-silhouette';
import { buildStructuralSilhouetteSkin } from '../converters/structural-finish-silhouette-3d';
import { computeStructuralHorizontalFinishFaces, computeMergedStructuralTopCap } from '../../bim/finishes/structural-finish-scene-horizontal';
import { buildHorizontalFinishSkin } from '../converters/structural-finish-horizontal-3d';
import { buildColumnVerticalExtentLookup, makeColumnHostResolver } from '../../bim/geometry/column-vertical-profile';
import { buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';
import { buildCeilingSlabHosts, resolveMemberTopClipZmm } from './monolithic-slab-clip';
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
  // ADR-449 height-SSoT — pre-resolved κατακόρυφο εύρος ανά κολώνα, ΙΔΙΑ SSoT με τον
  // rendered πυρήνα (`syncColumns`): storey-ceiling κολώνα → top = nextFloorElevationMm,
  // ΟΧΙ raw `params.height`. Έτσι σοβάς (silhouette + caps/soffit) = πυρήνας πάντα.
  const columnExtents = buildColumnVerticalExtents(entities, ctx);
  // ADR-534 Φ3c-B3b — soffit top-clip ανά δοκό (ΙΔΙΑ SSoT με το ορατό στερεό): όπου μονολιθική
  // πλάκα καλύπτει τη δοκό, η κορυφή του σοβά κόβεται στο soffit (μηδέν προεξοχή στην πλάκα).
  const beamTopClipById = buildBeamTopClipById(entities);
  const groups = new Map<string, { baseElevation: number; columns: ColumnEntity[]; beams: BeamEntity[]; walls: WallEntity[] }>();
  const groupFor = (buildingId: string, baseElevation: number) => {
    let g = groups.get(buildingId);
    if (!g) { g = { baseElevation, columns: [], beams: [], walls: [] }; groups.set(buildingId, g); }
    return g;
  };
  // ADR-404 Bug A — τα κεκλιμένα μέλη ΕΞΑΙΡΟΥΝΤΑΙ από το flat merged union: ένας ενιαίος
  // silhouette δεν μπορεί να shear-αριστεί ανά μέλος, οπότε ένα tilted μέλος θα έμενε
  // κάθετο. Παίρνουν per-element σοβά (που ακολουθεί την κλίση) στο column/beam sync —
  // εκεί το `suppressFinishSkin` είναι false ακριβώς για τα tilted. Επίπεδα → union (μηδέν regression).
  for (const column of entities.columns) {
    if (isColumnTilted(column.params)) continue;
    const r = resolve(column, 'column', ctx);
    if (r) groupFor(r.buildingId, r.baseElevation).columns.push(column);
  }
  for (const beam of entities.beams) {
    if (isBeamTilted(beam.params)) continue;
    const r = resolve(beam, 'beam', ctx);
    if (r) groupFor(r.buildingId, r.baseElevation).beams.push(beam);
  }
  // ADR-449 Slice X3 — ο τοίχος είναι finish-member (όχι μόνο obstacle): μπαίνει στο group
  // του κτιρίου του ώστε να ενωθεί με τα δομικά μέλη στο union (σοβάς τυλίγει + σβήνει στις
  // συμβολές) ΚΑΙ ένας μεμονωμένος τοίχος (χωρίς κολόνες/δοκάρια) να παράγει σοβά. Tilted
  // τοίχοι εξαιρούνται από το flat union (ADR-404, mirror columns/beams) — DNA lines ως πριν.
  for (const wall of entities.walls) {
    if (isWallTilted(wall.params)) continue;
    const r = resolve(wall, 'wall', ctx);
    if (r) groupFor(r.buildingId, r.baseElevation).walls.push(wall);
  }
  for (const [buildingId, g] of groups) {
    const bands = computeStructuralFinishSilhouette(g.columns, g.beams, g.walls, ctx.floorElevationMm, columnExtents, false, beamTopClipById);
    const sceneUnits = g.columns[0]?.params.sceneUnits ?? g.beams[0]?.params.sceneUnits ?? g.walls[0]?.params.sceneUnits ?? 'mm';
    const skin = buildStructuralSilhouetteSkin(
      bands, sceneUnits, g.baseElevation, ctx.activeLevelId, `structural-finish-${buildingId}`,
    );
    if (skin) { skin.userData['buildingId'] = buildingId; group.add(skin); }
    addHorizontalFinish(group, g, entities, ctx, buildingId, sceneUnits, columnExtents);
  }
}

/**
 * ADR-449 height-SSoT — `Map<columnId, {zBotMm,zTopMm}>` υπολογισμένο ΜΙΑ φορά για ΟΛΕΣ
 * τις κολώνες του ορόφου, με **ακριβώς το ίδιο context** που χρησιμοποιεί ο πυρήνας στο
 * `bim-scene-attach-syncs.syncColumns` (`{floorElevationMm, nextFloorElevationMm}` +
 * `resolveHostInput` μόνο όταν υπάρχουν attached). Ο σοβάς κάνει lookup ανά id → ποτέ
 * δεν ξανα-υπολογίζει από raw `params.height`.
 */
function buildColumnVerticalExtents(entities: Bim3DEntities, ctx: SyncContext): ColumnVerticalExtentLookup {
  const hasAttached = entities.columns.some(
    (c) => c.params?.topBinding === 'attached' || c.params?.baseBinding === 'attached',
  );
  const resolveHostInput = hasAttached
    ? makeColumnHostResolver(buildWallHostInputs(entities.beams, entities.slabs))
    : undefined;
  // ADR-449 — ΕΝΑ SSoT lookup builder (μοιραζόμαστε με το 2Δ silhouette path).
  return buildColumnVerticalExtentLookup(entities.columns, {
    floorElevationMm: ctx.floorElevationMm,
    nextFloorElevationMm: ctx.nextFloorElevationMm,
    resolveHostInput,
  });
}

/**
 * ADR-534 Φ3c-B3b — `Map<beamId, clipZmm>` (building-relative mm) με το soffit top-clip κάθε
 * δοκού που καλύπτεται από μονολιθική πλάκα οροφής. **FULL SSoT reuse** του ίδιου
 * `resolveMemberTopClipZmm` + `buildCeilingSlabHosts` (§monolithic-cut) που κόβει το ορατό
 * στερεό (B3a) — beamTop = `topElevation + zOffset`, ίδια τιμή. Entry μόνο όταν υπάρχει
 * πραγματική κάλυψη (`clip < top`) → απών = πλήρες ύψος σοβά (byte-for-byte, μηδέν regression).
 */
function buildBeamTopClipById(entities: Bim3DEntities): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  const slabHosts = buildCeilingSlabHosts(entities.slabs);
  if (slabHosts.length === 0) return map;
  for (const beam of entities.beams) {
    const beamTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
    const footprint = beam.geometry.outline.vertices.map((v) => ({ x: v.x, y: v.y }));
    const clip = resolveMemberTopClipZmm(footprint, beamTopMm, beamTopMm - beam.params.depth, slabHosts);
    if (clip < beamTopMm) map.set(beam.id, clip);
  }
  return map;
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
  columnExtents: ColumnVerticalExtentLookup,
): void {
  const finishInput = {
    columns: g.columns,
    beams: g.beams,
    walls: entities.walls,
    slabs: entities.slabs,
    beamObstacles: g.beams,
    floorElevationMm: ctx.floorElevationMm,
    columnExtents,
  };
  const { columnFaces, beamFaces } = computeStructuralHorizontalFinishFaces(finishInput);
  const isUp = (f: { direction: string }) => f.direction === 'up';
  // ADR-449 §top-cap-coincidence — ΕΝΙΑΙΟ πάνω-καπάκι από union ΠΥΡΗΝΩΝ + μία διαστολή (mirror
  // του κάθετου silhouette): η ραφή τοίχου↔κολόνας↔δοκαριού στη συμβολή είναι λεία, με τέλεια
  // ταύτιση παρειών (μηδέν δοντωτό χείλος, μηδέν εισχώρηση/κενό). Giorgio 2026-07-01.
  const upSkin = buildHorizontalFinishSkin(
    computeMergedStructuralTopCap(finishInput),
    'wall', g.baseElevation, sceneUnits, ctx.activeLevelId, `structural-finish-hup-${buildingId}`,
  );
  if (upSkin) { upSkin.userData['buildingId'] = buildingId; group.add(upSkin); }
  // Down καπάκια (soffit δοκαριού, βάση pilotis κολόνας) — per-type· καμία junction ραφή εκεί.
  const colDownSkin = buildHorizontalFinishSkin(
    columnFaces.filter((f) => !isUp(f)), 'column', g.baseElevation, sceneUnits, ctx.activeLevelId, `structural-finish-hcol-${buildingId}`,
  );
  if (colDownSkin) { colDownSkin.userData['buildingId'] = buildingId; group.add(colDownSkin); }
  const beamDownSkin = buildHorizontalFinishSkin(
    beamFaces.filter((f) => !isUp(f)), 'beam', g.baseElevation, sceneUnits, ctx.activeLevelId, `structural-finish-hbeam-${buildingId}`,
  );
  if (beamDownSkin) { beamDownSkin.userData['buildingId'] = buildingId; group.add(beamDownSkin); }
}
