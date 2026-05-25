/**
 * Wall Opening 3D Extrude — per-segment front-face re-extrude (ADR-363 Bug 2).
 *
 * Purpose: Build a 3D wall mesh με opening cutouts (πόρτες / παράθυρα) ως
 * πραγματικές τρύπες στη γεωμετρία. Mirror του ADR-370 Phase 7 slab-opening
 * THREE.Shape.holes pattern, επεκταμένο για multi-segment walls
 * (straight / curved / polyline) που ο IFC IfcRelVoidsElement ορίζει για
 * IfcWall × IfcOpeningElement.
 *
 * Algorithm (per axis segment a → b):
 *   1. Compute segment direction (ux, uy) + length L_seg σε scene-units.
 *   2. Cumulative arc offset arcStart .. arcStart + L_seg (scene-units).
 *   3. Build front-face THREE.Shape: rectangle (L_seg × wallHeightM) στο
 *      local XY plane (X = along segment, Y = vertical / up).
 *   4. For each opening του wall του οποίου [offsetFromStart, +width] overlaps
 *      [arcStartMm, arcEndMm]: push CW hole rectangle σε local (X = arc offset,
 *      Y = sillHeight..sillHeight+height) σε meters.
 *   5. ExtrudeGeometry depth = thicknessM → extrudes along local +Z (wall
 *      perpendicular).
 *   6. Apply basis matrix: align local +X με segment direction (Three.js Y-up
 *      world; DXF +Y maps to world -Z). Translate origin to a + perpendicular ×
 *      (-thickness/2) ώστε ο τοίχος να κεντράρει στον άξονα.
 *
 * Scene-units convention: matches existing BimToThreeConverter — vertex coords
 * treated as meters (works για 'm' scenes). 'mm'/'cm' scenes inherit the
 * pre-existing 3D scale skew (separate ratchet). Opening offsetFromStart/width
 * (always mm στο Nestor convention) converted to scene-units via
 * mmToSceneUnits() για overlap matching, then to meters για shape coords.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md §6
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { getWallAxisVertices } from '../../bim/geometry/wall-geometry';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 0.001;

/**
 * Build a 3D wall mesh (with opening cutouts when present) as a single THREE.Mesh
 * containing all axis segments. Returns null on degenerate input.
 *
 * `floorElevationMm` + `buildingBaseElevationM`: positions the bottom of the
 * wall (mirror του wallToMesh existing semantic).
 */
export function buildWallMeshWithOpenings(
  wall: WallEntity,
  openings: readonly OpeningEntity[],
  material: THREE.Material,
  floorElevationMm: number,
  buildingBaseElevationM: number,
): THREE.Object3D | null {
  const axisVertices = getWallAxisVertices(wall.params, wall.kind);
  if (axisVertices.length < 2) return null;

  const sceneUnits = wall.params.sceneUnits ?? 'mm';
  const mmFactor = mmToSceneUnits(sceneUnits); // mm → scene-units multiplier
  const wallHeightM = wall.params.height * MM_TO_M;
  const thicknessM = wall.params.thickness * MM_TO_M;
  const floorY = floorElevationMm * MM_TO_M + buildingBaseElevationM;

  const group = new THREE.Group();

  let arcStartScene = 0;

  for (let i = 0; i < axisVertices.length - 1; i++) {
    const a = axisVertices[i];
    const b = axisVertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLenScene = Math.hypot(dx, dy);
    if (segLenScene < 1e-9) continue;

    // Convert scene-segment length to meters for the shape (assumes vertex
    // coords are in meters per existing 3D converter convention).
    const segLenM = segLenScene;
    const ux = dx / segLenScene;
    const uy = dy / segLenScene;

    // Front-face shape (X = along segment, Y = vertical).
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(segLenM, 0);
    shape.lineTo(segLenM, wallHeightM);
    shape.lineTo(0, wallHeightM);
    shape.closePath();

    // Find openings whose arc range overlaps this segment, push as CW holes.
    const arcEndScene = arcStartScene + segLenScene;
    for (const op of openings) {
      const openingStartScene = op.params.offsetFromStart * mmFactor;
      const openingEndScene = openingStartScene + op.params.width * mmFactor;
      if (openingEndScene <= arcStartScene) continue;
      if (openingStartScene >= arcEndScene) continue;

      // Clip to segment range in scene-units, then convert to meters.
      const localStartScene = Math.max(0, openingStartScene - arcStartScene);
      const localEndScene = Math.min(segLenScene, openingEndScene - arcStartScene);
      const localStartM = localStartScene;
      const localEndM = localEndScene;
      const sillM = op.params.sillHeight * MM_TO_M;
      const topM = sillM + op.params.height * MM_TO_M;

      // CW hole winding (THREE.Path) — opposite of outer ring CCW.
      const hole = new THREE.Path();
      hole.moveTo(localStartM, sillM);
      hole.lineTo(localStartM, topM);
      hole.lineTo(localEndM, topM);
      hole.lineTo(localEndM, sillM);
      hole.closePath();
      shape.holes.push(hole);
    }

    // Extrude along local +Z by wall thickness.
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });

    // Build basis: local +X = segment direction in Three.js (DXF Y → -Z),
    // local +Y = world up, local +Z = local-X × world-up (right-hand rule).
    const xAxis = new THREE.Vector3(ux, 0, -uy);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    geo.applyMatrix4(basis);

    const segMesh = new THREE.Mesh(geo, material);
    // Position: a (DXF plan, scene-units → meters) - perpendicular × thickness/2.
    // DXF (x, y) → Three.js (x, 0, -y). Perpendicular in 3D = zAxis (already rotated basis).
    segMesh.position.set(a.x, floorY, -a.y);
    segMesh.position.addScaledVector(zAxis, -thicknessM / 2);

    segMesh.userData['bimId'] = wall.id;
    segMesh.userData['bimType'] = 'wall';
    segMesh.userData['segmentIndex'] = i;
    segMesh.castShadow = true;
    segMesh.receiveShadow = true;
    group.add(segMesh);

    arcStartScene = arcEndScene;
  }

  if (group.children.length === 0) return null;

  group.userData['bimId'] = wall.id;
  group.userData['bimType'] = 'wall';
  return group;
}
