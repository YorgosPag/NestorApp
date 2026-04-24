/**
 * =============================================================================
 * SSoT: Property Field Completion Weights (Per-Type Matrix)
 * =============================================================================
 *
 * **Single Source of Truth** για per-type field weights που χρησιμοποιούνται
 * στον completion meter (profile-strength indicator). Κάθε τύπος ακινήτου έχει
 * τη δική του λίστα relevant fields με assigned weight + critical flag.
 *
 * **Weights** (semantically meaningful):
 *   - `2` — Critical: field that defines the listing (type, area, price class,
 *     photos, floorplan, κλπ). Highest impact in score, surfaces first in
 *     "what's missing" breakdown.
 *   - `1` — Normal: standard descriptive field (heating, cooling, finishes,
 *     orientation σε non-standalone types).
 *   - `0.5` — Optional: nice-to-have hints (security features σε residential,
 *     WC-only fields, auxiliary commercial finishes).
 *
 * **Absence of a field from the per-type list = EXEMPT** (skipped from
 * denominator). Matches Batch 25 pattern: storage/hall skip finishes/systems/
 * ΠΕΑ because they're legitimately irrelevant — not missing data.
 *
 * **Google pattern**: Google My Business completion score applies different
 * weight per field category (primary info > contact info > media > optional
 * attributes). LinkedIn All-Star uses fixed weights (photo 20%, headline 10%,
 * summary 20%, etc.). Spitogatos/Idealista emphasize media+floorplan as
 * differentiators (search-filterable).
 *
 * **Layering**: Leaf module — depends only on `property-types.ts`. Safe to
 * import anywhere (server, client, tests).
 *
 * @module constants/field-completion-weights
 * @enterprise ADR-287 — Completion Meter (Batch 28)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. FIELD KEY UNION — Canonical list of scorable fields
// =============================================================================

/**
 * All scorable field keys for the completion meter. Mirrors
 * `PropertyFieldsFormData` subset + 2 media fields (photos, floorplan) —
 * the meter treats them uniformly.
 */
export const FIELD_KEYS = [
  'type',
  'areaGross',
  'areaNet',
  'bedrooms',
  'bathrooms',
  'orientations',
  'condition',
  'energyClass',
  'heatingType',
  'coolingType',
  'windowFrames',
  'glazing',
  'flooring',
  'interiorFeatures',
  'securityFeatures',
  'floorplan',
  'photos',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

// =============================================================================
// 2. WEIGHT ENTRY — per-field configuration within a type's matrix
// =============================================================================

export interface FieldWeightEntry {
  /** Field identifier (canonical) */
  readonly key: FieldKey;
  /** Relative weight: 2 (critical), 1 (normal), 0.5 (optional) */
  readonly weight: 2 | 1 | 0.5;
  /** Critical flag — surfaces first in "missing" breakdown */
  readonly critical: boolean;
}

// =============================================================================
// 3. SHARED FIELD SUBSETS — avoid repetition across types
// =============================================================================

const CRITICAL_IDENTITY: readonly FieldWeightEntry[] = [
  { key: 'type', weight: 2, critical: true },
  { key: 'areaGross', weight: 2, critical: true },
];

const CRITICAL_MEDIA: readonly FieldWeightEntry[] = [
  { key: 'floorplan', weight: 2, critical: true },
  { key: 'photos', weight: 2, critical: true },
];

const RESIDENTIAL_CORE: readonly FieldWeightEntry[] = [
  ...CRITICAL_IDENTITY,
  { key: 'areaNet', weight: 1, critical: false },
  { key: 'bathrooms', weight: 1, critical: false },
  { key: 'condition', weight: 2, critical: true },
  { key: 'energyClass', weight: 2, critical: true },
  { key: 'heatingType', weight: 1, critical: false },
  { key: 'coolingType', weight: 1, critical: false },
  { key: 'windowFrames', weight: 1, critical: false },
  { key: 'glazing', weight: 1, critical: false },
  { key: 'flooring', weight: 1, critical: false },
  { key: 'securityFeatures', weight: 0.5, critical: false },
  ...CRITICAL_MEDIA,
];

// =============================================================================
// 4. PER-TYPE MATRIX — canonical source of truth
// =============================================================================

/**
 * Per-type field weights. Any field NOT listed is **exempt** from scoring
 * for that type (skipped from denominator). Addition of new field keys:
 * 1) add to `FIELD_KEYS`, 2) extend per-type entries as needed, 3) add
 * i18n label in `properties.json` under `completion.fields.*`.
 */
export const FIELD_WEIGHTS: Record<PropertyTypeCanonical, readonly FieldWeightEntry[]> = {
  // ─── Residential — small units ─────────────────────────────────────────
  studio: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 0.5, critical: false },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  apartment_1br: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 1, critical: false },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  // ─── Residential — family units ────────────────────────────────────────
  apartment: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  maisonette: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  // ─── Residential — luxury ──────────────────────────────────────────────
  penthouse: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 1, critical: false },
  ],

  loft: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 1, critical: false },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  // ─── Residential — standalone (Family B) ───────────────────────────────
  detached_house: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 2, critical: true },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 1, critical: false },
  ],

  villa: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 2, critical: true },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 1, critical: false },
  ],

  // ─── Commercial — shop ─────────────────────────────────────────────────
  shop: [
    ...CRITICAL_IDENTITY,
    { key: 'areaNet', weight: 1, critical: false },
    { key: 'condition', weight: 1, critical: false },
    { key: 'energyClass', weight: 1, critical: false },
    { key: 'heatingType', weight: 0.5, critical: false },
    { key: 'coolingType', weight: 0.5, critical: false },
    { key: 'windowFrames', weight: 0.5, critical: false },
    { key: 'glazing', weight: 0.5, critical: false },
    { key: 'flooring', weight: 0.5, critical: false },
    { key: 'securityFeatures', weight: 0.5, critical: false },
    ...CRITICAL_MEDIA,
  ],

  // ─── Commercial — office ───────────────────────────────────────────────
  office: [
    ...CRITICAL_IDENTITY,
    { key: 'areaNet', weight: 1, critical: false },
    { key: 'bathrooms', weight: 1, critical: false },
    { key: 'condition', weight: 1, critical: false },
    { key: 'energyClass', weight: 1, critical: false },
    { key: 'heatingType', weight: 1, critical: false },
    { key: 'coolingType', weight: 1, critical: false },
    { key: 'windowFrames', weight: 0.5, critical: false },
    { key: 'glazing', weight: 0.5, critical: false },
    { key: 'flooring', weight: 0.5, critical: false },
    { key: 'securityFeatures', weight: 0.5, critical: false },
    ...CRITICAL_MEDIA,
  ],

  // ─── Auxiliary — hall (αίθουσα) ────────────────────────────────────────
  hall: [
    ...CRITICAL_IDENTITY,
    { key: 'areaNet', weight: 0.5, critical: false },
    { key: 'condition', weight: 1, critical: false },
    { key: 'securityFeatures', weight: 0.5, critical: false },
    { key: 'floorplan', weight: 2, critical: true },
    { key: 'photos', weight: 1, critical: false },
  ],

  // ─── Auxiliary — storage (αποθήκη) ─────────────────────────────────────
  storage: [
    ...CRITICAL_IDENTITY,
    { key: 'areaNet', weight: 0.5, critical: false },
    { key: 'condition', weight: 1, critical: false },
    { key: 'securityFeatures', weight: 0.5, critical: false },
    { key: 'floorplan', weight: 2, critical: true },
    { key: 'photos', weight: 1, critical: false },
  ],
};

// =============================================================================
// 5. LOOKUP HELPER — safe accessor with fallback
// =============================================================================

/**
 * Returns the weight entries for a given property type. Unknown/legacy types
 * fall back to the `apartment` matrix — a conservative default that covers
 * the majority of Greek market residential stock.
 */
export function getFieldWeightsForType(
  type: PropertyTypeCanonical | string | null | undefined,
): readonly FieldWeightEntry[] {
  if (typeof type === 'string' && type in FIELD_WEIGHTS) {
    return FIELD_WEIGHTS[type as PropertyTypeCanonical];
  }
  return FIELD_WEIGHTS.apartment;
}

