/**
 * bim-three-structural-converters — column / beam / slab → THREE.Mesh.
 *
 * Extracted from BimToThreeConverter.ts (Google file-size SSoT, N.7.1).
 * Covers the load-bearing structural element family:
 *   - Column (ADR-401 Phase F.2 — flat + attached prism)
 *   - Beam  (ADR-363 Φ2 — rectangular box + swept I/H section)
 *   - Slab  (ADR-416 — single extrude + multi-layer composite)
 *
 * Coordinate convention + scaling identical to BimToThreeConverter (see header there).
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh, pushHoles } from './bim-three-shape-helpers';
import { ensureWorldUvs } from './bim-uv-helpers';
import { applyBeamSlope, applySlabSlope, applyColumnTilt } from './mesh-slope-shear';
import { buildColumnPrismGeometry } from './column-piece-geometry';
import { buildSweptIBeamGeometry } from './beam-ishape-geometry';
import { buildMultiLayerSlabSolid } from './slab-multilayer-solid-3d';
import { isMultiLayerSlab } from '../../bim/types/slab-dna-types';
import { attachEdgesProjection } from './bim-three-edges';
import { buildColumnFinishSkin, buildBeamFinishSkin } from './structural-finish-3d';
import { isWallColumnKind } from '../../bim/columns/column-from-faces';
import type { ColumnTopProfile, ColumnBaseProfile } from '../../bim/geometry/column-vertical-profile';

const MM_TO_M = 0.001;

// ── Column ────────────────────────────────────────────────────────────────────

export function columnToMesh(
  column: ColumnEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
  nominalHeightMm?: number,
  walls: readonly WallEntity[] = [],
): THREE.Mesh | THREE.Group | null {
  const verts = column.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  // ADR-448 Phase 1b — storey-ceiling column renders to the real ceiling height
  // (Revit «Top: Up to Level»). Only the flat (non-attached) path; the attached
  // prism above already resolves its top via `topProfile`. No-op without context.
  const flatColumn = (nominalHeightMm !== undefined && Math.abs(nominalHeightMm - column.params.height) > 1e-6)
    ? { ...column, params: { ...column.params, height: nominalHeightMm } }
    : column;

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
      attachEdgesProjection(tagged, 'column', isWallColumnKind(column.kind) ? 'shear-wall' : undefined);
      return tagged;
    }
    // Fall through to flat solid αν το prism εκφυλίζεται (defensive).
  }

  const shape = buildShape(verts);
  if (!shape) return null;

  const geo = extrudeAndRotate(shape, flatColumn.params.height * MM_TO_M);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  // ADR-404 — raking column: shear το X/Z βάσει ύψους (η κορυφή γέρνει). No-op flat.
  applyColumnTilt(geo, flatColumn.params);
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('column'));
  // ADR-402 — `baseOffset` lifts the whole column (vertical move). ONLY on this flat
  // path: the attached-prism path bakes baseOffset into its profile z. baseOffset=0 → no change.
  mesh.position.y = (floorElevationMm + column.params.baseOffset) * MM_TO_M + buildingBaseElevationM;
  const tagged = tagMesh(mesh, column.id, 'column', matId, levelId);
  attachEdgesProjection(tagged, 'column');

  // ADR-449 Slice 2 — additive σοβάς (per-face band skin) ΕΞΩ από τον στατικό
  // πυρήνα. Ενεργό μόνο όταν η κολόνα έχει ενεργό `finish` ΚΑΙ δόθηκαν walls
  // (απών στο ghost path → πυρήνας-only Mesh, μηδέν regression). Flat-path μόνο.
  const finishSkin = buildColumnFinishSkin(flatColumn, walls, mesh.position.y, levelId);
  if (finishSkin) {
    const composite = new THREE.Group();
    composite.add(tagged);
    composite.add(finishSkin);
    composite.userData['bimId'] = column.id;
    composite.userData['bimType'] = 'column';
    return composite;
  }
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

// ── Beam ──────────────────────────────────────────────────────────────────────

export function beamToMesh(
  beam: BeamEntity,
  levelId?: string,
  buildingBaseElevationM = 0,
  walls: readonly WallEntity[] = [],
): THREE.Mesh | THREE.Group | null {
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

  // ADR-449 Slice 4 — additive σοβάς (2 πλάγιες όψεις) ΕΞΩ από τον στατικό πυρήνα.
  // Ενεργό μόνο όταν το δοκάρι έχει ενεργό `finish` (απών → πυρήνας-only Mesh, μηδέν
  // regression). `baseY` = κάτω παρειά (ίδιο datum με το box extrude). Flat-path μόνο.
  const finishSkin = buildBeamFinishSkin(beam, walls, mesh.position.y, levelId);
  if (finishSkin) {
    const composite = new THREE.Group();
    composite.add(tagged);
    composite.add(finishSkin);
    composite.userData['bimId'] = beam.id;
    composite.userData['bimType'] = 'beam';
    return composite;
  }
  return tagged;
}

// ── Slab ──────────────────────────────────────────────────────────────────────

export function slabToMesh(
  slab: SlabEntity,
  openings: readonly SlabOpeningEntity[] = [],
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | THREE.Group | null {
  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return null;

  // ADR-416 — composite Floor/Slab Type: a slab carrying a multi-layer DNA renders
  // as a vertical stack of per-layer sub-solids (Revit Compound Structure / IFC
  // IfcMaterialLayerSet). Single-layer / untyped slabs keep the legacy single
  // extrude below (byte-for-byte — zero regression for the existing ~30 tests).
  if (isMultiLayerSlab(slab.params.dna)) {
    return buildMultiLayerSlabSolid(slab, openings, levelId, buildingBaseElevationM);
  }

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
