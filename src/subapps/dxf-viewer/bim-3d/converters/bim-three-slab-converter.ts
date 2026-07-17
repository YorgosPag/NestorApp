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
import { buildShape, extrudeAndRotate, tagMesh, pushHoles, hangDownMeshY, stampBimIdentity, attachElementComponent } from './bim-three-shape-helpers';
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
// ADR-534 Φ4 — soffit finish (ceiling): χρώμα από το shared paint/plaster catalog SSoT.
import { getWallCoveringColor } from '../../bim/wall-coverings/wall-covering-material-catalog';
import { isFinishActive } from '../../bim/finishes/structural-finish-types';
// ADR-539 — Cinema 4D «Polygon Mode»: per-face χρώμα/υλικό μέσω faced multi-material prism.
import { buildFacedSolidBody } from './bim-three-faced-prism';
import type { FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { shouldRenderFaced } from './should-render-faced';

const MM_TO_M = 0.001;

/** ADR-534 Φ4 — πάχος ορατής στρώσης φινιρίσματος οροφής στο 3D (mm). Non-structural. */
const SOFFIT_FINISH_THICKNESS_MM = 10;

// ADR-462 canonical-mm — plan vertices (outline/opening) are CANVAS UNITS (mm under
// canonical-mm), NOT meters. Convert plan XY → Three.js world metres with `× sceneToM`
// where `sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm')`. Vertical scalars (mm)
// keep `× MM_TO_M`. Invariant: `mmToSceneUnits(u) × sceneUnitsToMeters(u) = MM_TO_M`.

/**
 * ADR-476 — προσθέτει τον κλωβό οπλισμού πλάκας (δι-διευθυντική σχάρα κάτω+άνω) στο ήδη
 * συντεθειμένο slab result. Επιστρέφει το ίδιο αντικείμενο όταν ο οπλισμός είναι ανενεργός
 * (view gate / χωρίς `structuralReinforcement`)· το Mesh↔Group composition το κάνει το
 * `attachElementComponent` SSoT (ADR-669 §10).
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
  return attachElementComponent(composed, cage, { bimId: slab.id, bimType: 'slab' });
}

/**
 * ADR-534 Φ4 — προσθέτει λεπτή στρώση φινιρίσματος στην κάτω παρειά (soffit) μιας ceiling πλάκας
 * (Revit «Paint on face» / RCP). Κρέμεται κάτω από το soffit (top face στο soffit, μεγαλώνει προς
 * τα κάτω) ώστε να φαίνεται από κάτω. Χρώμα από το shared paint/plaster catalog SSoT. No-op όταν
 * δεν είναι ceiling ή δεν έχει `soffitFinish`. Το Mesh↔Group upgrade το κάνει το
 * `attachElementComponent` SSoT (ADR-669 §10) — ο σοβάς soffit είναι component όπως ο οπλισμός.
 *
 * ADR-534 Φ5 (Απόφαση Β) — **suppress όταν ενεργός `finish` (σοβάς πλάκας)**: το ενιαίο
 * structural-finish soffit skin (`slabDownSkin`) καλύπτει ήδη την κάτω παρειά· χωρίς αυτό το guard
 * θα είχαμε **διπλό δέρμα** στην ceiling. Mirror του `suppressFinishSkin` (ADR-449 X1). Ανενεργός
 * `finish` → byte-for-byte η προ-Φ5 συμπεριφορά (το `soffitFinish` paint αποδίδεται κανονικά).
 */
function attachSoffitFinish(
  composed: THREE.Mesh | THREE.Group,
  slab: SlabEntity,
  shape: THREE.Shape,
  soffitY: number,
): THREE.Mesh | THREE.Group {
  if (slab.kind !== 'ceiling' || !slab.params.soffitFinish || isFinishActive(slab.params.finish)) return composed;
  const ft = SOFFIT_FINISH_THICKNESS_MM * MM_TO_M;
  const geo = extrudeAndRotate(shape, ft);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(getWallCoveringColor(slab.params.soffitFinish.materialId)),
    roughness: 0.92,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = soffitY - ft; // top face στο soffit, μεγαλώνει προς τα κάτω (ορατό από κάτω)
  stampBimIdentity(mesh, { bimId: slab.id, bimType: 'slab-soffit-finish' });
  return attachElementComponent(composed, mesh, { bimId: slab.id, bimType: 'slab' });
}

/** Legacy single-material slab body (ExtrudeGeometry + slope + world UVs). Unchanged path. */
function buildLegacySlabBody(
  shape: THREE.Shape,
  thicknessM: number,
  params: SlabEntity['params'],
): THREE.Mesh {
  const geo = extrudeAndRotate(shape, thicknessM);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  applySlabSlope(geo, params);
  return new THREE.Mesh(geo, getElementMaterial3D('slab'));
}

/**
 * ADR-539 Φ1/Φ2 — per-face slab body: faced multi-material prism (top/bottom/side:i/hole:h:k).
 * ΧΩΡΙΣ slope (slope=legacy path). Delegate στο shared `buildFacedSolidBody` SSoT (Boy-Scout
 * N.0.2 — foundation = 2ος caller)· baseMat = το slab single-material. Φ2: τα slab-openings
 * περνούν ως holes (cap cut-outs + hole-wall faces) — μετασχηματισμένα στο ΙΔΙΟ (x, −y)
 * cap-plane με το contour του `buildFacedSolidBody`.
 */
function buildFacedSlabBody(
  verts: readonly { readonly x: number; readonly y: number }[],
  thicknessM: number,
  appearance: FaceAppearanceMap,
  holes?: readonly (readonly THREE.Vector2[])[],
): THREE.Mesh | null {
  return buildFacedSolidBody(verts, thicknessM, appearance, getElementMaterial3D('slab'), holes);
}

/**
 * ADR-539 Φ2 — slab-openings → hole rings στο cap-plane του faced prism. Κάθε opening
 * outline (canvas units) → world metres (ίδιο `sceneToM` με το contour) → `Vector2(x, −y)`
 * (mirror του `topRing` transform `world z = −plan y`). Degenerate (<3) απορρίπτεται κάτω.
 */
function slabOpeningHoles(
  openings: readonly SlabOpeningEntity[],
  sceneToM: number,
): readonly THREE.Vector2[][] {
  return openings.map((op) =>
    scalePoints(op.params.outline.vertices, sceneToM).map((p) => new THREE.Vector2(p.x, -p.y)),
  );
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
  const matId = slab.params.material ?? 'elem-slab';
  // ADR-539 Φ1/Φ4b — render faced (multi-material prism, pickable per-face) όταν το slab είναι
  // βαμμένο Ή το Polygon Mode είναι ενεργό (cross-entity multi-face select· βλ. `shouldRenderFaced`
  // SSoT). Αλλιώς legacy single-material extrude (byte-for-byte, zero regression). Φ2: το faced
  // path ΚΟΒΕΙ τα slab-openings (cap cut-outs + hole-walls)· slope μένει legacy-only.
  const fa = slab.faceAppearance;
  const mesh = shouldRenderFaced(fa)
    ? buildFacedSlabBody(verts, thicknessM, fa ?? {}, slabOpeningHoles(openings, sceneToM))
    : buildLegacySlabBody(shape, thicknessM, slab.params);
  if (!mesh) return null;
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
  const composed = applyStructuralCoreVisibility3D(
    attachSlabRebar(tagged, slab, mesh.position.y, levelId), tagged, slab,
  );
  // ADR-534 Φ4 — soffit finish (ceiling): λεπτή χρωματιστή στρώση κάτω από το soffit (RCP/3D).
  return attachSoffitFinish(composed, slab, shape, mesh.position.y);
}
