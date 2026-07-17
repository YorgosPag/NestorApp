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
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import { filterHostedOpenings } from './bim-scene-hosted-opening-filters';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import { isStructuralFinishVisible } from '../../bim/finishes/structural-finish-visibility';
import { isColumnTilted } from '../../bim/geometry/column-tilt';
import { isBeamTilted } from '../../bim/geometry/beam-slope';
import { isWallTilted } from '../../bim/geometry/wall-tilt';
import { isSlabTilted } from '../../bim/geometry/slab-tilt';
import { computeStructuralFinishSilhouette } from '../../bim/finishes/structural-finish-scene';
import type { ColumnVerticalExtentLookup } from '../../bim/finishes/structural-finish-scene-silhouette';
import { buildStructuralSilhouetteSkin } from '../converters/structural-finish-silhouette-3d';
import { computeStructuralHorizontalFinishFaces, computeMergedStructuralTopCap } from '../../bim/finishes/structural-finish-scene-horizontal';
import { buildHorizontalFinishSkin } from '../converters/structural-finish-horizontal-3d';
import { buildColumnVerticalExtentLookup, makeColumnHostResolver } from '../../bim/geometry/column-vertical-profile';
import { buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';
import { buildCeilingSlabHosts, resolveMemberTopClipZmm } from './monolithic-slab-clip';
import { wallFootprintPolygon } from '../../bim/finishes/structural-finish-scene';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
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
  // ADR-534 Φ3c-B3b (τοίχοι) — το ίδιο soffit clip για τους ΤΟΙΧΟΥΣ (ο ροζ σοβάς διαπερνούσε την
  // πλάκα· Giorgio 2026-07-17). Τρέφει ΚΑΙ τον κάθετο silhouette ΚΑΙ το οριζόντιο top-cap → ένα z.
  const wallTopClipById = buildWallTopClipById(entities, ctx.floorElevationMm);
  const groups = new Map<string, { baseElevation: number; columns: ColumnEntity[]; beams: BeamEntity[]; walls: WallEntity[]; slabs: SlabEntity[] }>();
  const groupFor = (buildingId: string, baseElevation: number) => {
    let g = groups.get(buildingId);
    if (!g) { g = { baseElevation, columns: [], beams: [], walls: [], slabs: [] }; groups.set(buildingId, g); }
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
  //
  // ADR-449 §opening-bands — μαζεύουμε ΤΑΥΤΟΧΡΟΝΑ τα ορατά ανοίγματα ανά τοίχο ώστε ο σοβάς να μην
  // σκεπάζει τα κουφώματα. **ΤΟ ΙΔΙΟ `filterHostedOpenings`** που τρέφει τον πυρήνα (`syncWalls` →
  // `wallToMesh`) → ο σοβάς κόβεται ακριβώς εκεί που λείπει μπετόν, με ίδιο visibility gating
  // (ADR-382 2Δ⟷3Δ parity· ADR-615: self-hosted `wallId === undefined` δεν ταιριάζει ποτέ).
  const openingsByWallId = new Map<string, readonly OpeningEntity[]>();
  for (const wall of entities.walls) {
    if (isWallTilted(wall.params)) continue;
    const r = resolve(wall, 'wall', ctx);
    if (!r) continue;
    groupFor(r.buildingId, r.baseElevation).walls.push(wall);
    const ops = filterHostedOpenings(entities.openings, 'wallId', wall.id, r.buildingMode, ctx);
    if (ops.length > 0) openingsByWallId.set(wall.id, ops);
  }
  // ADR-534 Φ5c — η πλάκα ως finish-member (mirror columns/beams/walls): μπαίνει στο group του
  // κτιρίου της ώστε η κατακόρυφη περιμετρική «φάσα» να ενωθεί με τα δομικά μέλη στο union (τυλίγει
  // + σβήνει στις επαφές). Tilted πλάκες εξαιρούνται από το flat union (ADR-404) — per-element σοβάς.
  for (const slab of entities.slabs) {
    if (isSlabTilted(slab.params)) continue;
    const r = resolve(slab, 'slab', ctx);
    if (r) groupFor(r.buildingId, r.baseElevation).slabs.push(slab);
  }
  for (const [buildingId, g] of groups) {
    const bands = computeStructuralFinishSilhouette({
      columns: g.columns,
      beams: g.beams,
      walls: g.walls,
      floorElevationMm: ctx.floorElevationMm,
      columnExtents,
      beamTopClipById,
      openingsByWallId,
      wallTopClipById,
      slabs: g.slabs,
    });
    const sceneUnits = g.columns[0]?.params.sceneUnits ?? g.beams[0]?.params.sceneUnits ?? g.walls[0]?.params.sceneUnits ?? g.slabs[0]?.params.sceneUnits ?? 'mm';
    const skin = buildStructuralSilhouetteSkin(
      bands, sceneUnits, g.baseElevation, ctx.activeLevelId, `structural-finish-${buildingId}`,
    );
    if (skin) { skin.userData['buildingId'] = buildingId; group.add(skin); }
    addHorizontalFinish(group, g, entities, ctx, buildingId, sceneUnits, columnExtents, wallTopClipById);
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
    const footprint = projectVerticesTo2D(beam.geometry.outline.vertices);
    const clip = resolveMemberTopClipZmm(footprint, beamTopMm, beamTopMm - beam.params.depth, slabHosts);
    if (clip < beamTopMm) map.set(beam.id, clip);
  }
  return map;
}

/**
 * ADR-534 Φ3c-B3b (τοίχοι) — `Map<wallId, clipZmm>` (building-relative mm) με το soffit top-clip
 * κάθε τοίχου που καλύπτεται από μονολιθική πλάκα οροφής. **Αυτολεξεί mirror** του
 * {@link buildBeamTopClipById}: ΙΔΙΟ `buildCeilingSlabHosts` + `resolveMemberTopClipZmm`, ίδια
 * σύμβαση «entry μόνο όταν υπάρχει πραγματική κάλυψη (`clip < top`)» → απών = πλήρες ύψος σοβά
 * (byte-for-byte). Footprint = `wallFootprintPolygon(wall)` — **ήδη 2Δ canvas units** (ίδιο plan
 * space με τα slab outlines), άρα ΔΕΝ χρειάζεται `projectVerticesTo2D` όπως τα 3Δ beam vertices.
 *
 * Γιατί χρειάζεται (Giorgio 2026-07-17, C4D screenshots): το bug των δοκαριών λύθηκε στο Φ3c-B3b
 * αλλά **ποτέ** για τους τοίχους → ο ροζ σοβάς ανέβαινε στο nominal `baseOffset+height` και
 * διαπερνούσε την πλάκα. Το `attached` branch ΔΕΝ το κάλυπτε: λύνει μόνο top-attach σε **δοκάρι**·
 * ένας `storey-ceiling` τοίχος κάτω από **πλάκα** δεν περνά από εκεί.
 *
 * ⚠️ Εξαρτάται από το topside guard του `resolveMemberTopClipZmm` (2026-07-17): χωρίς αυτό, η
 * πλάκα-**δάπεδο** του ίδιου ορόφου (που ο τοίχος πατά πάνω της) θα κέρδιζε το `min()` → clip =
 * βάση → **ύψος 0 → εξαφανισμένος σοβάς** αντί για κομμένος.
 */
function buildWallTopClipById(entities: Bim3DEntities, floorElevationMm: number): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  const slabHosts = buildCeilingSlabHosts(entities.slabs);
  if (slabHosts.length === 0) return map;
  for (const wall of entities.walls) {
    const wallBotMm = floorElevationMm + (wall.params.baseOffset ?? 0);
    const wallTopMm = wallBotMm + wall.params.height;
    const clip = resolveMemberTopClipZmm(wallFootprintPolygon(wall), wallTopMm, wallBotMm, slabHosts);
    if (clip < wallTopMm) map.set(wall.id, clip);
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
  wallTopClipById: ReadonlyMap<string, number>,
): void {
  const finishInput = {
    columns: g.columns,
    beams: g.beams,
    walls: entities.walls,
    slabs: entities.slabs,
    beamObstacles: g.beams,
    floorElevationMm: ctx.floorElevationMm,
    columnExtents,
    wallTopClipById,
  };
  const { columnFaces, beamFaces, slabFaces } = computeStructuralHorizontalFinishFaces(finishInput);
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
  // ADR-534 Φ5 — soffit (κάτω παρειά) των finish-member πλακών: η οροφή του από-κάτω χώρου. Όλες
  // `down` (η πάνω παρειά μπήκε στο ενιαίο upSkin). Per-type skin — καμία junction ραφή εδώ.
  const slabDownSkin = buildHorizontalFinishSkin(
    slabFaces.filter((f) => !isUp(f)), 'slab', g.baseElevation, sceneUnits, ctx.activeLevelId, `structural-finish-hslab-${buildingId}`,
  );
  if (slabDownSkin) { slabDownSkin.userData['buildingId'] = buildingId; group.add(slabDownSkin); }
}
