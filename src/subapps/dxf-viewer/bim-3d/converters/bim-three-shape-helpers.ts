/**
 * bim-three-shape-helpers — file-private geometry primitives extracted from
 * `BimToThreeConverter.ts` (N.7.1 file-size split, 2026-06-01). Pure functions,
 * ZERO behaviour change: builds THREE.Shape cross-sections from BIM footprints
 * and extrudes/rotates them into Y-up world geometry.
 *
 * Coordinate convention (see BimToThreeConverter header):
 *   DXF plan (mm): X = East, Y = North
 *   Three.js world (m, Y-up): x = East, y = Up, z = -North
 * Build ExtrudeGeometry in the shape's local XY plane, then rotate -π/2 around X
 * so local Z (extrusion) becomes world Y (height).
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
// ADR-458 — ο pure footprint-ring builder ζει στο `wall-geometry` (χωρίς THREE dep· κοινός
// με BOQ/2Δ cutback). Import+re-export εδώ για backward-compat στους 3D callers (SSoT, ένα root).
import { buildWallFootprintRing } from '../../bim/geometry/wall-geometry';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
export { buildWallFootprintRing };

// ── Shared rotation matrix: shape XY → Three.js Y-up ─────────────────────────
const ROT_X_NEG_90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

/** mm → metres — matches every converter's local `MM_TO_M` (ADR-009). */
const MM_TO_M = 0.001;

// ── Vertical render-datum SSoT (ADR-448 §4.1) ────────────────────────────────
// Every BIM solid is positioned FLOOR-RELATIVE: its stored anchor elevation
// (top / bottom / centre) is measured from the active storey FFL, and the storey
// FFL itself sits at `floorElevationMm` above the building datum — the SAME value
// walls & columns add (`columnToMesh`/`wallToMesh`). Centralising the three
// vertical-anchor formulas here guarantees beam / slab / MEP all resolve to ONE
// datum, so a beam can never silently diverge from the column beside it.
//
// Incident (2026-06-16, Giorgio): a foundation tie-beam's floor-relative top
// (1000 mm) was placed at the building datum (world 0) instead of the foundation
// FFL (world −1000 mm) → 1 m too high → clipped by the foundation View-Range cut
// plane (world 0) → invisible in 3D, while the footings (absolute elevation) showed.
// The fix = route the structural hang-down solids through `hangDownMeshY`, exactly
// like the MEP converters already do.
//
// `relMm` = the element's FFL-relative anchor elevation (mm); `floorElevationMm` =
// the storey FFL above the building datum (mm); `buildingBaseElevationM` = the
// building base above the site datum (m). All return a Three.js world-Y in metres.

/** Top face at `floorElevationMm + relTopMm`; the body hangs DOWN by `bodyHeightM`. */
export function hangDownMeshY(
  floorElevationMm: number,
  relTopMm: number,
  bodyHeightM: number,
  buildingBaseElevationM = 0,
): number {
  return (floorElevationMm + relTopMm) * MM_TO_M - bodyHeightM + buildingBaseElevationM;
}

/** Bottom face at `floorElevationMm + relBottomMm`; the body grows UP from there. */
export function floorBaseMeshY(
  floorElevationMm: number,
  relBottomMm: number,
  buildingBaseElevationM = 0,
): number {
  return (floorElevationMm + relBottomMm) * MM_TO_M + buildingBaseElevationM;
}

/** Box centred on `floorElevationMm + relCentreMm`; bottom at centre − bodyHeight/2. */
export function centeredMeshY(
  floorElevationMm: number,
  relCentreMm: number,
  bodyHeightM: number,
  buildingBaseElevationM = 0,
): number {
  return (floorElevationMm + relCentreMm) * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
}

export function toShapePoints(pts: readonly Point3D[]): { x: number; y: number }[] {
  return projectVerticesTo2D(pts);
}

export function buildShape(outer: readonly Point3D[], inner?: readonly Point3D[]): THREE.Shape | null {
  if (outer.length < 2) return null;
  const shape = new THREE.Shape();
  const [first, ...rest] = toShapePoints(outer);
  shape.moveTo(first.x, first.y);
  for (const pt of rest) shape.lineTo(pt.x, pt.y);
  shape.closePath();

  if (inner && inner.length >= 2) {
    const hole = new THREE.Path();
    const [h0, ...hRest] = toShapePoints(inner);
    hole.moveTo(h0.x, h0.y);
    for (const pt of hRest) hole.lineTo(pt.x, pt.y);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

export function extrudeAndRotate(shape: THREE.Shape, depthM: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  return geo;
}

/**
 * ADR-458 — extrude ΠΟΛΛΑΠΛΩΝ disjoint shapes σε ΕΝΑ geometry (THREE.ExtrudeGeometry
 * δέχεται array of shapes → ένα BufferGeometry, ένα mesh, ένα material). Χρήση: το
 * beam-to-column cutback που χωρίζει ένα δοκάρι σε ≥1 κομμάτια. Άδειο array → null.
 */
export function extrudeShapesAndRotate(shapes: readonly THREE.Shape[], depthM: number): THREE.BufferGeometry | null {
  if (shapes.length === 0) return null;
  const geo = new THREE.ExtrudeGeometry([...shapes], { depth: depthM, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_NEG_90);
  return geo;
}

export function tagMesh(mesh: THREE.Mesh, id: string, type: string, matId: string, levelId?: string): THREE.Mesh {
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = type;
  mesh.userData['matId'] = matId;
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ADR-363 §11.Q3 Phase 3.7d + ADR-370 §6 Phase 7 — slab-opening cutouts.
// THREE.Shape.holes requires opposite winding from the outer ring (CCW outer +
// CW holes — clipper-style). BIM polygons are CCW by convention, so we reverse
// each opening's outline before pushing as a THREE.Path. ExtrudeGeometry runs
// native ear-clipping triangulation with holes, mirroring IFC IfcOpeningElement
// voiding IfcSlab (Revit Floor + Opening family pattern). Extracted from
// BimToThreeConverter (N.7.1 SSoT) so the single- AND multi-layer slab builders
// share one hole-cutting routine.
// ADR-462 — `sceneToM` scales the opening outline (canvas units) into world metres,
// matching the outer slab ring. Defaults to 1 for callers that already pass metre-space
// geometry. Must equal the slab's `sceneUnitsToMeters(sceneUnits)`.
export function pushHoles(
  shape: THREE.Shape,
  openings: readonly SlabOpeningEntity[],
  sceneToM = 1,
): void {
  for (const op of openings) {
    const verts = op.params.outline.vertices;
    if (verts.length < 3) continue;
    const v = scalePoints(verts, sceneToM); // ADR-462 canvas units → world metres (SSoT)
    const path = new THREE.Path();
    // CCW → CW: traverse vertices in reverse.
    path.moveTo(v[v.length - 1].x, v[v.length - 1].y);
    for (let i = v.length - 2; i >= 0; i--) path.lineTo(v[i].x, v[i].y);
    path.closePath();
    shape.holes.push(path);
  }
}

// Wall footprint ring (closed polygon): trace outer forward → inner backward.
// outerEdge and innerEdge are each open polylines (not closed polygons). ADR-539 Φ3c —
// SSoT for BOTH the THREE.Shape cross-section (legacy solid) AND the faced prism ring
// (`buildFacedSolidBody`), so a faced wall's per-face `side:i` indices match the legacy
// solid exactly (outer faces first, then the closing end + inner faces).
export function buildWallShape(outer: readonly Point3D[], inner: readonly Point3D[]): THREE.Shape | null {
  if (outer.length < 2 || inner.length < 2) return null;
  const ring = buildWallFootprintRing(outer, inner);
  const shape = new THREE.Shape();
  shape.moveTo(ring[0].x, ring[0].y);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i].x, ring[i].y);
  shape.closePath();
  return shape;
}
