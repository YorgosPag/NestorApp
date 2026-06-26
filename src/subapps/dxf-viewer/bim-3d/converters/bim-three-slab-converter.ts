/**
 * bim-three-slab-converter — slab → THREE.Mesh.
 *
 * Extracted from bim-three-structural-converters.ts (Google file-size SSoT, N.7.1).
 * Covers the slab family:
 *   - Slab (ADR-416 — single extrude + multi-layer composite)
 *
 * Coordinate convention + scaling identical to BimToThreeConverter (see header there).
 */

import * as THREE from 'three';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh, pushHoles, hangDownMeshY } from './bim-three-shape-helpers';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { ensureWorldUvs } from './bim-uv-helpers';
import { applySlabSlope } from './mesh-slope-shear';
import { buildMultiLayerSlabSolid } from './slab-multilayer-solid-3d';
import { isMultiLayerSlab } from '../../bim/types/slab-dna-types';
import { attachEdgesProjection } from './bim-three-edges';
// ADR-470 — per-component visibility resolver SSoT (σώμα/σοβάς/οπλισμός· per-element + per-view).
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
import { applyStructuralCoreVisibility3D } from './structural-core-visibility-3d';
// ADR-476 — 3Δ κλωβός οπλισμού πλάκας (δι-διευθυντική σχάρα κάτω+άνω· κοινό SSoT με το 2Δ).
import { buildSlabRebarCage } from './slab-rebar-3d';
import { sceneUnitsToMeters } from '../../utils/scene-units';

const MM_TO_M = 0.001;

// ADR-462 canonical-mm — plan vertices (outline/opening) are CANVAS UNITS (mm under
// canonical-mm), NOT meters. Convert plan XY → Three.js world metres with `× sceneToM`
// where `sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm')`. Vertical scalars (mm)
// keep `× MM_TO_M`. Invariant: `mmToSceneUnits(u) × sceneUnitsToMeters(u) = MM_TO_M`.

/**
 * ADR-476 — προσθέτει τον κλωβό οπλισμού πλάκας (δι-διευθυντική σχάρα κάτω+άνω) στο ήδη
 * συντεθειμένο slab result. Mirror του `attachBeamRebar`: επιστρέφει το ίδιο αντικείμενο
 * όταν ο οπλισμός είναι ανενεργός (view gate / χωρίς `structuralReinforcement`).
 * `bottomFaceY` = κάτω παρειά πλάκας (= `mesh.position.y` → ίδιο datum, ευθυγράμμιση).
 * Gate μόνο στον δικό του διακόπτη `showReinforcement` (ADR-470 precedence).
 */
function attachSlabRebar(
  composed: THREE.Mesh | THREE.Group,
  slab: SlabEntity,
  bottomFaceY: number,
  levelId: string | undefined,
): THREE.Mesh | THREE.Group {
  if (!isStructuralComponentVisible('reinforcement', slab)) return composed;
  const cage = buildSlabRebarCage(slab, bottomFaceY, levelId);
  if (!cage) return composed;
  if (composed instanceof THREE.Group) {
    composed.add(cage);
    return composed;
  }
  const group = new THREE.Group();
  group.add(composed);
  group.add(cage);
  group.userData['bimId'] = slab.id;
  group.userData['bimType'] = 'slab';
  return group;
}

export function slabToMesh(
  slab: SlabEntity,
  openings: readonly SlabOpeningEntity[] = [],
  levelId?: string,
  buildingBaseElevationM = 0,
  floorElevationMm = 0, // ADR-448 §4.1 — storey FFL (datum-relative) for floor-aware placement
): THREE.Mesh | THREE.Group | null {
  const rawVerts = slab.params.outline.vertices;
  if (rawVerts.length < 3) return null;

  // ADR-416 — composite Floor/Slab Type: a slab carrying a multi-layer DNA renders
  // as a vertical stack of per-layer sub-solids (Revit Compound Structure / IFC
  // IfcMaterialLayerSet). Single-layer / untyped slabs keep the legacy single
  // extrude below (byte-for-byte — zero regression for the existing ~30 tests).
  if (isMultiLayerSlab(slab.params.dna)) {
    return buildMultiLayerSlabSolid(slab, openings, levelId, buildingBaseElevationM, floorElevationMm);
  }

  // ADR-462 — outline + opening holes (canvas units) → world metres.
  const sceneToM = sceneUnitsToMeters(slab.params.sceneUnits ?? 'mm');
  const verts = scalePoints(rawVerts, sceneToM);
  const shape = buildShape(verts);
  if (!shape) return null;
  pushHoles(shape, openings, sceneToM);

  const thicknessM = slab.params.thickness * MM_TO_M;
  const geo = extrudeAndRotate(shape, thicknessM);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  applySlabSlope(geo, slab.params);
  const matId = slab.params.material ?? 'elem-slab';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('slab'));
  // ADR-369 §2.1: levelElevation = top face (FFL). Slab hangs DOWN by thickness.
  // floor:0 → -0.20..0m, ceiling/roof:3000 → 2.80..3.00m, foundation:0 → -0.50..0m.
  // ADR-448 §4.1 — levelElevation is FLOOR-RELATIVE, so add the storey FFL via the
  // SSoT `hangDownMeshY` (mirror beam/column); 0 on the ground floor → zero regression.
  const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  mesh.position.y = hangDownMeshY(floorElevationMm, slabTopMm, slab.params.thickness * MM_TO_M, buildingBaseElevationM);
  const tagged = tagMesh(mesh, slab.id, 'slab', matId, levelId);
  attachEdgesProjection(tagged, 'slab', 'common-edges');
  // ADR-470 — core gate: κρύβει το σώμα πλάκας αν ανενεργό (ο οπλισμός μένει ορατός).
  // ADR-476 — κλωβός σχάρας (κάτω+άνω) στην κάτω παρειά (mesh.position.y), gated `showReinforcement`.
  return applyStructuralCoreVisibility3D(
    attachSlabRebar(tagged, slab, mesh.position.y, levelId), tagged, slab,
  );
}
