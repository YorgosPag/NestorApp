/**
 * ADR-583 Φ2 / ADR-608 — Graphic scale-bar LAYOUT builder (frame-space SSoT).
 *
 * THE single source of truth for a scale-bar's drawn geometry: body cells, tick
 * segments, subdivision cells and boundary/unit labels, expressed in the bar's own
 * **frame space** `(s, t)` — `s` = distance ALONG the axis (canonical-mm from
 * `position`), `t` = perpendicular offset (canonical-mm, +t = above the baseline).
 * Coordinate-system-agnostic on purpose: a caller supplies the frame→X map and the
 * SAME primitives drive BOTH backends —
 *   • `ScaleBarRenderer` maps `(s,t)` → screen and stamps to a canvas ctx, and
 *   • `annotation-to-primitives` maps `(s,t)` → world and emits neutral
 *     `Entity[]` for the vector-PDF / DXF export.
 * Extracting the layout here removes the structural clone that would otherwise
 * exist between the on-screen renderer and the export decomposer (N.18).
 *
 * The two-formula split is preserved: the span + division boundaries come straight
 * from `computeScaleBarGeometry` (scale-INVARIANT model distance), while the bar
 * thickness / tick length / label height are ANNOTATIVE (folded through
 * `paperHeightToModel` here, once), so both consumers agree pixel-for-pixel.
 *
 * @see bim/geometry/scale-bar-geometry.ts — `computeScaleBarGeometry` (span SSoT)
 * @see utils/annotation-scale.ts — `paperHeightToModel` (annotative sizing SSoT)
 * @see rendering/entities/scale-bar/stamp-scale-bar-primitives.ts — the canvas backend
 * @see export/core/annotation-to-primitives.ts — the vector/DXF backend
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { SceneUnits } from '../../utils/scene-units';
import { paperHeightToModel } from '../../utils/annotation-scale';
import {
  computeScaleBarGeometry,
} from '../geometry/scale-bar-geometry';
import type { ScaleBarEntity, ScaleBarGeometry } from '../../types/scale-bar';
import {
  DEFAULT_SCALE_BAR_HEIGHT_MM,
  DEFAULT_SCALE_BAR_LABEL_MM,
} from '../../types/entities';

/** A point in the bar's frame: `s` along the axis, `t` perpendicular (canonical-mm). */
export interface ScaleBarFramePoint {
  readonly s: number;
  readonly t: number;
}

/** One drawable element of a scale bar, in frame space (backend-agnostic). */
export type ScaleBarFramePrimitive =
  | { readonly kind: 'segment'; readonly a: ScaleBarFramePoint; readonly b: ScaleBarFramePoint }
  | { readonly kind: 'cell'; readonly corners: readonly ScaleBarFramePoint[]; readonly filled: boolean }
  | {
      readonly kind: 'label';
      readonly at: ScaleBarFramePoint;
      readonly text: string;
      /** Cap height in model-mm (annotative); each backend folds it to its own unit. */
      readonly heightMm: number;
      readonly align: 'center' | 'left';
    };

/**
 * Build the full frame-space primitive list for a scale bar. Pure + idempotent.
 * `drawingScale` / `sceneUnits` drive ONLY the annotative thickness/label height —
 * the span geometry is scale-invariant (see file header).
 */
export function buildScaleBarPrimitives(
  entity: ScaleBarEntity,
  drawingScale: number,
  sceneUnits: SceneUnits,
): readonly ScaleBarFramePrimitive[] {
  const geo = computeScaleBarGeometry(entity, drawingScale, sceneUnits);

  const thicknessMm = paperHeightToModel(
    entity.barHeightMm ?? DEFAULT_SCALE_BAR_HEIGHT_MM, drawingScale, sceneUnits,
  );
  const labelHeightMm = paperHeightToModel(
    entity.labelHeightMm ?? DEFAULT_SCALE_BAR_LABEL_MM, drawingScale, sceneUnits,
  );

  return [
    ...bodyPrimitives(entity.style, geo.divisionBoundariesMm, thicknessMm),
    ...subdivisionPrimitives(geo.subdivisionOffsetsMm, thicknessMm),
    ...labelPrimitives(entity, geo, thicknessMm, labelHeightMm),
  ];
}

// ─── Body styles (mirror ScaleBarRenderer.drawBody, now the SSoT) ──────────────

function bodyPrimitives(
  style: ScaleBarEntity['style'],
  boundaries: readonly number[],
  thickness: number,
): ScaleBarFramePrimitive[] {
  switch (style) {
    case 'line-ticks':
      return lineTickPrimitives(boundaries, thickness);
    case 'double':
      return doubleRowPrimitives(boundaries, thickness);
    case 'hollow':
      return cellPrimitives(boundaries, thickness, () => false);
    case 'alternating':
    default:
      // Outline every cell; fill the even (0,2,4,…) ones → classic checker.
      return cellPrimitives(boundaries, thickness, (i) => i % 2 === 0);
  }
}

/** Baseline segment + a vertical tick at each major boundary (t: 0 → thickness). */
function lineTickPrimitives(
  boundaries: readonly number[],
  thickness: number,
): ScaleBarFramePrimitive[] {
  if (boundaries.length === 0) return [];
  const prims: ScaleBarFramePrimitive[] = [
    { kind: 'segment', a: { s: boundaries[0], t: 0 }, b: { s: boundaries[boundaries.length - 1], t: 0 } },
  ];
  for (const s of boundaries) {
    prims.push({ kind: 'segment', a: { s, t: 0 }, b: { s, t: thickness } });
  }
  return prims;
}

/** Two half-height rows, checkerboarded (top fills even cells, bottom fills odd). */
function doubleRowPrimitives(
  boundaries: readonly number[],
  thickness: number,
): ScaleBarFramePrimitive[] {
  const mid = thickness / 2;
  const prims: ScaleBarFramePrimitive[] = [];
  forEachCell(boundaries, (a, b, i) => {
    prims.push(cell(a, b, mid, thickness, i % 2 === 0));
    prims.push(cell(a, b, 0, mid, i % 2 === 1));
  });
  return prims;
}

/** One full-height cell per major interval; `fill(i)` decides the checker fill. */
function cellPrimitives(
  boundaries: readonly number[],
  thickness: number,
  fill: (index: number) => boolean,
): ScaleBarFramePrimitive[] {
  const prims: ScaleBarFramePrimitive[] = [];
  forEachCell(boundaries, (a, b, i) => prims.push(cell(a, b, 0, thickness, fill(i))));
  return prims;
}

/** Fine sub-tick cells inside the left extension, alternating fill (LEFT of '0'). */
function subdivisionPrimitives(
  offsets: readonly number[],
  thickness: number,
): ScaleBarFramePrimitive[] {
  const prims: ScaleBarFramePrimitive[] = [];
  let prev = 0;
  offsets.forEach((off, k) => {
    // Offsets are positive magnitudes measured LEFT of the origin → negate along axis.
    prims.push(cell(-prev, -off, 0, thickness, k % 2 === 0));
    prev = off;
  });
  return prims;
}

// ─── Labels (mirror draw-scale-bar-labels, now the SSoT) ───────────────────────

function labelPrimitives(
  entity: ScaleBarEntity,
  geo: ScaleBarGeometry,
  thicknessMm: number,
  labelHeightMm: number,
): ScaleBarFramePrimitive[] {
  // Numerals: 'below' → opposite side of the band; 'above' → past the band top.
  const gap = thicknessMm * 0.3;
  const labelPerpMm =
    entity.labelPlacement === 'above'
      ? thicknessMm + gap + labelHeightMm / 2
      : -(gap + labelHeightMm / 2);

  const prims: ScaleBarFramePrimitive[] = geo.boundaryLabels.map((label) => ({
    kind: 'label',
    at: { s: label.offsetMm, t: labelPerpMm },
    text: label.text,
    heightMm: labelHeightMm,
    align: 'center',
  }));

  // Trailing unit label ("m" / "ft" / …), left-aligned just past the far end.
  prims.push({
    kind: 'label',
    at: { s: geo.totalModelLengthMm + labelHeightMm, t: labelPerpMm },
    text: geo.unitText,
    heightMm: labelHeightMm,
    align: 'left',
  });
  return prims;
}

// ─── Shared cell helpers ───────────────────────────────────────────────────────

/** Iterate adjacent boundary pairs as (axisStart, axisEnd, index) cells. */
function forEachCell(
  boundaries: readonly number[],
  fn: (axisStart: number, axisEnd: number, index: number) => void,
): void {
  for (let i = 0; i < boundaries.length - 1; i++) fn(boundaries[i], boundaries[i + 1], i);
}

/** One rectangular cell (4 corners CCW) in the bar's frame — stroked always, filled per flag. */
function cell(
  axisStart: number,
  axisEnd: number,
  perpLo: number,
  perpHi: number,
  filled: boolean,
): ScaleBarFramePrimitive {
  return {
    kind: 'cell',
    corners: [
      { s: axisStart, t: perpLo },
      { s: axisEnd, t: perpLo },
      { s: axisEnd, t: perpHi },
      { s: axisStart, t: perpHi },
    ],
    filled,
  };
}
