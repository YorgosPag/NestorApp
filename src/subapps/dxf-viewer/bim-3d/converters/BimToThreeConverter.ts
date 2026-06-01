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
import { computeWallOpeningPieces, type WallTopLocalFn, type WallBaseLocalFn } from './wall-opening-pieces';
import { buildSlopedWallPieceGeometry, buildWallLoftBandGeometry } from './wall-piece-geometry';
import { buildColumnPrismGeometry } from './column-piece-geometry';
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
import { resolve3DEdgeStyle } from '../edges/bim-3d-edge-resolver';
import { buildEdgeOverlay, attachEdgeOverlay } from '../edges/bim-3d-edge-overlay-builder';
import type { BimCategory } from '../../config/bim-object-styles';
// File-private geometry primitives (N.7.1 file-size split, 2026-06-01).
import { buildShape, extrudeAndRotate, tagMesh, buildWallShape } from './bim-three-shape-helpers';

// ADR-375 Phase C.7 — default 3D edge resolution context.
// scaleDenominator 100 = 1:100 architectural plan, the most common BIM scale.
// dpi 96 = standard CSS pixel density.
const EDGE_DEFAULT_SCALE = 100;
const EDGE_DEFAULT_DPI = 96;

function attachEdgesProjection(mesh: THREE.Mesh, category: BimCategory): void {
  const style = resolve3DEdgeStyle({
    category,
    cutState: 'projection',
    scaleDenominator: EDGE_DEFAULT_SCALE,
    dpi: EDGE_DEFAULT_DPI,
  });
  attachEdgeOverlay(mesh, buildEdgeOverlay(mesh, style));
}

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
  const emit = (geo: THREE.BufferGeometry, yOffset: number): void => {
    // ADR-404 — battered wall στον pieces path (Δρόμος Β): το ίδιο shear με τον solid
    // path, αλλά αγκυρωμένο στο floor-local ύψος της βάσης του κομματιού (`yOffset −
    // floorY`: flat piece → zBotAM· wedge/prism → 0). No-op flat → byte-for-byte.
    // ΠΡΙΝ το mesh/edges ώστε τα attachEdgesProjection edges να ακολουθούν την κλίση.
    applyWallTilt(geo, wall.params, yOffset - floorY);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = yOffset;
    mesh.userData['bimId'] = wall.id;
    mesh.userData['bimType'] = 'wall';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    attachEdgesProjection(mesh, 'wall');
    group.add(mesh);
  };

  for (const pc of pieces) {
    const flatBase = Math.abs(pc.zBotAM - pc.zBotBM) < 1e-6;
    // ADR-401 γωνιακή διασταύρωση: profile-following κομμάτι attached τοίχου με επίπεδο
    // πάτο → κόψε το plan-quad με τα host footprints σε επίπεδες περιοχές (κάθε μία
    // prism). Δίνει διαγώνιο κατακόρυφο σκαλοπάτι στην αληθινή ακμή του host → μηδέν
    // τριγωνικά κενά. Curved/sloped-base/μη-attached → δεν μπαίνει εδώ (fast path κάτω).
    if (effTopClip && pc.topFollowsProfile && flatBase) {
      if (isWallTilted(wall.params)) {
        // ADR-404 Phase 4.2 — γερμένος τοίχος: σπάσε τα outside regions οριζόντια στο
        // Hu → κάτω prism (base→Hu) + πάνω loft band (Hu→nominal, κατακόρυφη κοπή
        // δοκαριού μετά τον ομοιόμορφο emit shear). 7→9 κομμάτια στη μεταβατική ζώνη.
        const { prisms, lofts } = clipWallBandTopRegionsTilted(
          pc.quad, effTopClip.hosts, effTopClip.nominalTopMm, floorElevationMm, pc.zBotAM, wall.params,
        );
        if (prisms.length > 0 || lofts.length > 0) {
          for (const r of prisms) {
            const prism = buildColumnPrismGeometry(r.footprint, r.baseLocalM, r.topLocalM);
            if (prism) emit(prism, floorY);
          }
          for (const band of lofts) {
            const loft = buildWallLoftBandGeometry(band);
            if (loft) emit(loft, floorY);
          }
          continue;
        }
      } else {
        const regions = clipWallBandTopRegions(
          pc.quad, effTopClip.hosts, effTopClip.nominalTopMm, floorElevationMm, pc.zBotAM,
        );
        if (regions.length > 0) {
          for (const r of regions) {
            const prism = buildColumnPrismGeometry(r.footprint, r.baseLocalM, r.topLocalM);
            if (prism) emit(prism, floorY);
          }
          continue;
        }
      }
      // regions κενό (clip απέτυχε/degenerate) → πέσε στο fast path παρακάτω.
    }

    if (Math.abs(pc.zTopAM - pc.zTopBM) < 1e-6 && flatBase) {
      // Επίπεδη κορυφή ΚΑΙ επίπεδος πάτος → extrude κατά (zTop − zBot).
      const depth = pc.zTopAM - pc.zBotAM;
      if (depth <= 1e-6) continue;
      const shape = buildShape(pc.quad);
      if (!shape) continue;
      emit(extrudeAndRotate(shape, depth), floorY + pc.zBotAM);
    } else {
      // Κεκλιμένη κορυφή ή/και πάτος → wedge με ρητές κορυφές σε floor-local Y.
      const wedge = buildSlopedWallPieceGeometry(pc);
      if (wedge) emit(wedge, floorY);
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

  // ADR-363 Bug 2 — opening cutouts.
  //   - straight walls: vertical-split pieces from the MITERED footprint
  //     (`buildStraightWallWithOpenings`) so corner miters survive (Phase 1J fix).
  //   - curved / polyline: per-segment front-face re-extrude (raw axis — miters
  //     N/A on multi-segment ends; ADR-370 Phase 7 slab-opening pattern).
  // ADR-401 B2/(γ): ο piece path ενεργοποιείται ΚΑΙ χωρίς ανοίγματα όταν υπάρχει
  // μεταβλητή κορυφή Ή μεταβλητός πάτος (το ίσιο solid extrude δεν τα υποστηρίζει).
  if (openings.length > 0 || wallTop || wallBase) {
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

  const shape = buildWallShape(
    wall.geometry.outerEdge.points,
    wall.geometry.innerEdge.points,
  );
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, wall.params.height * MM_TO_M);
  // ADR-404 — battered wall: shear το X/Z βάσει ύψους (η κορυφή γέρνει). No-op flat.
  applyWallTilt(geo, wall.params);
  const mesh = new THREE.Mesh(geo, material);
  // ADR-402 — `baseOffset` (mm, base face from storey FFL) lifts the whole wall so the
  // vertical (axis-Y) move arrow shows in 3D. ONLY on this flat solid path: the
  // profiled/pieces path (makeWallBaseLocalFn) already bakes baseOffset into the
  // geometry z, so adding it here too would double-count. baseOffset=0 → no change.
  mesh.position.y = (floorElevationMm + wall.params.baseOffset) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, wall.id, 'wall', matId, levelId);
  attachEdgesProjection(tagged, 'wall');
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
  const verts = beam.geometry.outline.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const beamDepthM = beam.params.depth * MM_TO_M;
  const geo = extrudeAndRotate(shape, beamDepthM);
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
  applySlabSlope(geo, slab.params);
  const matId = slab.params.material ?? 'elem-slab';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('slab'));
  // ADR-369 §2.1: levelElevation = top face (FFL). Slab hangs DOWN by thickness.
  // floor:0 → -0.20..0m, ceiling/roof:3000 → 2.80..3.00m, foundation:0 → -0.50..0m.
  const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  mesh.position.y = (slabTopMm - slab.params.thickness) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, slab.id, 'slab', matId, levelId);
  attachEdgesProjection(tagged, 'slab');
  return tagged;
}
