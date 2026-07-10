/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) to a paper-resolution PNG, AND projects the column's dimension /
 * bar-mark anchor points through the SAME camera into normalised raster space.
 * The perspective region then draws those projections as ordinary 2D `dim` /
 * `text` primitives → the 3D annotations share the EXACT dimension SSoT
 * (`resolveDimGeometry`: identical arrowheads / lines / text) with the plan and
 * elevation views (FULL SSOT). The raster itself carries ONLY the column image.
 *
 * geometry-is-SSoT: cage from `buildColumnRebarCage`, prism from
 * `computeColumnGeometry().footprint`, dim/mark anchors from the matching spec
 * helpers — no geometry re-derived here. Camera / prism / render / dispose come
 * from the shared `detail-3d-capture-core` (ADR-622; the inline copies are gone).
 *
 * ADR-040: fully offscreen — never touches the live renderer/scene.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/column-detail-3d-capture
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type * as THREE from 'three';
import type { ColumnEntity } from '../../../types/column-types';
import { computeColumnGeometry } from '../../../geometry/column-geometry';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildColumnRebarCage } from '../../../../bim-3d/converters/column-rebar-3d';
import { computeColumnDimSpecs3d } from './column-detail-3d-dims';
import { computeColumnBarMarkSpecs3d } from './column-detail-3d-marks';
import {
  type Detail3dCapture,
  type NormPoint,
  type ProjectedDim,
  type ProjectedMark,
  MM_TO_M,
  buildConcretePrism,
  captureDetail3d,
  projectDims,
  projectMarks,
} from './detail-3d-capture-core';

// Public capture types — re-exported so `ColumnDetail3dCapture` stays the canonical
// capture shape that beam / footing / slab alias and the perspective region consumes.
export type { NormPoint, ProjectedDim, ProjectedMark };
export type ColumnDetail3dCapture = Detail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface ColumnDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Faint concrete prism (footprint extruded along the column height) in the SAME
 * world frame/units as the cage. ADR-462 — footprint vertices live in canvas units;
 * scale plan X/Y to world metres (the SAME `sceneToM` the cage applies) so prism +
 * cage share one frame (else the prism is ~1000× too large and the cage shrinks to
 * a dot). Returns `null` for a degenerate footprint/height (guarded in the core).
 */
function buildColumnPrism(column: ColumnEntity): THREE.Group | null {
  const verts = computeColumnGeometry(column.params).footprint.vertices;
  const heightM = Math.max(0, column.params.height) * MM_TO_M;
  const sceneToM = sceneUnitsToMeters(column.params.sceneUnits ?? 'mm');
  return buildConcretePrism(scalePoints(verts, sceneToM), heightM);
}

/**
 * Captures the column reinforcement as an isometric PNG plus the projected
 * dimension/bar-mark anchors (normalised raster space), or `null` when there is
 * no buildable cage. Disposes every GPU resource it creates.
 */
export function captureColumnDetail3d(
  column: ColumnEntity,
  options: ColumnDetail3dCaptureOptions,
): ColumnDetail3dCapture | null {
  const cage = buildColumnRebarCage(column, 0, column.params.height);
  if (!cage) return null;

  return captureDetail3d({ cage, prism: buildColumnPrism(column) }, options.widthPx, options.heightPx, (camera) => ({
    dims: projectDims(computeColumnDimSpecs3d(column), camera),
    marks: projectMarks(computeColumnBarMarkSpecs3d(column), camera),
  }));
}
