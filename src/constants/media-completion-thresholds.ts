/**
 * =============================================================================
 * SSoT: Media Completion Thresholds (Per-Type Photo Counts + Floorplan)
 * =============================================================================
 *
 * **Single Source of Truth** για expected media counts per property type.
 * Χρησιμοποιείται από τον completion meter να υπολογίσει partial/complete
 * score για τις media fields (photos, floorplan).
 *
 * **Design**: Σύμφωνα με Spitogatos/Idealista listing quality metrics, ο
 * αριθμός φωτογραφιών per type ακολουθεί Greek market reality:
 *   - Small residential (studio/1br): 3–6 φωτογραφίες αρκούν για first impression
 *   - Family units (apartment/maisonette): 5–10 με καλύτερη coverage
 *   - Luxury (villa/detached): 8–15 φωτογραφίες + exterior/garden views
 *   - Commercial (shop/office): 3–5 (smaller listing footprint)
 *   - Auxiliary (storage/hall): 1–4 (utility shots only)
 *
 * **Scoring curve** (implementata σε `property-completion.ts`):
 *   - `count >= optimal` → score `1.0`
 *   - `count >= min` → score `0.5 + 0.5 * (count - min) / (optimal - min)`
 *   - `count < min` → score `count / min * 0.5` (linear ramp to 0.5)
 *   - `count > bonusCap` → score `1.0` (diminishing returns)
 *
 * **Floorplan**: boolean for single-level units, proportional for multi-level
 * (partial = N floorplans / M levels).
 *
 * **Layering**: Leaf module — depends only on `property-types.ts`.
 *
 * @module constants/media-completion-thresholds
 * @enterprise ADR-287 — Completion Meter (Batch 28)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. THRESHOLD SHAPE
// =============================================================================

export interface PhotoThreshold {
  /** Minimum photos για half-credit (0.5 score floor) */
  readonly min: number;
  /** Optimal count — full credit (score 1.0) */
  readonly optimal: number;
  /** Beyond this count, no additional bonus (diminishing returns) */
  readonly bonusCap: number;
}

export interface MediaThreshold {
  /** Photo count thresholds */
  readonly photos: PhotoThreshold;
  /** Floorplan: 1 = single expected, multi-level resolved at runtime */
  readonly floorplan: 1;
}

// =============================================================================
// 2. PER-TYPE THRESHOLDS
// =============================================================================

/**
 * Photo thresholds per property type (Greek market, Spitogatos/Idealista
 * listing quality benchmarks). Tuning δεκαπέντε-ετούς brand experience σε
 * real-estate portals — luxury units require ≥8 photos for market-ready
 * listing, small residential units ≥3–4.
 */
export const MEDIA_THRESHOLDS: Record<PropertyTypeCanonical, MediaThreshold> = {
  // ─── Residential — small ───────────────────────────────────────────────
  studio:        { photos: { min: 3, optimal: 5,  bonusCap: 10 }, floorplan: 1 },
  apartment_1br: { photos: { min: 4, optimal: 6,  bonusCap: 10 }, floorplan: 1 },

  // ─── Residential — family ──────────────────────────────────────────────
  apartment:     { photos: { min: 5, optimal: 8,  bonusCap: 12 }, floorplan: 1 },
  maisonette:    { photos: { min: 6, optimal: 10, bonusCap: 14 }, floorplan: 1 },

  // ─── Residential — luxury ──────────────────────────────────────────────
  penthouse:     { photos: { min: 6, optimal: 10, bonusCap: 14 }, floorplan: 1 },
  loft:          { photos: { min: 5, optimal: 8,  bonusCap: 12 }, floorplan: 1 },

  // ─── Residential — standalone ──────────────────────────────────────────
  detached_house:{ photos: { min: 7, optimal: 10, bonusCap: 15 }, floorplan: 1 },
  villa:         { photos: { min: 8, optimal: 12, bonusCap: 20 }, floorplan: 1 },

  // ─── Commercial ────────────────────────────────────────────────────────
  shop:          { photos: { min: 3, optimal: 5,  bonusCap: 10 }, floorplan: 1 },
  office:        { photos: { min: 3, optimal: 5,  bonusCap: 10 }, floorplan: 1 },

  // ─── Auxiliary ─────────────────────────────────────────────────────────
  hall:          { photos: { min: 2, optimal: 4,  bonusCap: 8  }, floorplan: 1 },
  storage:       { photos: { min: 1, optimal: 2,  bonusCap: 4  }, floorplan: 1 },
};

// =============================================================================
// 3. LOOKUP + SCORING HELPERS
// =============================================================================

/**
 * Returns the media threshold configuration for a given property type.
 * Unknown/legacy types fall back to `apartment` defaults (conservative
 * mid-market baseline).
 */
export function getMediaThresholdForType(
  type: PropertyTypeCanonical | string | null | undefined,
): MediaThreshold {
  if (typeof type === 'string' && type in MEDIA_THRESHOLDS) {
    return MEDIA_THRESHOLDS[type as PropertyTypeCanonical];
  }
  return MEDIA_THRESHOLDS.apartment;
}

/**
 * Compute photo score `0..1` given count + type-specific thresholds.
 *
 * Curve:
 *   - `count <= 0`   → `0`
 *   - `count < min`  → `count / min * 0.5`          (linear ramp to 0.5)
 *   - `count >= min && count < optimal` → `0.5 + 0.5 * (count - min) / (optimal - min)`
 *   - `count >= optimal` → `1.0`                   (no additional bonus beyond bonusCap)
 *
 * Diminishing returns oltre `bonusCap` — τυπωμένο με identical score `1.0`
 * ώστε να αποτρέπει photo-spam inflation.
 */
export function computePhotoScore(
  count: number,
  type: PropertyTypeCanonical | string | null | undefined,
): number {
  if (count <= 0 || !Number.isFinite(count)) return 0;
  const { min, optimal } = getMediaThresholdForType(type).photos;
  if (count >= optimal) return 1;
  if (count >= min) {
    // Linear interpolation [min → optimal] mapped to [0.5 → 1.0]
    const span = optimal - min;
    if (span <= 0) return 1; // degenerate config safety
    return 0.5 + 0.5 * ((count - min) / span);
  }
  // Below minimum — linear ramp to 0.5
  return Math.max(0, (count / min) * 0.5);
}

/**
 * Compute floorplan score `0..1` given count + level count.
 *
 * - Single-level unit: `count >= 1` → `1`, else `0`.
 * - Multi-level unit: `count / levelCount`, capped at `1`. Partial score reflects
 *   per-level κάτοψη coverage (ADR-236 Phase 3).
 */
export function computeFloorplanScore(count: number, levelCount: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (levelCount <= 1) return count >= 1 ? 1 : 0;
  return Math.min(1, count / levelCount);
}
