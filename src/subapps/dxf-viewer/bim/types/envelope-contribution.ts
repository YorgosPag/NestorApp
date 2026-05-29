/**
 * ADR-396 Phase P2 — Envelope contribution helpers (SSoT P2 → P3 bridge).
 *
 * Pure helpers που λένε «πόση επιφάνεια / ποιο πάχος δίνει κάθε δομικό
 * στοιχείο στο ενιαίο κέλυφος θερμοπρόσοψης (ETICS)». Δεν παράγουν γεωμετρία
 * (offset/union perimeter = Phase P3, `bim/geometry/envelope-perimeter.ts`) —
 * μόνο per-element measurement contributions για BOQ (D5) + accessors.
 *
 * ΜΟΝΑΔΕΣ: όλα meters-in / meters-out. Οι callers μετατρέπουν τα mm scalars
 * των entity params (width/depth/thickness) → meters ΠΡΙΝ καλέσουν εδώ
 * (consistent με `EnvelopeLayer.thickness_m`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §7 (P2)
 * @see ./thermal-envelope-types (EnvelopeLayer / EnvelopeZoneId SSoT — ΔΕΝ redefine)
 */

import type { EnvelopeLayer, EnvelopeZoneId } from './thermal-envelope-types';
import type { OpeningParams } from './opening-types';

// ============================================================================
// ACCESSORS — read the optional per-element layer (SSoT field name)
// ============================================================================

/**
 * Structural elements (column / beam / slab) μοιράζονται το ίδιο optional
 * field `envelopeLayer` (ADR-396 P2). Generic shape για ένα accessor αντί
 * τριών ίδιων.
 */
export interface HasEnvelopeLayer {
  readonly envelopeLayer?: EnvelopeLayer;
}

/**
 * Επιστρέφει την εξωτερική στρώση μόνωσης ενός column/beam/slab params, ή
 * `undefined` αν το στοιχείο δεν έχει θερμοπρόσοψη.
 */
export function getEnvelopeLayer(params: HasEnvelopeLayer): EnvelopeLayer | undefined {
  return params.envelopeLayer;
}

/** Επιστρέφει την reveal μόνωση (Z4) ενός ανοίγματος, ή `undefined`. */
export function getOpeningRevealInsulation(params: OpeningParams): EnvelopeLayer | undefined {
  return params.revealInsulation;
}

/** True όταν το στοιχείο έχει ενεργή εξωτ. στρώση κελύφους. */
export function hasEnvelopeLayer(params: HasEnvelopeLayer): boolean {
  return params.envelopeLayer !== undefined;
}

// ============================================================================
// CONTRIBUTION DESCRIPTOR
// ============================================================================

/**
 * Συνεισφορά ενός στοιχείου σε μία ζώνη του κελύφους — BOQ-ready (D5:
 * χωριστή γραμμή ανά ζώνη + όροφο, m²).
 */
export interface EnvelopeContribution {
  readonly zone: EnvelopeZoneId;
  readonly materialId: EnvelopeLayer['materialId'];
  /** Πάχος στρώσης σε ΜΕΤΡΑ. */
  readonly thickness_m: number;
  /** Επιφάνεια κελύφους που δίνει το στοιχείο, σε m². */
  readonly area_m2: number;
}

// ============================================================================
// AREA CONTRIBUTIONS (pure, meters-in / meters-out)
// ============================================================================

/**
 * Z1 — κατακόρυφη όψη (τοίχος / κολώνα / δοκάρι). Επιφάνεια = εκτεθειμένο
 * μήκος παρειάς × ύψος ορόφου. (Net αφαίρεση ανοιγμάτων γίνεται από τον
 * caller σε P3/P7 — εδώ raw gross face.)
 *
 * @param exposedLength_m εκτεθειμένο μήκος εξωτ. παρειάς (m)
 * @param height_m ύψος ορόφου / στοιχείου (m)
 */
export function computeFacadeContributionArea(exposedLength_m: number, height_m: number): number {
  if (exposedLength_m <= 0 || height_m <= 0) return 0;
  return exposedLength_m * height_m;
}

/**
 * Z2 / Z3 — επίπεδη παρειά πλάκας (soffit πιλοτής κάτω / δώμα top). Η
 * συνεισφορά ισούται με την (εκτεθειμένη) επιφάνεια της πλάκας — identity με
 * guard. Ο caller περνά το net slab area (m²) που έχει ήδη υπολογιστεί.
 *
 * @param exposedArea_m2 εκτεθειμένη επιφάνεια πλάκας (m²)
 */
export function computeFlatContributionArea(exposedArea_m2: number): number {
  return exposedArea_m2 > 0 ? exposedArea_m2 : 0;
}

// ============================================================================
// Z4 — REVEAL STRIPS (περβάζια κουφωμάτων, 4 λωρίδες)
// ============================================================================

/** Πλευρά λωρίδας περβαζιού. */
export type RevealStripSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Μία λωρίδα περβαζιού (Z4). `length_m` = μήκος κατά την παρειά του
 * ανοίγματος· `depth_m` = βάθος μέσα στο πάχος του τοίχου (= wall thickness).
 * Η επιφάνεια μόνωσης της λωρίδας = `length_m × depth_m`.
 */
export interface RevealStrip {
  readonly side: RevealStripSide;
  readonly length_m: number;
  readonly depth_m: number;
}

/**
 * Z4 — υπολογίζει τις 4 λωρίδες περβαζιού που ντύνουν εσωτερικά ένα άνοιγμα.
 * Οι αριστερή/δεξιά τρέχουν καθ' ύψος (length = opening height), η πάνω/κάτω
 * κατά πλάτος (length = opening width). Βάθος όλων = πάχος τοίχου.
 *
 * ΣΗΜΕΙΩΣΗ (ADR-396 OQ-4, default): οι λωρίδες σταματούν στην άκρη της τρύπας
 * (καμία πατούρα overlap). Το overlap γίνεται configurable αργότερα (P4/P6).
 *
 * @param openingWidth_m πλάτος ανοίγματος (m)
 * @param openingHeight_m ύψος ανοίγματος (m)
 * @param wallThickness_m πάχος host τοίχου (m) = βάθος λωρίδας
 */
export function computeRevealStrips(
  openingWidth_m: number,
  openingHeight_m: number,
  wallThickness_m: number,
): readonly RevealStrip[] {
  if (openingWidth_m <= 0 || openingHeight_m <= 0 || wallThickness_m <= 0) {
    return [];
  }
  return [
    { side: 'left',   length_m: openingHeight_m, depth_m: wallThickness_m },
    { side: 'right',  length_m: openingHeight_m, depth_m: wallThickness_m },
    { side: 'top',    length_m: openingWidth_m,  depth_m: wallThickness_m },
    { side: 'bottom', length_m: openingWidth_m,  depth_m: wallThickness_m },
  ];
}

/**
 * Z4 — συνολική επιφάνεια μόνωσης περβαζιών ενός ανοίγματος (m²) = άθροισμα
 * των 4 λωρίδων = 2·(W+H)·t. BOQ-ready (D5).
 */
export function computeRevealContributionArea(
  openingWidth_m: number,
  openingHeight_m: number,
  wallThickness_m: number,
): number {
  return computeRevealStrips(openingWidth_m, openingHeight_m, wallThickness_m).reduce(
    (sum, strip) => sum + strip.length_m * strip.depth_m,
    0,
  );
}
