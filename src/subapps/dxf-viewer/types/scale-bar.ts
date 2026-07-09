/**
 * ADR-583 Φ2 — Graphic Scale-Bar entity (γραφική κλίμακα).
 *
 * A dedicated, **non-BIM** drawing annotation modelled as a SIBLING of
 * `DimensionEntity` / `CenterMarkEntity` in the generic scene `Entity[]` array
 * (NOT an `annotation-symbol` extension — decision Giorgio 2026-07-09). It rides
 * the `.scene.json` snapshot exactly like dimension / center-mark / text: plain
 * `extends BaseEntity`, no IFC export, no 3D mesh, no dedicated Firestore
 * collection → deliberately NOT added to `isBimEntityType`.
 *
 * ## The two-formula split (THE correctness rule, ADR-583 Φ2)
 * A scale bar mixes two fundamentally different length spaces:
 *
 *   1. **Bar span + division boundaries = REAL model distance.** The bar literally
 *      IS "10 m" (Revit/QGIS parity): `length` is a real-world span in `unit`,
 *      converted to canonical-mm via `realDistanceToModelMm(length, unit)` —
 *      a *scale-INVARIANT* value. It is NEVER routed through `paperHeightToModel`
 *      / `drawingScale`. Zoom / plot scale does not change what "10 m" measures.
 *   2. **Bar thickness + tick length + label height = ANNOTATIVE.** These are
 *      *paper* millimetres (`barHeightMm` / `labelHeightMm`) folded through
 *      `paperHeightToModel(paperMm, drawingScale, unit)` at RENDER time, so they
 *      keep a constant printed size at any drawing scale (1:N).
 *
 * `length` is quantized by `snapScaleBarLength()` on creation so the bar always
 * spans a nice round number (1 · 2 · 5 × 10ⁿ).
 *
 * @see types/dimension.ts — the sibling annotation template
 * @see utils/scene-units.ts — `realDistanceToModelMm` (span, scale-invariant)
 * @see utils/annotation-scale.ts — `paperHeightToModel` (thickness/labels, annotative)
 * @see bim/scale-bar/scale-bar-length-snap.ts — `snapScaleBarLength` (1-2-5 quantizer)
 * @see bim/geometry/scale-bar-geometry.ts — `computeScaleBarGeometry` (derived cache)
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';
import type { SceneUnits } from '../utils/scene-units';

// ──────────────────────────────────────────────────────────────────────────────
// Style enums
// ──────────────────────────────────────────────────────────────────────────────

/** Visual style of the bar body. */
export type ScaleBarStyle =
  | 'alternating' // classic filled / hollow major segments
  | 'hollow'      // outline-only segments
  | 'line-ticks'  // baseline + vertical tick marks only
  | 'double';     // two stacked rows, offset half a division (cartographic)

/** Where the boundary numerals sit relative to the bar axis. */
export type ScaleBarLabelPlacement = 'below' | 'above';

// ──────────────────────────────────────────────────────────────────────────────
// Derived geometry cache
// ──────────────────────────────────────────────────────────────────────────────

/** One numeral placed at a division boundary. `offsetMm` is model-mm along the axis from `position`. */
export interface ScaleBarBoundaryLabel {
  /** Distance ALONG the axis from `position` (the '0' tick) in canonical-mm. */
  readonly offsetMm: number;
  /** Formatted numeral (SSoT `formatLength`, e.g. "5" / "10"); the unit label rides `unitText`. */
  readonly text: string;
}

/** Axis-aligned bounding box (canonical-mm) of the bar's LENGTH extent (thickness added at render). */
export interface ScaleBarBBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Pure, side-effect-free output of `computeScaleBarGeometry(entity, drawingScale,
 * sceneUnits)`. A DERIVED cache — the params (`position` / `angleRad` / `length` /
 * `divisions` / …) are the SSoT; this is never mutated directly. Every scalar is a
 * *scale-invariant* model distance in canonical-mm (span space), NOT annotative.
 */
export interface ScaleBarGeometry {
  /** Far end of the bar (the `length` tick), world canonical-mm. = position + realDistanceToModelMm(length,unit) along angleRad. */
  readonly endPosition: Point2D;
  /** Total model span of the bar in canonical-mm (scale-invariant). */
  readonly totalModelLengthMm: number;
  /** Major division boundary offsets ALONG the axis from `position`, canonical-mm, `divisions + 1` entries (0 … total). */
  readonly divisionBoundariesMm: readonly number[];
  /** Model length of the left-hand extension (one major division) that hosts the fine sub-ticks, canonical-mm. */
  readonly extensionModelLengthMm: number;
  /** Fine sub-tick offsets inside the extension, measured LEFT of `position` (positive magnitudes), canonical-mm. Empty when `subdivisions = 0`. */
  readonly subdivisionOffsetsMm: readonly number[];
  /** Numerals at the major boundaries (real-world values formatted via `formatLength`). */
  readonly boundaryLabels: readonly ScaleBarBoundaryLabel[];
  /** The unit label drawn once at the far end (e.g. "m"), from the SSoT length formatter. */
  readonly unitText: string;
  /** Length-extent bbox (canonical-mm); annotative thickness/ticks are padded at render time. */
  readonly bbox: ScaleBarBBox;
}

// ──────────────────────────────────────────────────────────────────────────────
// Entity
// ──────────────────────────────────────────────────────────────────────────────

export interface ScaleBarEntity extends BaseEntity {
  type: 'scale-bar';

  /** The '0' tick origin (world canonical-mm). */
  position: Point2D;
  /** Axis angle in radians — the ONLY angular DOF (set by the 2nd click). */
  angleRad: number;
  /**
   * REAL-WORLD span of the bar in `unit` (e.g. `10` ⇒ 0…10). SSoT for the span,
   * quantized by `snapScaleBarLength()`. **Scale-INDEPENDENT** — folded to model
   * distance via `realDistanceToModelMm`, never through `drawingScale`.
   */
  length: number;
  /** Real-world unit for `length` + the boundary labels. */
  unit: SceneUnits;
  /** N equal major segments (rendered alternating filled / hollow). */
  divisions: number;
  /** M fine sub-ticks in the extension LEFT of the '0' tick (`0` = none). */
  subdivisions: number;
  /** Body style. */
  style: ScaleBarStyle;
  /** Bar body thickness in **paper mm** — annotative (folded via `paperHeightToModel` at render). */
  barHeightMm: number;
  /** Numeral height in **paper mm** — annotative. */
  labelHeightMm: number;
  /** Numeral side relative to the axis. */
  labelPlacement: ScaleBarLabelPlacement;
  /** DERIVED cache (never mutated; params above are the SSoT). Recomputed by `computeScaleBarGeometry`. */
  geometry?: ScaleBarGeometry;
}

// ──────────────────────────────────────────────────────────────────────────────
// Defaults (ADR-583 Φ2)
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SCALE_BAR_DIVISIONS = 4;
export const DEFAULT_SCALE_BAR_SUBDIVISIONS = 0;
export const DEFAULT_SCALE_BAR_HEIGHT_MM = 4;
export const DEFAULT_SCALE_BAR_LABEL_MM = 2.5;
export const DEFAULT_SCALE_BAR_UNIT: SceneUnits = 'm';
export const DEFAULT_SCALE_BAR_STYLE: ScaleBarStyle = 'alternating';
export const DEFAULT_SCALE_BAR_LABEL_PLACEMENT: ScaleBarLabelPlacement = 'below';

// ──────────────────────────────────────────────────────────────────────────────
// Type guard
// ──────────────────────────────────────────────────────────────────────────────

export const isScaleBarEntity = (e: { type: string }): e is ScaleBarEntity =>
  e.type === 'scale-bar';
