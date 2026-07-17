/**
 * foundation-to-three — FoundationEntity → THREE.Mesh (ADR-436, Slice 1).
 *
 * Mirror του flat-path `columnToMesh`. Total over `FoundationKind`: το ίδιο
 * footprint-extrude path καλύπτει pad + strip + tie-beam (το footprint είναι
 * ορθογώνιο και στα 3· stepped/sloped pad = Slice 1b).
 *
 * Elevation (ADR-369): η θεμελίωση είναι ΚΑΤΩ από τη στάθμη. Το `topElevationMm`
 * είναι ΑΠΟΛΥΤΗ στάθμη άνω παρειάς (από project origin, τυπικά αρνητική)· το
 * στερεό extrude-άρεται προς τα πάνω, οπότε τοποθετούμε τη βάση στο
 * `(topElevationMm − thicknessMm)` ώστε να κρέμεται ΚΑΤΩ:
 *
 *   mesh.position.y = (topElevationMm − thicknessMm) · MM_TO_M + buildingBaseElevationM
 *
 * Coordinate convention + scaling identical to BimToThreeConverter.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §5
 */

import * as THREE from 'three';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh, stampBimIdentity } from './bim-three-shape-helpers';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { ensureWorldUvs } from './bim-uv-helpers';
import { attachEdgesProjection } from './bim-three-edges';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
import { applyStructuralCoreVisibility3D } from './structural-core-visibility-3d';
import { buildFootingRebarCage } from './footing-rebar-3d';
// ADR-539 Φ1.5 — Cinema 4D «Polygon Mode» per-face appearance (faced multi-material prism).
import { buildFacedSolidBody } from './bim-three-faced-prism';
import { shouldRenderFaced } from './should-render-faced';

const MM_TO_M = 0.001;

/**
 * ADR-463 — προσαρτά τον κλωβό οπλισμού (αν ορατός + ορισμένος) σε ΕΝΑ wrapper
 * group δίπλα στο στερεό (mirror του `attachColumnRebar`). `bottomY` = absolute
 * world Y της βάσης του στερεού (= `mesh.position.y`). No-op όταν ο διακόπτης
 * «Οπλισμός» είναι κλειστός ή δεν υπάρχει οπλισμός.
 */
function attachFoundationRebar(
  mesh: THREE.Mesh,
  foundation: FoundationEntity,
  bottomY: number,
  levelId: string | undefined,
): THREE.Object3D {
  // ADR-470 — per-element οπλισμός override → per-view flag (Revit precedence).
  if (!isStructuralComponentVisible('reinforcement', foundation)) return mesh;
  const cage = buildFootingRebarCage(foundation, bottomY, levelId);
  if (!cage) return mesh;
  const group = new THREE.Group();
  group.add(mesh);
  group.add(cage);
  stampBimIdentity(group, { bimId: foundation.id, bimType: 'foundation', levelId });
  return group;
}

/**
 * Build the 3Δ mesh για ένα `FoundationEntity`. Returns `null` για εκφυλισμένο
 * footprint (< 3 κορυφές).
 *
 * `_floorElevationMm` αγνοείται σκόπιμα: η στάθμη της θεμελίωσης είναι ΑΠΟΛΥΤΗ
 * (`topElevationMm`), όχι σχετική με το ενεργό πάτωμα — αλλιώς θα διπλο-
 * μετρούσαμε το datum. Ο param κρατιέται για signature parity με τα structural
 * converters (positional call από το `syncFoundations`).
 */
export function foundationToMesh(
  foundation: FoundationEntity,
  _floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const rawVerts = foundation.geometry.footprint.vertices;
  if (rawVerts.length < 3) return null;

  const matId = foundation.params.material ?? 'elem-foundation';

  // ADR-462 — footprint XY (canvas units) → world metres.
  const sceneToM = sceneUnitsToMeters(foundation.params.sceneUnits ?? 'mm');
  const verts = scalePoints(rawVerts, sceneToM);
  const shape = buildShape(verts);
  if (!shape) return null;

  const thicknessMm = Math.max(0, foundation.params.thicknessMm);
  const thicknessM = thicknessMm * MM_TO_M;

  // ADR-445 — per-kind sienna face material (pad/strip/tie-beam ΔΙΑΚΡΙΤΑ, ίδια
  // οικογένεια με την 2Δ κάτοψη). `elem-foundation-${kind}` catalog keys.
  const baseMat = getElementMaterial3D(`foundation-${foundation.kind}`);

  // ADR-539 Φ1.5 — render faced (multi-material prism, pickable per-face) when EITHER the
  // foundation already carries a `faceAppearance` OR it is the live Polygon-Mode target (so
  // its faces become pickable even before any paint — solves the chicken-and-egg). Otherwise
  // the legacy single-material extrude (byte-for-byte, zero regression). The faced prism has
  // the SAME local span [0, thicknessM] as `extrudeAndRotate`, so `position.y` is unchanged.
  // Πέδιλο = flat (κανένα opening) → καμία ανάγκη holes/slope (αρχιτεκτονική solid-agnostic).
  const fa = foundation.faceAppearance;
  let mesh: THREE.Mesh | null;
  if (shouldRenderFaced(fa)) {
    mesh = buildFacedSolidBody(verts, thicknessM, fa ?? {}, baseMat);
  } else {
    const geo = extrudeAndRotate(shape, thicknessM);
    ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
    mesh = new THREE.Mesh(geo, baseMat);
  }
  if (!mesh) return null;
  // Hang-down: top face στο topElevationMm, βάση στο (topElevationMm − thickness).
  mesh.position.y =
    (foundation.params.topElevationMm - thicknessMm) * MM_TO_M + buildingBaseElevationM;

  const tagged = tagMesh(mesh, foundation.id, 'foundation', matId, levelId);
  attachEdgesProjection(tagged, 'foundation');
  // ADR-463 — οπλισμός 3Δ ως sibling cage (mirror κολώνας)· no-op όταν κρυφός/απών.
  // ADR-470 — core gate: κρύβει το σώμα πεδίλου αν ανενεργό (οπλισμός μένει ορατός).
  return applyStructuralCoreVisibility3D(
    attachFoundationRebar(tagged, foundation, mesh.position.y, levelId),
    tagged, foundation,
  );
}
