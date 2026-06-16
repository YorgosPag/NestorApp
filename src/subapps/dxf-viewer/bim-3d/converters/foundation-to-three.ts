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
import { buildShape, extrudeAndRotate, tagMesh } from './bim-three-shape-helpers';
import { ensureWorldUvs } from './bim-uv-helpers';
import { attachEdgesProjection } from './bim-three-edges';
import { sceneUnitsToMeters } from '../../utils/scene-units';

const MM_TO_M = 0.001;

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
): THREE.Mesh | null {
  const rawVerts = foundation.geometry.footprint.vertices;
  if (rawVerts.length < 3) return null;

  const matId = foundation.params.material ?? 'elem-foundation';

  // ADR-462 — footprint XY (canvas units) → world metres.
  const sceneToM = sceneUnitsToMeters(foundation.params.sceneUnits ?? 'mm');
  const verts = rawVerts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: v.z }));
  const shape = buildShape(verts);
  if (!shape) return null;

  const thicknessMm = Math.max(0, foundation.params.thicknessMm);
  const geo = extrudeAndRotate(shape, thicknessMm * MM_TO_M);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).

  // ADR-445 — per-kind sienna face material (pad/strip/tie-beam ΔΙΑΚΡΙΤΑ, ίδια
  // οικογένεια με την 2Δ κάτοψη). `elem-foundation-${kind}` catalog keys.
  const mesh = new THREE.Mesh(geo, getElementMaterial3D(`foundation-${foundation.kind}`));
  // Hang-down: top face στο topElevationMm, βάση στο (topElevationMm − thickness).
  mesh.position.y =
    (foundation.params.topElevationMm - thicknessMm) * MM_TO_M + buildingBaseElevationM;

  const tagged = tagMesh(mesh, foundation.id, 'foundation', matId, levelId);
  attachEdgesProjection(tagged, 'foundation');
  return tagged;
}
