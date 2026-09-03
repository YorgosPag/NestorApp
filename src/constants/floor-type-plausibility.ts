/**
 * =============================================================================
 * SSoT: Floor ↔ Property-Type Plausibility (Google-style sanity check)
 * =============================================================================
 *
 * **Single Source of Truth** για το "is this property type consistent with the
 * selected floor?" check. Εμφανίζεται σαν inline non-blocking warning όταν ο
 * χρήστης επιλέγει συνδυασμό property-type + floor που είναι ασυνήθιστος ή
 * εντελώς ασύμβατος (π.χ. "ρετιρέ" σε υπόγειο, "βίλα" σε όροφο).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason. Το warning είναι UX hint για να
 * πιάσει typos ή λάθος επιλογές dropdown.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από άλλα leaf constants
 * (`property-types.ts`). Ασφαλές για import παντού (server, client, tests).
 *
 * **V1 bands (3)**: basement (floor < 0) / ground (floor === 0) / upper (floor > 0).
 * Δεν κάνουμε διάκριση μεταξύ middle και top floor σε αυτό το batch — θα απαιτούσε
 * cross-entity lookup του `buildingTopFloor`. Μελλοντικό batch μπορεί να εισάγει
 * 4η banda (`top`) μόλις υπάρχει ο lookup, χωρίς breaking change στο public API.
 *
 * **Family B handling**: `villa` / `detached_house` είναι standalone (ADR-284) —
 * δεν έχουν semantic floor. Εκτός matrix: special-case στο `assess...`.
 *
 * @module constants/floor-type-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 19)
 */

import {
  isCanonicalPropertyType,
  isLandPropertyType,
  isStandaloneUnitType,
  type PropertyTypeCanonical,
} from '@/constants/property-types';
import { toFiniteNumber } from '@/constants/plausibility-input';

// =============================================================================
// 1. FLOOR BAND — classification από raw floor number
// =============================================================================

export type FloorBand = 'basement' | 'ground' | 'upper';

/**
 * Classify a raw floor number into a plausibility band.
 *
 * Convention (follows Greek real-estate + ADR-236 floor level parsing):
 *   - `floor < 0`  → `'basement'` (υπόγεια: -1, -2, ...)
 *   - `floor === 0` → `'ground'` (ισόγειο)
 *   - `floor > 0`  → `'upper'` (1ος και πάνω)
 *
 * Επιστρέφει `null` αν η είσοδος δεν είναι έγκυρος finite number.
 */
export function classifyFloor(floor: unknown): FloorBand | null {
  const n = toFiniteNumber(floor);
  if (n === null) return null;
  if (n < 0) return 'basement';
  if (n === 0) return 'ground';
  return 'upper';
}

// =============================================================================
// 2. VERDICT TYPE + MATRIX (12 canonical types × 3 bands)
// =============================================================================

export type FloorTypeVerdict = 'ok' | 'unusual' | 'implausible';

/**
 * Google-style business rules. Reference:
 *   - Residential (studio/apt/maisonette/loft/apartment_1br) σε basement →
 *     `unusual` (legitimate edge case: souterrain conversions)
 *   - Penthouse (ρετιρέ) requires upper floor by definition — basement/ground →
 *     `implausible`
 *   - Shop on middle/upper → `unusual` (hidden retail rare in Greek market)
 *   - Office basement → `unusual` (server rooms possible)
 *   - Hall (αίθουσα) basement/ground → `ok` (conference/event space canonical);
 *     upper → `unusual`
 *   - Storage (αποθήκη) basement/ground → `ok` (canonical); upper → `unusual`
 *
 * `villa` + `detached_house` are handled outside this matrix — they are Family B
 * standalone units and do not live on a floor.
 */
export const FLOOR_TYPE_MATRIX: Readonly<
  Record<
    Exclude<PropertyTypeCanonical, 'villa' | 'detached_house' | 'plot' | 'parcel'>,
    Record<FloorBand, FloorTypeVerdict>
  >
> = {
  studio: { basement: 'unusual', ground: 'ok', upper: 'ok' },
  apartment_1br: { basement: 'unusual', ground: 'ok', upper: 'ok' },
  apartment: { basement: 'unusual', ground: 'ok', upper: 'ok' },
  maisonette: { basement: 'unusual', ground: 'ok', upper: 'ok' },
  penthouse: { basement: 'implausible', ground: 'implausible', upper: 'ok' },
  loft: { basement: 'unusual', ground: 'unusual', upper: 'ok' },
  shop: { basement: 'unusual', ground: 'ok', upper: 'unusual' },
  office: { basement: 'unusual', ground: 'ok', upper: 'ok' },
  hall: { basement: 'ok', ground: 'ok', upper: 'unusual' },
  storage: { basement: 'ok', ground: 'ok', upper: 'unusual' },
};

// =============================================================================
// 3. ASSESSMENT — public API
// =============================================================================

export interface FloorPlausibilityAssessment {
  readonly verdict: FloorTypeVerdict | 'insufficientData';
  readonly band: FloorBand | null;
  readonly propertyType: PropertyTypeCanonical | null;
  readonly isStandalone: boolean;
}

export interface AssessFloorTypePlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly floor: number | string | undefined | null;
}

/**
 * Assess whether the combination of `propertyType` + `floor` is plausible.
 *
 * **Gate order**:
 *   1. `propertyType` must be a known canonical value (διαφορετικά → `'insufficientData'`)
 *   2. Standalone types (villa / detached_house):
 *      - floor null/undefined/0 → `'ok'` (canonical ground-level)
 *      - floor < 0 or > 0 → `'implausible'` (Family B does not belong to a floor)
 *   3. In-building types: require finite numeric floor (διαφορετικά → `'insufficientData'`)
 *   4. Matrix lookup.
 */
export function assessFloorTypePlausibility(
  args: AssessFloorTypePlausibilityArgs,
): FloorPlausibilityAssessment {
  const { propertyType, floor } = args;

  if (!isCanonicalPropertyType(propertyType)) {
    return {
      verdict: 'insufficientData',
      band: null,
      propertyType: null,
      isStandalone: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 🔴 Η ΓΗ ΔΕΝ ΕΧΕΙ ΟΡΟΦΟ — και αυτό ΔΕΝ είναι το ίδιο με «ισόγειο»
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Η βίλα και η μονοκατοικία **έχουν** όροφο και τυχαίνει να είναι το ισόγειο· η γη
  // **δεν έχει την έννοια**. Γι' αυτό η γη φεύγει και από τον τύπο του
  // {@link FLOOR_TYPE_MATRIX} (`Exclude`): πίνακας ορόφων για οικόπεδο θα ήταν γραμμή
  // που κανείς δεν μπορεί να συμπληρώσει σωστά.
  //
  // 🔑 **`null` ⇒ `ok` · οτιδήποτε άλλο ⇒ `implausible`**, και η αυστηρότητα είναι
  // σκόπιμη: «οικόπεδο στον 3ο όροφο» δεν είναι ασυνήθιστο ακίνητο, είναι **λάθος
  // είδος** — ο άνθρωπος διάλεξε «Οικόπεδο» ενώ πουλά διαμέρισμα.
  if (isLandPropertyType(propertyType)) {
    const declaredFloor = toFiniteNumber(floor);
    return {
      verdict: declaredFloor === null ? 'ok' : 'implausible',
      band: declaredFloor === null ? null : classifyFloor(declaredFloor),
      propertyType,
      isStandalone: true,
    };
  }

  if (isStandaloneUnitType(propertyType)) {
    const floorNum = toFiniteNumber(floor);
    // null / undefined / 0 → ok (standalone canonical ground placement)
    if (floorNum === null || floorNum === 0) {
      return {
        verdict: 'ok',
        band: floorNum === 0 ? 'ground' : null,
        propertyType,
        isStandalone: true,
      };
    }
    return {
      verdict: 'implausible',
      band: classifyFloor(floorNum),
      propertyType,
      isStandalone: true,
    };
  }

  const band = classifyFloor(floor);
  if (band === null) {
    return {
      verdict: 'insufficientData',
      band: null,
      propertyType,
      isStandalone: false,
    };
  }

  const verdict = FLOOR_TYPE_MATRIX[propertyType][band];
  return { verdict, band, propertyType, isStandalone: false };
}

/**
 * Convenience: returns `true` αν το verdict χρειάζεται εμφάνιση ως warning.
 * Filters out silent verdicts (`'ok'`, `'insufficientData'`).
 */
export function isActionableFloorVerdict(
  verdict: FloorPlausibilityAssessment['verdict'],
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 4. INTERNAL HELPERS
// =============================================================================


