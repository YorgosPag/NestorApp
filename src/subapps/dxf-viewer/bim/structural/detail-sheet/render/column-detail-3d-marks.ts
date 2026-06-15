/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · 3D bar-mark specs.
 *
 * Returns the longitudinal bar position numbers (#1…#N) as **3D points** (the bar
 * tops, world frame) + mark text — NOT rendered geometry. The capture projects
 * them through the camera and the perspective region draws them as ordinary 2D
 * `text` primitives, so the bar marks use the SAME text rendering (size/font) as
 * the rest of the sheet. FULL SSOT. Numbering comes from the shared
 * `assignColumnBarNumbers` SSoT, so a 3D mark matches the plan's mark.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/column-detail-3d-marks
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../../types/column-types';
import { columnLocalMmToWorld } from '../../../geometry/column-geometry';
import { resolveColumnRebarLayoutForParams } from '../../reinforcement/column-rebar-layout-resolve';
import { assignColumnBarNumbers } from '../column-rebar-bar-marks';

/** mm → metres (the vertical convention shared with `buildColumnRebarCage`). */
const MM_TO_M = 0.001;
/** Lift of the mark above the bar top, as a fraction of the cross-section span. */
const MARK_LIFT_FRACTION = 0.18;

/** A bar mark as a 3D anchor point (bar top, world) + the number text. */
export interface ColumnBarMarkSpec3d {
  readonly pos: THREE.Vector3;
  readonly text: string;
}

/**
 * Returns the bar-mark specs for a rectangular reinforced column, or an empty
 * array for an unsupported kind / missing reinforcement. Each mark is anchored
 * just above its longitudinal bar's top.
 */
export function computeColumnBarMarkSpecs3d(column: ColumnEntity): ColumnBarMarkSpec3d[] {
  const { params } = column;
  const numbers = assignColumnBarNumbers(params);
  if (!params.reinforcement || !numbers) return [];
  const layout = resolveColumnRebarLayoutForParams(params.reinforcement, params);
  if (!layout) return [];
  const heightM = Math.max(0, params.height) * MM_TO_M;
  if (heightM <= 0) return [];

  const world = columnLocalMmToWorld(params, layout.longitudinalBarsMm);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of world) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const lift = Math.max(maxX - minX, maxY - minY, 1e-4) * MARK_LIFT_FRACTION;
  // AXIS_FLIP: plan (x, y) → three (x, height, −y); lift slightly above the top.
  return world.map((p, i) => ({
    pos: new THREE.Vector3(p.x, heightM + lift, -p.y),
    text: String(numbers[i]),
  }));
}
