/**
 * ADR-363 Phase 4.5b — Variant-specific column grip handlers (L-shape, T-shape).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Extends τα base
 * grips του `column-grips.ts` με 4 ακόμη grips για τις ασύμμετρες διατομές:
 *
 *   - `column-arm-length`    → L-shape only. Inner-corner horizontal edge
 *                              midpoint κατά τοπικό +Y. 1× factor (asymmetric).
 *   - `column-arm-width`     → L-shape only. Inner-corner vertical edge
 *                              midpoint κατά τοπικό +X. 1× factor (asymmetric).
 *   - `column-flange-length` → T-shape only. Δεξιά side edge του πέλματος.
 *                              2× factor (symmetric γύρω από τον κάθετο άξονα).
 *   - `column-web-thickness` → T-shape only. Δεξιά side edge του κορμού.
 *                              2× factor (symmetric).
 *
 * Όλα clamp στο `MIN_COLUMN_DIMENSION_MM` (250 mm Eurocode). Όταν
 * `params.lshape` / `params.tshape` undefined, οι handlers materialize
 * defaults από `width/3 + depth/3` (L) ή `width + depth/3` (T) — mirror των
 * `computeColumnGeometry` defaults — ώστε το επόμενο drag να μην ξαναξεκινά
 * από τα defaults. Non-matching kinds → no-op (`originalParams` referentially).
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY
 *     new `ColumnParams`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5b
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  ColumnLshapeParams,
  ColumnParams,
  ColumnTshapeParams,
} from '../types/column-types';
import { MIN_COLUMN_DIMENSION_MM } from '../types/column-types';
import { localToWorld, projectDeltaToLocal } from './column-grip-utils';
import type { ColumnGripDragInput } from './column-grips';

// ─── Variant defaults ────────────────────────────────────────────────────────

/**
 * Materialize L-shape variant params με defaults mirror των
 * `computeColumnGeometry`: `armWidth = width/3`, `armLength = depth/3`.
 * Exported για unit-test reuse.
 */
export function materializeLshape(
  params: ColumnParams,
): { armLength: number; armWidth: number } {
  return {
    armLength: params.lshape?.armLength ?? params.depth / 3,
    armWidth: params.lshape?.armWidth ?? params.width / 3,
  };
}

/**
 * Materialize T-shape variant params με defaults mirror των
 * `computeColumnGeometry`: `flangeLength = width` (full bbox width),
 * `webThickness = depth/3`. Exported για unit-test reuse.
 */
export function materializeTshape(
  params: ColumnParams,
): { flangeLength: number; webThickness: number } {
  return {
    flangeLength: params.tshape?.flangeLength ?? params.width,
    webThickness: params.tshape?.webThickness ?? params.depth / 3,
  };
}

// ─── Variant grip handle positions ───────────────────────────────────────────

/**
 * World position του L-shape arm-length grip. Inner-corner horizontal edge
 * midpoint (κατά τοπικό +Y, στο `y = -depth/2 + armLength`). Drag κατά +Y
 * αυξάνει `armLength` (1× factor, asymmetric arm κατά -Y από bottom edge).
 */
export function armLengthHandlePosition(params: ColumnParams): Point2D {
  const { armLength, armWidth } = materializeLshape(params);
  const local: Point2D = { x: armWidth / 2, y: -params.depth / 2 + armLength };
  return localToWorld(local, params);
}

/**
 * World position του L-shape arm-width grip. Inner-corner vertical edge
 * midpoint (κατά τοπικό +X, στο `x = -width/2 + armWidth`). Drag κατά +X
 * αυξάνει `armWidth` (1× factor, asymmetric arm κατά -X από west edge).
 */
export function armWidthHandlePosition(params: ColumnParams): Point2D {
  const { armLength, armWidth } = materializeLshape(params);
  const local: Point2D = { x: -params.width / 2 + armWidth, y: armLength / 2 };
  return localToWorld(local, params);
}

/**
 * World position του T-shape flange-length grip. Δεξιά side edge του πέλματος
 * (vertical edge στο `x = halfFlange`, midpoint κατά Y). Drag κατά +X αυξάνει
 * `flangeLength` με 2× factor (symmetric γύρω από τον κάθετο άξονα). Mirror
 * του `computeColumnGeometry` flange clamp (`halfFlange = min(width/2, flangeLength/2)`).
 */
export function flangeLengthHandlePosition(params: ColumnParams): Point2D {
  const { flangeLength } = materializeTshape(params);
  const halfFlange = Math.min(params.width / 2, flangeLength / 2);
  const flangeDepth = Math.max(1, params.depth / 3);
  const local: Point2D = { x: halfFlange, y: params.depth / 2 - flangeDepth / 2 };
  return localToWorld(local, params);
}

/**
 * World position του T-shape web-thickness grip. Δεξιά side edge του κορμού
 * (vertical edge στο `x = halfWeb`, midpoint κατά Y στο κάτω μισό κάτω από
 * τη flange base). Drag κατά +X αυξάνει `webThickness` με 2× factor (symmetric).
 */
export function webThicknessHandlePosition(params: ColumnParams): Point2D {
  const { webThickness } = materializeTshape(params);
  const halfWeb = Math.min(params.width / 2, webThickness / 2);
  const flangeDepth = Math.max(1, params.depth / 3);
  const local: Point2D = { x: halfWeb, y: -flangeDepth / 2 };
  return localToWorld(local, params);
}

// ─── Merge helpers ───────────────────────────────────────────────────────────

/**
 * Merge a partial L-shape patch με τα materialized defaults ώστε το επόμενο
 * drag να μην ξαναξεκινά από `width/3 + depth/3`. Preserves οποιαδήποτε
 * παλιά L-shape values που δεν αντικαταστάθηκαν στην τρέχουσα κίνηση.
 */
function mergeLshape(
  original: ColumnParams,
  patch: Partial<{ armLength: number; armWidth: number }>,
): ColumnLshapeParams {
  const base = materializeLshape(original);
  return {
    armLength: patch.armLength ?? base.armLength,
    armWidth: patch.armWidth ?? base.armWidth,
  };
}

/**
 * Merge a partial T-shape patch με τα materialized defaults. Mirror του
 * `mergeLshape` pattern.
 */
function mergeTshape(
  original: ColumnParams,
  patch: Partial<{ flangeLength: number; webThickness: number }>,
): ColumnTshapeParams {
  const base = materializeTshape(original);
  return {
    flangeLength: patch.flangeLength ?? base.flangeLength,
    webThickness: patch.webThickness ?? base.webThickness,
  };
}

// ─── Variant transforms ──────────────────────────────────────────────────────

/**
 * L-shape armLength resize. Inner-corner horizontal edge handle κατά τοπικό
 * +Y → 1× factor (asymmetric arm μεγαλώνει μόνο προς +Y από bottom edge).
 * Non-L-shape kinds: no-op.
 */
export function resizeArmLength(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'L-shape') return originalParams;
  const base = materializeLshape(originalParams);
  const { dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newArmLength = Math.max(MIN_COLUMN_DIMENSION_MM, base.armLength + dyLocal);
  return {
    ...originalParams,
    lshape: mergeLshape(originalParams, { armLength: newArmLength }),
  };
}

/**
 * L-shape armWidth resize. Inner-corner vertical edge handle κατά τοπικό +X
 * → 1× factor (asymmetric arm μεγαλώνει μόνο προς +X από west edge).
 * Non-L-shape kinds: no-op.
 */
export function resizeArmWidth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'L-shape') return originalParams;
  const base = materializeLshape(originalParams);
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newArmWidth = Math.max(MIN_COLUMN_DIMENSION_MM, base.armWidth + dxLocal);
  return {
    ...originalParams,
    lshape: mergeLshape(originalParams, { armWidth: newArmWidth }),
  };
}

/**
 * T-shape flangeLength resize. Δεξιά side edge του πέλματος → 2× factor
 * (symmetric γύρω από κάθετο άξονα, mirror του column-width anchor=center
 * pattern). Non-T-shape kinds: no-op.
 */
export function resizeFlangeLength(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'T-shape') return originalParams;
  const base = materializeTshape(originalParams);
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newFlangeLength = Math.max(MIN_COLUMN_DIMENSION_MM, base.flangeLength + 2 * dxLocal);
  return {
    ...originalParams,
    tshape: mergeTshape(originalParams, { flangeLength: newFlangeLength }),
  };
}

/**
 * T-shape webThickness resize. Δεξιά side edge του κορμού → 2× factor
 * (symmetric γύρω από κάθετο άξονα). Non-T-shape kinds: no-op.
 */
export function resizeWebThickness(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'T-shape') return originalParams;
  const base = materializeTshape(originalParams);
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newWebThickness = Math.max(MIN_COLUMN_DIMENSION_MM, base.webThickness + 2 * dxLocal);
  return {
    ...originalParams,
    tshape: mergeTshape(originalParams, { webThickness: newWebThickness }),
  };
}
