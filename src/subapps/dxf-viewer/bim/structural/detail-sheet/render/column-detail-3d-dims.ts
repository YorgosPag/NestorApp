/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · 3D dimension specs.
 *
 * Returns the W/D/H dimensions of a rectangular column as pairs of **measured 3D
 * points** (world frame, same units as the cage) + value text — NOT rendered
 * geometry. The capture projects these points through the camera and the
 * perspective region draws them as ordinary 2D `dim` primitives, so the 3D
 * dimensions use the EXACT same SSoT (`resolveDimGeometry` → identical extension
 * lines / arrowheads / text) as the plan and elevation views. FULL SSOT.
 *
 * Geometry-is-SSoT: footprint from `computeColumnGeometry().footprint`; values are
 * the raw `ColumnParams` mm (data, not i18n — N.11-safe).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/column-detail-3d-dims
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../../types/column-types';
import { computeColumnGeometry } from '../../../geometry/column-geometry';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';

/** mm → metres (the vertical convention shared with `buildColumnRebarCage`). */
const MM_TO_M = 0.001;
/**
 * Iso azimuth — MUST match `column-detail-3d-capture` CAMERA_AZIMUTH_RAD. Used to
 * pick the base corner that projects furthest right (so the height dimension is
 * anchored just past the rightmost bar #N, to the right of the column).
 */
const ISO_AZIMUTH_RAD = Math.PI / 4;
/** World direction that projects to screen-right in the iso view (camera-right). */
const SCREEN_RIGHT = new THREE.Vector3(Math.cos(ISO_AZIMUTH_RAD), 0, -Math.sin(ISO_AZIMUTH_RAD)).normalize();

/** A dimension as two measured 3D points (world) + the value text. */
export interface ColumnDimSpec3d {
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly text: string;
}

/**
 * Returns the width / depth / height dimension specs for a rectangular column, or
 * an empty array for an unsupported kind / degenerate geometry. Width and depth
 * are measured along the two base footprint edges; height is a vertical leader at
 * the base corner projecting furthest right (just past bar #N).
 */
export function computeColumnDimSpecs3d(column: ColumnEntity): ColumnDimSpec3d[] {
  const { params } = column;
  const verts = computeColumnGeometry(params).footprint.vertices;
  if (verts.length < 3) return [];
  const heightM = Math.max(0, params.height) * MM_TO_M;
  if (heightM <= 0) return [];

  // ADR-460 — bbox του footprint (κάθε σχήμα) → W/D/H dims στις ακμές του bounding box.
  // Vertices σε canvas units· οι ΘΕΣΕΙΣ κλιμακώνονται σε world metres (ίδιο `sceneToM`
  // με τον κλωβό/πρίσμα), αλλιώς οι διαστάσεις ζουν ~1000× μακριά από τον κλωβό.
  const sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  // AXIS_FLIP: plan (x, y) → three (x, 0, −y). Γωνίες bbox στη βάση (world metres).
  const bl = new THREE.Vector3(minX * sceneToM, 0, -minY * sceneToM);
  const br = new THREE.Vector3(maxX * sceneToM, 0, -minY * sceneToM);
  const tr = new THREE.Vector3(maxX * sceneToM, 0, -maxY * sceneToM);
  const tl = new THREE.Vector3(minX * sceneToM, 0, -maxY * sceneToM);
  const rightCorner = [bl, br, tr, tl].reduce(
    (best, p) => (p.dot(SCREEN_RIGHT) > best.dot(SCREEN_RIGHT) ? p : best),
    bl,
  );
  return [
    { a: bl, b: br, text: String(Math.round(maxX - minX)) },
    { a: br, b: tr, text: String(Math.round(maxY - minY)) },
    { a: rightCorner.clone(), b: rightCorner.clone().setY(heightM), text: String(Math.round(params.height)) },
  ];
}
