/**
 * Project Elevation Schema (ADR-369 §9 Q3) — Phase A2
 *
 * Strict Zod schemas + inferred TypeScript types για το 3-tier Revit reference
 * system στο Project entity:
 *   - Tier 1 : Survey Point (γεωδαιτικό / Mean Sea Level)
 *   - Tier 2 : Project Base Point (τοπικό μηδέν έργου, σχετικό με survey)
 *   - Extra  : North rotation (degrees, true-north → project grid)
 *
 * Όλα τα fields είναι optional στο Project — έργα χωρίς γεωδαιτική αναφορά
 * λειτουργούν με defaults (basePoint.z=0, no surveyPoint).
 *
 * Storage units:
 *   - z / x / y : METRES (γεωδαιτικές συντεταγμένες ή local)
 *   - northRotation : DEGREES
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q3
 */

import { z } from 'zod';

// ─── Reference systems ───────────────────────────────────────────────────────

/**
 * Γεωδαιτικά συστήματα αναφοράς:
 *   - MSL    : Mean Sea Level (μέση στάθμη θάλασσας)
 *   - GGRS87 : Greek Geodetic Reference System 1987
 *   - EGSA87 : Ελληνικό Γεωδαιτικό Σύστημα Αναφοράς 1987 (alias GGRS87 με local datum)
 *   - WGS84  : World Geodetic System 1984 (GPS standard)
 *   - custom : χρήστης-ορισμένο σύστημα
 */
export const ProjectSurveyReferenceSchema = z.enum([
  'MSL',
  'GGRS87',
  'EGSA87',
  'WGS84',
  'custom',
]);
export type ProjectSurveyReference = z.infer<typeof ProjectSurveyReferenceSchema>;

// ─── Survey Point (Tier 1) ───────────────────────────────────────────────────

export const ProjectSurveyPointSchema = z
  .object({
    /** METRES γεωδαιτικά (Mean Sea Level ή reference system z). */
    z: z.number().finite(),
    /** Optional GIS X (e.g. GGRS87 easting). */
    x: z.number().finite().optional(),
    /** Optional GIS Y (e.g. GGRS87 northing). */
    y: z.number().finite().optional(),
    reference: ProjectSurveyReferenceSchema.optional(),
    /** Τοπογραφικό filename ή URL για audit trail. */
    sourceDocument: z.string().max(500).optional(),
  })
  .strict();
export type ProjectSurveyPoint = z.infer<typeof ProjectSurveyPointSchema>;

// ─── Project Base Point (Tier 2) ─────────────────────────────────────────────

export const ProjectBasePointSchema = z
  .object({
    /** METRES — offset από Survey Point (default 0). */
    z: z.number().finite(),
    /** Optional XY offset από survey origin (METRES). */
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    /** Πχ "γωνία οικοπέδου ΒΔ" — audit description. */
    description: z.string().max(500).optional(),
  })
  .strict();
export type ProjectBasePoint = z.infer<typeof ProjectBasePointSchema>;

// ─── North Rotation ──────────────────────────────────────────────────────────

/** Rotation between survey grid (true north) και project grid, DEGREES. */
export const ProjectNorthRotationSchema = z
  .number()
  .finite()
  .min(-360)
  .max(360);

// ─── Combined ADR-369 patch schema ───────────────────────────────────────────

/**
 * Strict patch schema για ADR-369 additions στο Project.
 * Όλα τα fields optional — μπορούν να δοθούν incremental.
 */
export const ProjectElevationPatchSchema = z
  .object({
    surveyPoint: ProjectSurveyPointSchema.optional(),
    basePoint: ProjectBasePointSchema.optional(),
    northRotation: ProjectNorthRotationSchema.optional(),
  })
  .strict();
export type ProjectElevationPatch = z.infer<typeof ProjectElevationPatchSchema>;
