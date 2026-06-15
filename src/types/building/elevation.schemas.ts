/**
 * Building Elevation Schema (ADR-369 §9 Q2) — Phase A2
 *
 * Strict Zod schemas + inferred types για ADR-369 additions στο Building entity:
 *   - baseElevation          : METRES — site z offset (default 0)
 *   - baseElevationReference : 'site' | 'sea-level' | 'street' (semantic)
 *   - siteOrigin             : XY offset στο site (multi-building layouts)
 *   - rotation               : DEGREES — building orientation
 *   - phase                  : lifecycle status (planning → completion)
 *
 * Geometry semantic (ADR-369):
 *   worldZ = surveyPoint.z + basePoint.z + building.baseElevation + floor.elevation
 *
 * Όλα τα fields optional — defaults κάνουν τα uses single-building καθαρά (no-op).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q2
 */

import { z } from 'zod';

// ─── Reference semantic ──────────────────────────────────────────────────────

/**
 * Semantic interpretation του `baseElevation`:
 *   - site       : επίπεδο εδάφους site (default)
 *   - sea-level  : μέση στάθμη θάλασσας (γεωδαιτικά)
 *   - street     : στάθμη οδού (πολεοδομικά reference)
 */
export const BuildingBaseElevationReferenceSchema = z.enum([
  'site',
  'sea-level',
  'street',
]);
export type BuildingBaseElevationReference = z.infer<typeof BuildingBaseElevationReferenceSchema>;

// ─── Site Origin (XY offset για multi-building layouts) ──────────────────────

export const BuildingSiteOriginSchema = z
  .object({
    /** METRES — east offset από project base point. */
    x: z.number().finite(),
    /** METRES — north offset από project base point. */
    y: z.number().finite(),
  })
  .strict();
export type BuildingSiteOrigin = z.infer<typeof BuildingSiteOriginSchema>;

// ─── Lifecycle phase ─────────────────────────────────────────────────────────

export const BuildingPhaseSchema = z.enum([
  'planned',
  'permitted',
  'under_construction',
  'completed',
]);
export type BuildingPhase = z.infer<typeof BuildingPhaseSchema>;

// ─── Combined ADR-369 patch schema ───────────────────────────────────────────

export const BuildingElevationPatchSchema = z
  .object({
    /** METRES — Building base elevation relative to Project Base Point (default 0). */
    baseElevation: z.number().finite().optional(),
    baseElevationReference: BuildingBaseElevationReferenceSchema.optional(),
    siteOrigin: BuildingSiteOriginSchema.optional(),
    /** DEGREES — building orientation on site (default 0). */
    rotation: z.number().finite().min(-360).max(360).optional(),
    phase: BuildingPhaseSchema.optional(),
    /**
     * ADR-451 — building has a foundation datum below the lowest storey (default
     * true). The foundation is an auto-derived datum, NOT a counted storey; its
     * structural TYPE (πεδιλοδοκοί/κοιτόστρωση/πέδιλα) lives per-element in the DXF
     * (`floorplan_foundations`, ADR-436/441), not here.
     */
    hasFoundation: z.boolean().optional(),
    /** ADR-451 — METRES — foundation depth below the lowest storey FFL (≥0). */
    foundationDepth: z.number().finite().min(0).max(99).optional(),
    /**
     * ADR-461 — building has a stair penthouse (απόληξη κλιμακοστασίου) special
     * level above the top storey (default true when ≥1 storey). Like the
     * foundation it is a special level (Revit «Building Story» OFF), NOT counted.
     */
    hasStairPenthouse: z.boolean().optional(),
    /** ADR-461 — METRES — stair-penthouse storey height (default 2.40, ≥0). */
    stairPenthouseHeight: z.number().finite().min(0).max(99).optional(),
  })
  .strict();
export type BuildingElevationPatch = z.infer<typeof BuildingElevationPatchSchema>;

// ─── Default values ──────────────────────────────────────────────────────────

export const DEFAULT_BUILDING_BASE_ELEVATION_M = 0;
export const DEFAULT_BUILDING_ROTATION_DEG = 0;
export const DEFAULT_BUILDING_PHASE: BuildingPhase = 'planned';
/** ADR-451 — buildings have a foundation by default (Greek construction norm). */
export const DEFAULT_BUILDING_HAS_FOUNDATION = true;
/** ADR-451 — METRES — default foundation depth below the lowest storey FFL. */
export const DEFAULT_BUILDING_FOUNDATION_DEPTH_M = 1.0;
/** ADR-461 — buildings with ≥1 storey have a stair penthouse by default (Greek norm). */
export const DEFAULT_BUILDING_HAS_STAIR_PENTHOUSE = true;
/** ADR-461 — METRES — default stair-penthouse (απόληξη κλιμακοστασίου) height. */
export const DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M = 2.4;
