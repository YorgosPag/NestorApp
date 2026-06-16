/**
 * BimToThreeConverter — pure functions: BIM entity → THREE.Mesh.
 *
 * ADR-366 Phase 2 (SPEC-3D-002). Coordinate convention:
 *   DXF plan (mm): X = East, Y = North
 *   Three.js world (m, Y-up): x = East, y = Up, z = -North
 *
 * Build ExtrudeGeometry in shape's local XY plane, then rotate -π/2 around X
 * so local Z (extrusion) becomes world Y (height). Shape X → world X, shape Y
 * stays as-is → after rotation becomes world -Z (= DXF North → -Z) ✓.
 *
 * Phase 2 MVP: solid geometry only. Openings as Phase 3 boolean cutout.
 * Phase 3+: material catalog, per-entity override, LOD.
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildWallMeshWithOpenings } from './wall-opening-extrude';
import { buildOpeningMesh, type OpeningMeshMaterials } from './opening-mesh';
import { computeWallOpeningPieces, type WallTopLocalFn, type WallBaseLocalFn, type WallOpeningPiece } from './wall-opening-pieces';
import { buildSlopedWallPieceGeometry, buildWallLoftBandGeometry } from './wall-piece-geometry';
import { buildColumnPrismGeometry } from './column-piece-geometry';
import { isMultiLayerWall, splitPieceByLayers } from './wall-layer-geometry';
import {
  pullBackStraightWallEndsFromColumns,
  WALL_COLUMN_PULLBACK_MM,
  WALL_COLUMN_BUTT_TOL_MM,
} from './wall-column-pullback-3d';
import { mmToSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { buildMultiLayerSolidWall } from './wall-multilayer-solid-3d';
import { ensureWorldUvs } from './bim-uv-helpers';
import {
  clipWallBandTopRegions,
  clipWallBandTopRegionsTilted,
  tiltCompensateWallTopClip,
  type WallTopClipContext,
} from './wall-top-clip';
import { isWallTilted } from '../../bim/geometry/wall-tilt';
import { evaluateWallTopAt, type WallTopProfile } from '../../bim/geometry/wall-top-profile';
import { evaluateWallBaseAt, type WallBaseProfile } from '../../bim/geometry/wall-base-profile';
// ADR-404 P1 — slope/tilt shear helpers (εξήχθησαν από εδώ για file-size, N.7.1).
import { applyWallTilt } from './mesh-slope-shear';
// File-private geometry primitives (N.7.1 file-size split, 2026-06-01).
import { buildShape, extrudeAndRotate, tagMesh, buildWallShape } from './bim-three-shape-helpers';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
// Shared 3D edge overlay + point-based converters (N.7.1 file-size split, 2026-06-02).
import { attachEdgesProjection } from './bim-three-edges';
import { wallFootprintSubcategory } from '../../bim/walls/wall-render-palette';

// ADR-406 / ADR-408 Φ3 — point-based converters re-exported from their own module
// (file-size SSoT, N.7.1). Importers keep `from '.../BimToThreeConverter'`.
export { fixtureToMesh, panelToMesh, manifoldToMesh, radiatorToMesh, boilerToMesh, waterHeaterToMesh } from './bim-three-point-converters';
// Structural element converters re-exported from their own module
// (file-size SSoT, N.7.1, 2026-06-08). Importers keep `from '.../BimToThreeConverter'`.
export { columnToMesh, beamToMesh, slabToMesh } from './bim-three-structural-converters';
// ADR-436 — structural foundation converter (own module, file-size SSoT N.7.1).
export { foundationToMesh } from './foundation-to-three';

// ADR-462 canonical-mm — BIM plan vertices (outerEdge, innerEdge, footprint, outline,
// axisPolyline) are CANVAS UNITS (mm under canonical-mm), NOT meters. Convert plan XY →
// Three.js world metres with `× sceneToM` where `sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm')`.
// Scalar params — slab thickness/elevation, beam depth/elevation, column/wall height,
// floorElevationMm — are stored in raw mm and MUST be multiplied by MM_TO_M.
// Invariant: `mmToSceneUnits(u) × sceneUnitsToMeters(u) = MM_TO_M`.
const MM_TO_M = 0.001;

// ── Wall material: DNA core layer → catalog, else category fallback ───────────
const CATEGORY_MAT_ID: Record<WallEntity['params']['category'], string> = {
  exterior:  'mat-concrete',
  interior:  'mat-plaster',
  partition: 'mat-brick',
  parapet:   'mat-concrete',
  fence:     'mat-stone',
};

// ── ADR-401 Phase B2 — μεταβλητή κορυφή (σκαλωτή/κεκλιμένη) ────────────────────

/**
 * `WallTopProfile` (απόλυτα mm) → `WallTopLocalFn` σε **τοπικά μέτρα** πάνω από το
 * δάπεδο, που καταναλώνουν οι piece builders. `localTop(t) = (top_mm − FFL_mm) · 0.001`.
 * Τα breakpoints είναι τα εσωτερικά segment όρια (σημεία αλλαγής κλίσης).
 */
export function makeWallTopLocalFn(profile: WallTopProfile, floorElevationMm: number): WallTopLocalFn {
  const bps = new Set<number>();
  for (const s of profile.segments) {
    if (s.t0 > 1e-6 && s.t0 < 1 - 1e-6) bps.add(s.t0);
    if (s.t1 > 1e-6 && s.t1 < 1 - 1e-6) bps.add(s.t1);
  }
  return {
    breakpoints: [...bps].sort((a, b) => a - b),
    at: (f) => (evaluateWallTopAt(profile, f) - floorElevationMm) * MM_TO_M,
  };
}

/**
 * ADR-401 (γ) Phase γ2 — `WallBaseProfile` (απόλυτα mm) → `WallBaseLocalFn` σε
 * **τοπικά μέτρα** πάνω από το δάπεδο (mirror του `makeWallTopLocalFn`).
 * `localBase(t) = (base_mm − FFL_mm) · 0.001` — μπορεί <0 (π.χ. θεμέλιο κάτω από
 * τη στάθμη). Τα breakpoints είναι τα εσωτερικά segment όρια (βήματα/αλλαγή κλίσης).
 */
export function makeWallBaseLocalFn(profile: WallBaseProfile, floorElevationMm: number): WallBaseLocalFn {
  const bps = new Set<number>();
  for (const s of profile.segments) {
    if (s.t0 > 1e-6 && s.t0 < 1 - 1e-6) bps.add(s.t0);
    if (s.t1 > 1e-6 && s.t1 < 1 - 1e-6) bps.add(s.t1);
  }
  return {
    breakpoints: [...bps].sort((a, b) => a - b),
    at: (f) => (evaluateWallBaseAt(profile, f) - floorElevationMm) * MM_TO_M,
  };
}

// ── Straight wall WITH openings — mitered vertical-split (ADR-363 Phase 1J) ────

/**
 * Build a straight wall that hosts openings, PRESERVING the corner miters.
 *
 * The per-segment front-face extrude (`buildWallMeshWithOpenings`) builds raw
 * rectangles from the bare axis and ignores `startMiter`/`endMiter` — so a wall
 * with a door/window rendered as a blunt box that didn't meet its neighbours
 * (Giorgio 3D report 2026-05-30). This path instead mirrors the SOLID path: it
 * reads the MITERED `wall.geometry.outerEdge`/`innerEdge` and splits the wall
 * into vertical solid pieces — full-height jambs between/around openings + a
 * sill piece (floor→sill) and header piece (lintel→ceiling) across each opening
 * — each piece an outer/inner footprint quad (interpolated by arc fraction)
 * extruded vertically via the shared `buildShape` + `extrudeAndRotate`. The two
 * wall ends use the exact mitered corner points, so the miters survive.
 *
 * Straight-only: outer/inner are 2-point edges, so arc-fraction interpolation is
 * exact at the ends (the corners). Returns null on degenerate input → caller
 * falls back to the solid (uncut) path.
 */
export function buildStraightWallWithOpenings(
  wall: WallEntity,
  openings: readonly OpeningEntity[],
  material: THREE.Material,
  floorElevationMm: number,
  buildingBaseElevationM: number,
  sceneToM = 1, // ADR-462 — canvas units → world metres for plan XY (quad + host footprints)
  wallTop?: WallTopLocalFn,
  wallBase?: WallBaseLocalFn,
  topClip?: WallTopClipContext,
): THREE.Object3D | null {
  // Κάθετη παρειά κάθε ανοίγματος από το `outline` SSoT (collinear με wall punch
  // 2D + Z4 + Z1) — ΟΧΙ fraction-lerp ανά πλευρά (που έβγαζε λοξή παρειά σε miters).
  // ADR-401 B2: `wallTop` → κάθε κομμάτι παίρνει την κορυφή του από το προφίλ.
  // ADR-401 (γ): `wallBase` → ο πάτος ακολουθεί base-attach (επίπεδο/σκαλωτό →
  // ExtrudeGeometry· κεκλιμένο top ή base → custom wedge BufferGeometry).
  // ADR-401 γωνιακή διασταύρωση: σε attached straight τοίχο σπάμε στα **face
  // crossings** (τομές παρειών με τα host footprints), ΟΧΙ στις axis crossings —
  // αλλιώς ένα ακριανό κομμάτι περιέχει την τριγωνική «μύτη» του host → πεντάγωνο
  // μετά το clip. Το `at` αγνοείται (το clip ξαναϋπολογίζει την κορυφή ανά region)·
  // δίνουμε nominal ώστε όποιο region δεν επικαλύπτεται host να βγει στο nominal.
  // ADR-404 ↔ ADR-401 — tilt-aware clip: σε κεκλιμένο τοίχο, αντιστάθμισε τα host
  // footprints κατά −shear(Hu) ΠΡΙΝ το clip ώστε μετά τον τελικό shear (emit) η εγκοπή
  // να ξανακάθεται κάτω από το δοκάρι. Επίπεδος τοίχος → ίδιο topClip (no-op).
  const effTopClip = topClip && isWallTilted(wall.params)
    ? tiltCompensateWallTopClip(topClip, wall.params, floorElevationMm, wall.geometry)
    : topClip;
  const clipWallTop = effTopClip
    ? { breakpoints: effTopClip.breakpoints, at: () => (effTopClip.nominalTopMm - floorElevationMm) * MM_TO_M }
    : wallTop;
  const pieces = computeWallOpeningPieces(wall, openings, clipWallTop, wallBase);
  if (!pieces) return null;

  const floorY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  const group = new THREE.Group();
  // ADR-413 — per-layer split: a multi-DNA wall renders one sub-solid per layer
  // (own material/texture). Single-layer / no-DNA → one quad = the core material.
  const dna = wall.params.dna;
  const multiLayer = isMultiLayerWall(dna);
  const emit = (geo: THREE.BufferGeometry, yOffset: number, mat: THREE.Material, layerId?: string): void => {
    // ADR-404 — battered wall στον pieces path (Δρόμος Β): το ίδιο shear με τον solid
    // path, αλλά αγκυρωμένο στο floor-local ύψος της βάσης του κομματιού (`yOffset −
    // floorY`: flat piece → zBotAM· wedge/prism → 0). No-op flat → byte-for-byte.
    // ΠΡΙΝ το mesh/edges ώστε τα attachEdgesProjection edges να ακολουθούν την κλίση.
    applyWallTilt(geo, wall.params, yOffset - floorY);
    // ADR-413 — texture UVs: ExtrudeGeometry carries auto-UVs (copy → uv2 for aoMap);
    // custom wedge/prism/loft BufferGeometry has none → planar world-meter UVs.
    ensureWorldUvs(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = yOffset;
    mesh.userData['bimId'] = wall.id;
    mesh.userData['bimType'] = 'wall';
    if (layerId !== undefined) mesh.userData['layerId'] = layerId;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // ADR-375 C.9 — 3D ακμές ακολουθούν το ίδιο function subcat με το 2D (εσωτ./εξωτ.).
    attachEdgesProjection(mesh, 'wall', wallFootprintSubcategory(wall.params.category));
    group.add(mesh);
  };

  // ADR-401 γωνιακή διασταύρωση — attached profile-following piece με επίπεδο πάτο:
  // κόβει το plan-quad με τα host footprints (tilted → prisms+loft bands, flat →
  // prisms). Επιστρέφει `true` αν έκοψε (handled), αλλιώς `false` (fast path κάτω).
  const tryEmitClip = (
    pc: WallOpeningPiece,
    quad: readonly [Point3D, Point3D, Point3D, Point3D],
    mat: THREE.Material,
    layerId?: string,
  ): boolean => {
    if (!effTopClip) return false;
    // ADR-462 — `quad` arrives in metres (scaled by the caller); scale the host
    // footprints to the SAME metre space so the boolean clip is consistent.
    const hosts = effTopClip.hosts.map((h) => ({ ...h, footprint: scalePoints(h.footprint, sceneToM) }));
    if (isWallTilted(wall.params)) {
      const { prisms, lofts } = clipWallBandTopRegionsTilted(
        quad, hosts, effTopClip.nominalTopMm, floorElevationMm, pc.zBotAM, wall.params,
      );
      if (prisms.length === 0 && lofts.length === 0) return false;
      for (const r of prisms) { const g = buildColumnPrismGeometry(r.footprint, r.baseLocalM, r.topLocalM); if (g) emit(g, floorY, mat, layerId); }
      for (const band of lofts) { const g = buildWallLoftBandGeometry(band); if (g) emit(g, floorY, mat, layerId); }
      return true;
    }
    const regions = clipWallBandTopRegions(quad, hosts, effTopClip.nominalTopMm, floorElevationMm, pc.zBotAM);
    if (regions.length === 0) return false;
    for (const r of regions) { const g = buildColumnPrismGeometry(r.footprint, r.baseLocalM, r.topLocalM); if (g) emit(g, floorY, mat, layerId); }
    return true;
  };

  // Emit ONE thickness-quad of a piece (the full piece quad in single-layer mode,
  // or a layer sub-quad in multi-layer mode) with all the slope/clip branching.
  const emitPieceQuad = (
    pc: WallOpeningPiece,
    quad: readonly [Point3D, Point3D, Point3D, Point3D],
    mat: THREE.Material,
    layerId?: string,
  ): void => {
    // ADR-462 — plan quad (canvas units) → world metres ΠΡΙΝ τη γεωμετρία· τα z-fields
    // του `pc` (zBotAM/zTopAM…) είναι ήδη μέτρα (από wallTop/wallBase `.at()` × MM_TO_M).
    const quadM = scalePoints(quad, sceneToM) as [Point3D, Point3D, Point3D, Point3D];
    const flatBase = Math.abs(pc.zBotAM - pc.zBotBM) < 1e-6;
    if (pc.topFollowsProfile && flatBase && tryEmitClip(pc, quadM, mat, layerId)) return;

    if (Math.abs(pc.zTopAM - pc.zTopBM) < 1e-6 && flatBase) {
      // Επίπεδη κορυφή ΚΑΙ επίπεδος πάτος → extrude κατά (zTop − zBot).
      const depth = pc.zTopAM - pc.zBotAM;
      if (depth <= 1e-6) return;
      const shape = buildShape(quadM);
      if (!shape) return;
      emit(extrudeAndRotate(shape, depth), floorY + pc.zBotAM, mat, layerId);
    } else {
      // Κεκλιμένη κορυφή ή/και πάτος → wedge από ΑΥΤΟ το quad (full piece ή layer sub-quad).
      const wedge = buildSlopedWallPieceGeometry({ ...pc, quad: quadM });
      if (wedge) emit(wedge, floorY, mat, layerId);
    }
  };

  for (const pc of pieces) {
    if (multiLayer) {
      // ADR-413 — split this along-length piece across its thickness into layers.
      for (const lp of splitPieceByLayers(pc, dna)) {
        emitPieceQuad(lp.piece, lp.quad, getMaterial3D(lp.materialId), lp.layerId);
      }
    } else {
      emitPieceQuad(pc, pc.quad, material);
    }
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = wall.id;
  group.userData['bimType'] = 'wall';
  return group;
}

// ── ADR-421 §A6 — opening 3D body attach ──────────────────────────────────────

/**
 * Build + attach the parametric 3D mesh of each hosted opening into the wall
 * `group`. Materials resolved once (κάσα/φύλλο = ξύλο, υαλοστάσιο = γυαλί· τα
 * glazed kinds επιλέγουν γυαλί στο `buildOpeningMesh`). No-op όταν δεν υπάρχουν
 * openings (π.χ. το group προέκυψε λόγω wallTop/wallBase profile).
 */
function attachOpeningMeshes(
  group: THREE.Object3D,
  wall: WallEntity,
  openings: readonly OpeningEntity[],
  floorElevationMm: number,
  buildingBaseElevationM: number,
  levelId?: string,
): void {
  if (openings.length === 0) return;
  const materials: OpeningMeshMaterials = {
    frame: getMaterial3D('mat-wood'),
    leaf: getMaterial3D('mat-wood'),
    glass: getMaterial3D('mat-glass'),
  };
  for (const opening of openings) {
    const mesh = buildOpeningMesh(opening, wall, materials, floorElevationMm, buildingBaseElevationM);
    if (!mesh) continue;
    if (levelId !== undefined) mesh.userData['levelId'] = levelId;
    group.add(mesh);
  }
}

// ── Public converters ─────────────────────────────────────────────────────────

export function wallToMesh(
  wall: WallEntity,
  openings: readonly OpeningEntity[] = [],
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
  profile?: WallTopProfile,
  baseProfile?: WallBaseProfile,
  topClip?: WallTopClipContext,
  nominalHeightMm?: number,
  columns: readonly (readonly Point3D[])[] = [],
): THREE.Object3D | null {
  // ADR-448 Phase 1b — when `topBinding='storey-ceiling'` resolves a real storey
  // ceiling, render at that height (Revit «Top: Up to Level»). Stored `params.height`
  // is the override; without a storey context `nominalHeightMm` === it → no-op.
  const heightMm = (nominalHeightMm !== undefined && Math.abs(nominalHeightMm - wall.params.height) > 1e-6)
    ? nominalHeightMm : undefined;
  // ADR-449 #2/#C — υποχώρησε άκρη ίσιου τοίχου που κουμπώνει σε κολόνα ΜΑΚΡΙΑ της κατά
  // τον άξονα (3Δ-only, σπάει το coincident end-cap → τέλος z-fight· #C: μηδέν geometry
  // μέσα στην κολόνα → δεν διαρρέει στο cut-plane fast-path). `null` όταν καμία άκρη δεν
  // κουμπώνει → renderWall ≡ wall (byte-for-byte). 2Δ/BOQ/finish-obstacle = αρχικό wall.
  const pullBack = wall.kind === 'straight'
    ? pullBackStraightWallEndsFromColumns(
        wall.geometry, wall.params.start, wall.params.end, columns,
        WALL_COLUMN_PULLBACK_MM * mmToSceneUnits(wall.params.sceneUnits ?? 'mm'),
        WALL_COLUMN_BUTT_TOL_MM * mmToSceneUnits(wall.params.sceneUnits ?? 'mm'),
      )
    : null;
  const renderWall = (heightMm !== undefined || pullBack)
    ? {
        ...wall,
        params: {
          ...wall.params,
          ...(heightMm !== undefined ? { height: heightMm } : {}),
          ...(pullBack ? { start: pullBack.start, end: pullBack.end } : {}),
        },
        geometry: pullBack
          ? {
              ...wall.geometry,
              outerEdge: { ...wall.geometry.outerEdge, points: pullBack.outer },
              innerEdge: { ...wall.geometry.innerEdge, points: pullBack.inner },
              axisPolyline: { ...wall.geometry.axisPolyline, points: pullBack.axis },
            }
          : wall.geometry,
      }
    : wall;
  const coreLayer = wall.params.dna?.layers.find((l) => l.side === 'core');
  const matId = coreLayer?.materialId ?? CATEGORY_MAT_ID[wall.params.category] ?? 'mat-concrete';
  const material = getMaterial3D(matId);
  // ADR-462 — plan XY (canvas units) → world metres. Threaded into every wall path.
  const sceneToM = sceneUnitsToMeters(wall.params.sceneUnits ?? 'mm');

  // ADR-401 Phase B2 — μεταβλητή κορυφή (σκαλωτή/κεκλιμένη) μόνο σε `attached`
  // τοίχους· flat τοίχος → undefined → fast solid path (μηδέν regression).
  const wallTop = profile?.hasAttach ? makeWallTopLocalFn(profile, floorElevationMm) : undefined;
  // ADR-401 (γ) — μεταβλητός πάτος (base-attach) μόνο όταν η βάση κολλάει σε host.
  const wallBase = baseProfile?.hasAttach ? makeWallBaseLocalFn(baseProfile, floorElevationMm) : undefined;

  // ADR-413 — multi-layer DNA straight wall (no openings/profile) still routes
  // through the piece path: it produces a single full-span piece that the
  // per-layer split turns into one sub-solid per layer (preserves miters too).
  const multiLayerStraight = isMultiLayerWall(wall.params.dna) && wall.kind === 'straight';

  // ADR-363 Bug 2 — opening cutouts.
  //   - straight walls: vertical-split pieces from the MITERED footprint
  //     (`buildStraightWallWithOpenings`) so corner miters survive (Phase 1J fix).
  //   - curved / polyline: per-segment front-face re-extrude (raw axis — miters
  //     N/A on multi-segment ends; ADR-370 Phase 7 slab-opening pattern).
  // ADR-401 B2/(γ): ο piece path ενεργοποιείται ΚΑΙ χωρίς ανοίγματα όταν υπάρχει
  // μεταβλητή κορυφή Ή μεταβλητός πάτος (το ίσιο solid extrude δεν τα υποστηρίζει).
  if (openings.length > 0 || wallTop || wallBase || multiLayerStraight) {
    const group =
      wall.kind === 'straight'
        ? buildStraightWallWithOpenings(renderWall, openings, material, floorElevationMm, buildingBaseElevationM, sceneToM, wallTop, wallBase, topClip)
        : buildWallMeshWithOpenings(renderWall, openings, material, floorElevationMm, buildingBaseElevationM, wallTop, wallBase);
    if (group) {
      group.userData['matId'] = matId;
      if (levelId !== undefined) group.userData['levelId'] = levelId;
      // ADR-421 §A6 — parametric 3D κουφώματος (κάσα + φύλλα + υαλοστάσιο) μέσα
      // στο cutout. Attached ως children ώστε να ακολουθούν το wall group.
      attachOpeningMeshes(group, wall, openings, floorElevationMm, buildingBaseElevationM, levelId);
      return group;
    }
    // Fall through to solid path if segmenting failed (defensive).
  }

  // ADR-413 — multi-layer curved/polyline (or defensive fall-through): split the
  // single solid into per-layer band solids via the shared layer helper.
  if (isMultiLayerWall(wall.params.dna)) {
    const grp = buildMultiLayerSolidWall(renderWall, floorElevationMm, buildingBaseElevationM);
    if (grp) {
      grp.userData['matId'] = matId;
      if (levelId !== undefined) grp.userData['levelId'] = levelId;
      return grp;
    }
    // Degenerate → fall through to single-mesh solid (defensive).
  }

  // ADR-462 — outer/inner edge points (canvas units) → world metres.
  const shape = buildWallShape(
    scalePoints(renderWall.geometry.outerEdge.points, sceneToM),
    scalePoints(renderWall.geometry.innerEdge.points, sceneToM),
  );
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, renderWall.params.height * MM_TO_M);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  // ADR-404 — battered wall: shear το X/Z βάσει ύψους (η κορυφή γέρνει). No-op flat.
  applyWallTilt(geo, renderWall.params);
  const mesh = new THREE.Mesh(geo, material);
  // ADR-402 — `baseOffset` (mm, base face from storey FFL) lifts the whole wall so the
  // vertical (axis-Y) move arrow shows in 3D. ONLY on this flat solid path: the
  // profiled/pieces path (makeWallBaseLocalFn) already bakes baseOffset into the
  // geometry z, so adding it here too would double-count. baseOffset=0 → no change.
  mesh.position.y = (floorElevationMm + wall.params.baseOffset) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, wall.id, 'wall', matId, levelId);
  // ADR-375 C.9 — 3D ακμές ακολουθούν το ίδιο function subcat με το 2D (εσωτ./εξωτ.).
  attachEdgesProjection(tagged, 'wall', wallFootprintSubcategory(wall.params.category));
  return tagged;
}

