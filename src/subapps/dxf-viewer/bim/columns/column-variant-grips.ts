/**
 * ADR-363 Phase 4.5b + Phase 8C — Variant-specific column grip handlers
 * (L-shape, T-shape, I-shape).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Extends τα base
 * grips του `column-grips.ts` με 6 ακόμη grips για τις ασύμμετρες/πολύπλοκες
 * διατομές:
 *
 *   - `column-arm-length`         → L-shape. Inner-corner horizontal edge
 *                                    midpoint κατά τοπικό +Y. 1× factor (asymmetric).
 *   - `column-arm-width`          → L-shape. Inner-corner vertical edge
 *                                    midpoint κατά τοπικό +X. 1× factor (asymmetric).
 *   - `column-flange-length`      → T-shape. Δεξιά side edge του πέλματος.
 *                                    2× factor (symmetric γύρω από τον κάθετο άξονα).
 *   - `column-web-thickness`      → T-shape. Δεξιά side edge του κορμού.
 *                                    2× factor (symmetric).
 *   - `column-i-flange-thickness` → I-shape (Phase 8C). Top-flange bottom-edge
 *                                    midpoint κατά τοπικό +Y. 1× factor
 *                                    (bottom flange mirrors automatically μέσω
 *                                    geometry).
 *   - `column-i-web-thickness`    → I-shape (Phase 8C). Αριστερή side edge του
 *                                    κορμού. 2× factor (web centered around y-axis).
 *
 * Όλα clamp στο `MIN_COLUMN_DIMENSION_MM` (250 mm Eurocode) — εκτός I-shape
 * plate thicknesses που clamp στο `MIN_I_PLATE_THICKNESS_MM` (5 mm steel). Όταν
 * `params.lshape` / `params.tshape` / `params.ishape` undefined, οι handlers
 * materialize defaults από `width/3 + depth/3` (L) ή `width + depth/3` (T) ή
 * `DEFAULT_I_FLANGE_THICKNESS_MM` / `DEFAULT_I_WEB_THICKNESS_MM` (I) — mirror
 * των `computeColumnGeometry` defaults — ώστε το επόμενο drag να μην ξαναξεκινά
 * από τα defaults. Non-matching kinds → no-op (`originalParams` referentially).
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY
 *     new `ColumnParams`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5b + Phase 8C
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  ColumnIShapeParams,
  ColumnLshapeParams,
  ColumnParams,
  ColumnTshapeParams,
  ColumnUshapeParams,
} from '../types/column-types';
import {
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  MIN_COLUMN_DIMENSION_MM,
  MIN_I_PLATE_THICKNESS_MM,
} from '../types/column-types';
import { localToWorld, projectDeltaToLocal } from './column-grip-utils';
import { mmScaleFor } from '../../utils/scene-units';
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

// ─── Phase 8C — I-shape (double-T) variant grips ────────────────────────────

/**
 * Materialize I-shape variant params με defaults mirror των
 * `computeColumnGeometry`: `flangeThickness = DEFAULT_I_FLANGE_THICKNESS_MM`
 * (20 mm), `webThickness = DEFAULT_I_WEB_THICKNESS_MM` (15 mm). Exported για
 * unit-test reuse.
 */
export function materializeIshape(
  params: ColumnParams,
): { flangeThickness: number; webThickness: number } {
  return {
    flangeThickness: params.ishape?.flangeThickness ?? DEFAULT_I_FLANGE_THICKNESS_MM,
    webThickness: params.ishape?.webThickness ?? DEFAULT_I_WEB_THICKNESS_MM,
  };
}

/**
 * World position του I-shape flangeThickness grip. Top-flange bottom-edge
 * midpoint (στο `y = depth/2 - tf`, x = 0). Drag κατά +Y μειώνει `flangeThickness`
 * (1× factor, asymmetric edge — bottom flange mirrors automatically μέσω της
 * geometry pipeline ώστε η διατομή να μένει symmetric).
 */
export function iFlangeThicknessHandlePosition(params: ColumnParams): Point2D {
  const { flangeThickness } = materializeIshape(params);
  const local: Point2D = { x: 0, y: params.depth / 2 - flangeThickness };
  return localToWorld(local, params);
}

/**
 * World position του I-shape webThickness grip. Web αριστερή side edge midpoint
 * (στο `x = -tw/2`, y = 0). Drag κατά +X μειώνει `webThickness` με 2× factor
 * (symmetric γύρω από τον κάθετο άξονα — mirror του T-shape web-thickness
 * pattern).
 */
export function iWebThicknessHandlePosition(params: ColumnParams): Point2D {
  const { webThickness } = materializeIshape(params);
  const local: Point2D = { x: -webThickness / 2, y: 0 };
  return localToWorld(local, params);
}

/**
 * Merge a partial I-shape patch με τα materialized defaults ώστε το επόμενο
 * drag να μην ξαναξεκινά από τα `DEFAULT_I_*_THICKNESS_MM`. Preserves
 * `flipY` από το original `ishape` (set από mirror operations, ADR-363 Phase 7.2).
 */
function mergeIshape(
  original: ColumnParams,
  patch: Partial<{ flangeThickness: number; webThickness: number }>,
): ColumnIShapeParams {
  const base = materializeIshape(original);
  const flipY = original.ishape?.flipY;
  return {
    flangeThickness: patch.flangeThickness ?? base.flangeThickness,
    webThickness: patch.webThickness ?? base.webThickness,
    ...(flipY !== undefined ? { flipY } : {}),
  };
}

/**
 * I-shape flangeThickness resize. Top-flange bottom-edge handle κατά τοπικό +Y
 * → 1× factor (asymmetric edge handle — bottom flange mirrors automatically
 * μέσω geometry ώστε η διατομή να μένει symmetric). Drag +Y μειώνει tf· drag
 * -Y αυξάνει tf. Clamps στο `MIN_I_PLATE_THICKNESS_MM` (5 mm). Non-I-shape
 * kinds: no-op.
 */
export function resizeIFlangeThickness(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'I-shape') return originalParams;
  const base = materializeIshape(originalParams);
  const { dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newFlangeThickness = Math.max(MIN_I_PLATE_THICKNESS_MM, base.flangeThickness - dyLocal);
  return {
    ...originalParams,
    ishape: mergeIshape(originalParams, { flangeThickness: newFlangeThickness }),
  };
}

/**
 * I-shape webThickness resize. Web αριστερή side edge handle κατά τοπικό +X
 * → 2× factor (symmetric γύρω από κάθετο άξονα — mirror του T-shape pattern).
 * Drag +X μειώνει tw· drag -X αυξάνει tw. Clamps στο `MIN_I_PLATE_THICKNESS_MM`
 * (5 mm). Non-I-shape kinds: no-op.
 */
export function resizeIWebThickness(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'I-shape') return originalParams;
  const base = materializeIshape(originalParams);
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newWebThickness = Math.max(MIN_I_PLATE_THICKNESS_MM, base.webThickness - 2 * dxLocal);
  return {
    ...originalParams,
    ishape: mergeIshape(originalParams, { webThickness: newWebThickness }),
  };
}

// ─── ADR-363 Phase 2b — U-shape (Π) parametric variant grips ─────────────────

/**
 * Materialize manual parametric U-shape (Π) variant params με defaults mirror
 * των `buildUshapeLocal`: `legThickness = width/4`, `baseThickness = depth/3`.
 * Only meaningful όταν δεν υπάρχει `ushape.polygon` (manual Π). Exported για
 * unit-test reuse.
 */
export function materializeUshape(
  params: ColumnParams,
): { legThickness: number; baseThickness: number } {
  return {
    legThickness: params.ushape?.legThickness ?? params.width / 4,
    baseThickness: params.ushape?.baseThickness ?? params.depth / 3,
  };
}

/**
 * Merge a partial U-shape patch με τα materialized defaults. Preserves `flipY`
 * (set από mirror, ADR-363 Phase 7.2). Δεν αγγίζει `polygon` — οι λαβές αυτές
 * αφορούν ΜΟΝΟ το manual παραμετρικό Π (το polygon-backed χρησιμοποιεί
 * per-vertex grips).
 */
function mergeUshape(
  original: ColumnParams,
  patch: Partial<{ legThickness: number; baseThickness: number }>,
): ColumnUshapeParams {
  const base = materializeUshape(original);
  const flipY = original.ushape?.flipY;
  return {
    legThickness: patch.legThickness ?? base.legThickness,
    baseThickness: patch.baseThickness ?? base.baseThickness,
    ...(flipY !== undefined ? { flipY } : {}),
  };
}

/**
 * World position του U-shape leg-thickness grip. Αριστερό πόδι inner edge
 * midpoint (στο `x = -width/2 + legThickness`, y = 0). Drag κατά +X αυξάνει
 * `legThickness` (1× factor — και τα δύο πόδια ίδιου πάχους μέσω geometry).
 */
export function legThicknessHandlePosition(params: ColumnParams): Point2D {
  const { legThickness } = materializeUshape(params);
  const local: Point2D = { x: -params.width / 2 + legThickness, y: 0 };
  return localToWorld(local, params);
}

/**
 * World position του U-shape base-thickness grip. Άνω ακμή της βάσης midpoint
 * (στο `x = 0`, y = -depth/2 + baseThickness). Drag κατά +Y αυξάνει
 * `baseThickness` (1× factor).
 */
export function baseThicknessHandlePosition(params: ColumnParams): Point2D {
  const { baseThickness } = materializeUshape(params);
  const local: Point2D = { x: 0, y: -params.depth / 2 + baseThickness };
  return localToWorld(local, params);
}

/**
 * U-shape legThickness resize (manual Π). Inner edge αριστερού ποδιού κατά
 * τοπικό +X → 1× factor. Non-U-shape kinds: no-op. Clamp στο
 * `MIN_I_PLATE_THICKNESS_MM` (degenerate guard — `buildUshapeLocal` clamps το
 * άνω όριο σε μισό πλάτος).
 */
export function resizeLegThickness(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'U-shape') return originalParams;
  const s = mmScaleFor(originalParams);
  const base = materializeUshape(originalParams);
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newLeg = Math.max(MIN_I_PLATE_THICKNESS_MM, base.legThickness + dxLocal / s);
  return {
    ...originalParams,
    ushape: mergeUshape(originalParams, { legThickness: newLeg }),
  };
}

/**
 * U-shape baseThickness resize (manual Π). Άνω ακμή βάσης κατά τοπικό +Y → 1×
 * factor. Non-U-shape kinds: no-op. Clamp στο `MIN_I_PLATE_THICKNESS_MM`.
 */
export function resizeBaseThickness(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind !== 'U-shape') return originalParams;
  const s = mmScaleFor(originalParams);
  const base = materializeUshape(originalParams);
  const { dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newBase = Math.max(MIN_I_PLATE_THICKNESS_MM, base.baseThickness + dyLocal / s);
  return {
    ...originalParams,
    ushape: mergeUshape(originalParams, { baseThickness: newBase }),
  };
}
