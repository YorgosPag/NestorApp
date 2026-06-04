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
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getMaterial3D, getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildWallMeshWithOpenings } from './wall-opening-extrude';
import { computeWallOpeningPieces, type WallTopLocalFn, type WallBaseLocalFn, type WallOpeningPiece } from './wall-opening-pieces';
import { buildSlopedWallPieceGeometry, buildWallLoftBandGeometry } from './wall-piece-geometry';
import { buildColumnPrismGeometry } from './column-piece-geometry';
import { isMultiLayerWall, splitPieceByLayers } from './wall-layer-geometry';
import { buildMultiLayerSolidWall } from './wall-multilayer-solid-3d';
import { ensureWorldUvs } from './bim-uv-helpers';
import {
  clipWallBandTopRegions,
  clipWallBandTopRegionsTilted,
  tiltCompensateWallTopClip,
  type WallTopClipContext,
} from './wall-top-clip';
import { isWallTilted } from '../../bim/geometry/wall-tilt';
import type { ColumnTopProfile, ColumnBaseProfile } from '../../bim/geometry/column-vertical-profile';
import { evaluateWallTopAt, type WallTopProfile } from '../../bim/geometry/wall-top-profile';
import { evaluateWallBaseAt, type WallBaseProfile } from '../../bim/geometry/wall-base-profile';
// ADR-404 P1 — slope/tilt shear helpers (εξήχθησαν από εδώ για file-size, N.7.1).
import { applyBeamSlope, applySlabSlope, applyColumnTilt, applyWallTilt } from './mesh-slope-shear';
// File-private geometry primitives (N.7.1 file-size split, 2026-06-01).
import { buildShape, extrudeAndRotate, tagMesh, buildWallShape } from './bim-three-shape-helpers';
import { buildSweptIBeamGeometry } from './beam-ishape-geometry';
// Shared 3D edge overlay + point-based converters (N.7.1 file-size split, 2026-06-02).
import { attachEdgesProjection } from './bim-three-edges';

// ADR-406 / ADR-408 Φ3 — point-based converters re-exported from their own module
// (file-size SSoT, N.7.1). Importers keep `from '.../BimToThreeConverter'`.
export { fixtureToMesh, panelToMesh, manifoldToMesh } from './bim-three-point-converters';

// BIM shape vertices (outerEdge, innerEdge, footprint, outline) are already in meters
// (canvas world coordinates). Scalar params — slab thickness/elevation, beam depth/elevation,
// column height, floorElevationMm — are stored in raw mm and MUST be multiplied by MM_TO_M.
// Exception: wall.params.height is already in meters (wall-completion.ts applies mmToSceneUnits).
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
    attachEdgesProjection(mesh, 'wall', 'common-edges');
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
    if (isWallTilted(wall.params)) {
      const { prisms, lofts } = clipWallBandTopRegionsTilted(
        quad, effTopClip.hosts, effTopClip.nominalTopMm, floorElevationMm, pc.zBotAM, wall.params,
      );
      if (prisms.length === 0 && lofts.length === 0) return false;
      for (const r of prisms) { const g = buildColumnPrismGeometry(r.footprint, r.baseLocalM, r.topLocalM); if (g) emit(g, floorY, mat, layerId); }
      for (const band of lofts) { const g = buildWallLoftBandGeometry(band); if (g) emit(g, floorY, mat, layerId); }
      return true;
    }
    const regions = clipWallBandTopRegions(quad, effTopClip.hosts, effTopClip.nominalTopMm, floorElevationMm, pc.zBotAM);
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
    const flatBase = Math.abs(pc.zBotAM - pc.zBotBM) < 1e-6;
    if (pc.topFollowsProfile && flatBase && tryEmitClip(pc, quad, mat, layerId)) return;

    if (Math.abs(pc.zTopAM - pc.zTopBM) < 1e-6 && flatBase) {
      // Επίπεδη κορυφή ΚΑΙ επίπεδος πάτος → extrude κατά (zTop − zBot).
      const depth = pc.zTopAM - pc.zBotAM;
      if (depth <= 1e-6) return;
      const shape = buildShape(quad);
      if (!shape) return;
      emit(extrudeAndRotate(shape, depth), floorY + pc.zBotAM, mat, layerId);
    } else {
      // Κεκλιμένη κορυφή ή/και πάτος → wedge από ΑΥΤΟ το quad (full piece ή layer sub-quad).
      const wedge = buildSlopedWallPieceGeometry({ ...pc, quad });
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
): THREE.Object3D | null {
  const coreLayer = wall.params.dna?.layers.find((l) => l.side === 'core');
  const matId = coreLayer?.materialId ?? CATEGORY_MAT_ID[wall.params.category] ?? 'mat-concrete';
  const material = getMaterial3D(matId);

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
        ? buildStraightWallWithOpenings(wall, openings, material, floorElevationMm, buildingBaseElevationM, wallTop, wallBase, topClip)
        : buildWallMeshWithOpenings(wall, openings, material, floorElevationMm, buildingBaseElevationM, wallTop, wallBase);
    if (group) {
      group.userData['matId'] = matId;
      if (levelId !== undefined) group.userData['levelId'] = levelId;
      return group;
    }
    // Fall through to solid path if segmenting failed (defensive).
  }

  // ADR-413 — multi-layer curved/polyline (or defensive fall-through): split the
  // single solid into per-layer band solids via the shared layer helper.
  if (isMultiLayerWall(wall.params.dna)) {
    const grp = buildMultiLayerSolidWall(wall, floorElevationMm, buildingBaseElevationM);
    if (grp) {
      grp.userData['matId'] = matId;
      if (levelId !== undefined) grp.userData['levelId'] = levelId;
      return grp;
    }
    // Degenerate → fall through to single-mesh solid (defensive).
  }

  const shape = buildWallShape(
    wall.geometry.outerEdge.points,
    wall.geometry.innerEdge.points,
  );
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, wall.params.height * MM_TO_M);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  // ADR-404 — battered wall: shear το X/Z βάσει ύψους (η κορυφή γέρνει). No-op flat.
  applyWallTilt(geo, wall.params);
  const mesh = new THREE.Mesh(geo, material);
  // ADR-402 — `baseOffset` (mm, base face from storey FFL) lifts the whole wall so the
  // vertical (axis-Y) move arrow shows in 3D. ONLY on this flat solid path: the
  // profiled/pieces path (makeWallBaseLocalFn) already bakes baseOffset into the
  // geometry z, so adding it here too would double-count. baseOffset=0 → no change.
  mesh.position.y = (floorElevationMm + wall.params.baseOffset) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, wall.id, 'wall', matId, levelId);
  attachEdgesProjection(tagged, 'wall', 'common-edges');
  return tagged;
}

export function columnToMesh(
  column: ColumnEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
): THREE.Mesh | null {
  const verts = column.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const matId = column.params.material ?? 'elem-column';

  // ADR-401 Phase F.2 — attached κολώνα (κορυφή Ή/ΚΑΙ βάση): per-corner prism που
  // σταματά στην παρειά κάθε host (στρεβλή/κεκλιμένη κορυφή & βάση). Ενεργό ΜΟΝΟ
  // όταν τουλάχιστον μία γωνία πήρε top/base από host (`hasAttach`)· αλλιώς πέφτει
  // στο ίσιο extrude fast-path παρακάτω (μηδέν regression — μη-attached κολώνα).
  if (topProfile?.hasAttach || baseProfile?.hasAttach) {
    const prism = buildAttachedColumnPrism(verts, floorElevationMm, topProfile, baseProfile);
    if (prism) {
      ensureWorldUvs(prism); // ADR-413 — custom prism has no uv → planar world UVs.
      // ADR-404 — raking column στον attached prism path: το prism ζει σε floor-local
      // Y με βάση στο FFL → baseHeightM=0 (ίδιο datum με τον flat path & το 2Δ). No-op flat.
      applyColumnTilt(prism, column.params);
      const mesh = new THREE.Mesh(prism, getElementMaterial3D('column'));
      mesh.position.y = floorElevationMm * MM_TO_M + buildingBaseElevationM;
      const tagged = tagMesh(mesh, column.id, 'column', matId, levelId);
      attachEdgesProjection(tagged, 'column');
      return tagged;
    }
    // Fall through to flat solid αν το prism εκφυλίζεται (defensive).
  }

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, column.params.height * MM_TO_M);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  // ADR-404 — raking column: shear το X/Z βάσει ύψους (η κορυφή γέρνει). No-op flat.
  applyColumnTilt(geo, column.params);
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('column'));
  // ADR-402 — `baseOffset` lifts the whole column (vertical move). ONLY on this flat
  // path: the attached-prism path bakes baseOffset into its profile z. baseOffset=0 → no change.
  mesh.position.y = (floorElevationMm + column.params.baseOffset) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, column.id, 'column', matId, levelId);
  attachEdgesProjection(tagged, 'column');
  return tagged;
}

/**
 * ADR-401 Phase F.2 — μετατρέπει τα per-corner απόλυτα-mm προφίλ της attached
 * κολώνας σε floor-local μέτρα και χτίζει το prism. Top corners από το
 * `topProfile` (ή flat top σε `maxTopZmm` αν λείπει)· base corners από το
 * `baseProfile` (ή flat base σε `nominalBaseZmm`/`baseZmm`). `localZ = (zmm −
 * FFL_mm) · MM_TO_M` (ίδια σύμβαση με `makeWallTopLocalFn`).
 */
function buildAttachedColumnPrism(
  footprint: readonly Point3D[],
  floorElevationMm: number,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
): THREE.BufferGeometry | null {
  const n = footprint.length;
  const toLocal = (zmm: number): number => (zmm - floorElevationMm) * MM_TO_M;
  // Top: per-corner profile, ή flat στο nominal (maxTopZmm == minTopZmm σε flat top).
  const topZmm = topProfile?.cornerTopZmm ?? new Array<number>(n).fill(baseProfile ? baseProfile.maxBaseZmm : 0);
  // Base: per-corner profile, ή flat στο nominal base (από όποιο προφίλ υπάρχει).
  const nominalBaseZmm = baseProfile?.nominalBaseZmm ?? topProfile?.baseZmm ?? 0;
  const baseZmm = baseProfile?.cornerBaseZmm ?? new Array<number>(n).fill(nominalBaseZmm);
  if (topZmm.length !== n || baseZmm.length !== n) return null;

  const cornerTopLocalM = topZmm.map(toLocal);
  const cornerBaseLocalM = baseZmm.map(toLocal);
  return buildColumnPrismGeometry(
    footprint.map((p) => ({ x: p.x, y: p.y })),
    cornerBaseLocalM,
    cornerTopLocalM,
  );
}

export function beamToMesh(
  beam: BeamEntity,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const beamDepthM = beam.params.depth * MM_TO_M;

  // ADR-363 Φ2 — μεταλλικό δοκάρι Ι/H: πραγματική διατομή σαρωμένη κατά τον άξονα
  // (όχι κουτί). Curved/degenerate → null ⇒ fallback στο ίσιο box extrude παρακάτω.
  let geo: THREE.BufferGeometry | null =
    beam.params.sectionKind === 'I-shape' ? buildSweptIBeamGeometry(beam) : null;

  if (!geo) {
    const verts = beam.geometry.outline.vertices;
    if (verts.length < 3) return null;
    const shape = buildShape(verts);
    if (!shape) return null;
    geo = extrudeAndRotate(shape, beamDepthM);
  }

  ensureWorldUvs(geo); // ADR-413 — box-extrude auto-UVs OR planar for swept-I custom geo.
  applyBeamSlope(geo, beam.params);
  const matId = beam.params.material ?? 'elem-beam';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('beam'));
  // ADR-369 §2.2: topElevation = top of beam; extrusion goes from y=0 → y=depthM.
  // beam hangs DOWN from (topElevation + zOffset) by depth.
  const beamTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  mesh.position.y = beamTopMm * MM_TO_M - beamDepthM + buildingBaseElevationM;
  const tagged = tagMesh(mesh, beam.id, 'beam', matId, levelId);
  attachEdgesProjection(tagged, 'beam');
  return tagged;
}

// ADR-363 §11.Q3 Phase 3.7d + ADR-370 §6 Phase 7 — slab-opening cutouts.
// THREE.Shape.holes requires opposite winding from the outer ring (CCW outer +
// CW holes — clipper-style). BIM polygons are CCW by convention, so we reverse
// each opening's outline before pushing as a THREE.Path. ExtrudeGeometry runs
// native ear-clipping triangulation with holes, mirroring IFC IfcOpeningElement
// voiding IfcSlab (Revit Floor + Opening family pattern).
function pushHoles(shape: THREE.Shape, openings: readonly SlabOpeningEntity[]): void {
  for (const op of openings) {
    const verts = op.params.outline.vertices;
    if (verts.length < 3) continue;
    const path = new THREE.Path();
    // CCW → CW: traverse vertices in reverse.
    const last = verts[verts.length - 1];
    path.moveTo(last.x, last.y);
    for (let i = verts.length - 2; i >= 0; i--) path.lineTo(verts[i].x, verts[i].y);
    path.closePath();
    shape.holes.push(path);
  }
}

export function slabToMesh(
  slab: SlabEntity,
  openings: readonly SlabOpeningEntity[] = [],
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;
  pushHoles(shape, openings);

  const thicknessM = slab.params.thickness * MM_TO_M;
  const geo = extrudeAndRotate(shape, thicknessM);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  applySlabSlope(geo, slab.params);
  const matId = slab.params.material ?? 'elem-slab';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('slab'));
  // ADR-369 §2.1: levelElevation = top face (FFL). Slab hangs DOWN by thickness.
  // floor:0 → -0.20..0m, ceiling/roof:3000 → 2.80..3.00m, foundation:0 → -0.50..0m.
  const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  mesh.position.y = (slabTopMm - slab.params.thickness) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, slab.id, 'slab', matId, levelId);
  attachEdgesProjection(tagged, 'slab', 'common-edges');
  return tagged;
}
