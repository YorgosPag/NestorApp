/**
 * ADR-395 Phase 2 (G1) — Stair BOQ quantity derivation (pure, geometry-aligned).
 *
 * A stair feeds THREE BOQ rows. Quantities are derived from the canonical mm
 * `StairParams` (the same inputs `computeStairGeometry` consumes), NOT from a
 * stored `qto` field — the legacy `qto` field was removed (ADR-395 §4.6 / G5),
 * and the bridge is the geometry-derived source of truth (mirrors
 * wall/slab/column/beam `geometry.area`/`volume`).
 *
 * Pure + side-effect free → unit-testable in isolation. Firestore I/O lives in
 * `stair-boq-sync.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-395-bim-quantities-building-measurements.md §4.1
 */

import type { StairParams, StairStructureType } from '../types/stair-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * ADR-395 G1 — default equivalent RC waist-slab thickness (mm) for the
 * concrete volume model, used when `StairParams.waistThickness` is unset
 * (industry typical 150 mm for residential RC flights). SSoT default shared
 * with the ribbon read-fallback (`stair-param-helpers`); the per-stair
 * override flows in via `params.waistThickness`.
 */
export const DEFAULT_WAIST_SLAB_THICKNESS_MM = 150;

const MM_TO_M = 1e-3;
const MM2_TO_M2 = 1e-6;
const MM3_TO_M3 = 1e-9;

/** Structure types with no cast concrete → no concrete BOQ row. */
const NON_CONCRETE_STRUCTURE_TYPES: ReadonlySet<StairStructureType> = new Set<StairStructureType>([
  'steel-grating',
  'glass-tread',
]);

// ============================================================================
// TYPES
// ============================================================================

export interface StairBoqQuantities {
  /** OIK-2.05 — cast concrete net volume (waist slab + step wedges). */
  readonly concreteVolumeM3: number;
  /** OIK-5.05 — tread cladding plan area (going × width × steps). */
  readonly treadCladdingAreaM2: number;
  /** OIK-12.01 — handrail run length (inclined) × number of rails. */
  readonly handrailLinearM: number;
}

// ============================================================================
// CALCULATOR
// ============================================================================

/**
 * Derive the three stair BOQ quantities from `StairParams` (mm). All outputs
 * are clamped to ≥ 0; degenerate stairs (0 steps / width) yield 0 across the
 * board so the sync layer drops the row instead of writing a noise entry.
 */
export function computeStairBoqQuantities(params: StairParams): StairBoqQuantities {
  const stepCount = Math.max(0, params.stepCount);
  const going = Math.max(0, params.tread); // mm — horizontal run per step (excl. nosing)
  const rise = Math.max(0, params.rise); // mm
  const width = Math.max(0, params.width); // mm

  const treadCladdingAreaM2 = stepCount * going * width * MM2_TO_M2;

  const stepHypotenuseMm = Math.hypot(going, rise);
  const railCount =
    (params.handrails.inner ? 1 : 0) + (params.handrails.outer ? 1 : 0);
  const handrailLinearM = railCount * stepCount * stepHypotenuseMm * MM_TO_M;

  let concreteVolumeM3 = 0;
  if (!NON_CONCRETE_STRUCTURE_TYPES.has(params.structureType)) {
    const waistThicknessMm = Math.max(0, params.waistThickness ?? DEFAULT_WAIST_SLAB_THICKNESS_MM);
    const inclinedRunMm = stepCount * stepHypotenuseMm;
    const waistVolumeMm3 = inclinedRunMm * width * waistThicknessMm;
    const stepWedgesMm3 = stepCount * 0.5 * going * rise * width;
    concreteVolumeM3 = (waistVolumeMm3 + stepWedgesMm3) * MM3_TO_M3;
  }

  return { concreteVolumeM3, treadCladdingAreaM2, handrailLinearM };
}
