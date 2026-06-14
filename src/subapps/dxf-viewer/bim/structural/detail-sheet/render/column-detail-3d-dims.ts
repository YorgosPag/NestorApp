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
  if (params.kind !== 'rectangular') return [];
  const verts = computeColumnGeometry(params).footprint.vertices;
  if (verts.length < 4) return [];
  const heightM = Math.max(0, params.height) * MM_TO_M;
  if (heightM <= 0) return [];

  // AXIS_FLIP: plan (x, y) → three (x, 0, −y) at the base plane.
  const base = verts.slice(0, 4).map((v) => new THREE.Vector3(v.x, 0, -v.y));
  const rightCorner = base.reduce(
    (best, p) => (p.dot(SCREEN_RIGHT) > best.dot(SCREEN_RIGHT) ? p : best),
    base[0],
  );
  return [
    { a: base[0], b: base[1], text: String(Math.round(params.width)) },
    { a: base[1], b: base[2], text: String(Math.round(params.depth)) },
    { a: rightCorner.clone(), b: rightCorner.clone().setY(heightM), text: String(Math.round(params.height)) },
  ];
}
