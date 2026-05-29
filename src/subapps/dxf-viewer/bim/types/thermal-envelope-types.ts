/**
 * ADR-396 Phase P1 — Thermal Envelope (ETICS) Foundations: types + constants.
 *
 * Single Source of Truth για το data model της ενιαίας εξωτερικής
 * θερμοπρόσοψης (ETICS). Phase P1 = foundations μόνο (types + config +
 * advisory thresholds) — ΚΑΜΙΑ γεωμετρία / render / persistence εδώ
 * (έρχονται P2-P7, βλ. ADR-396 §7 Roadmap).
 *
 * Υβριδικό μοντέλο (ADR-396 D1):
 *   - DEFINITION: ένα `ThermalEnvelopeSpec` ανά όροφο (material + πάχος + ζώνες).
 *   - DATA: per-element `EnvelopeLayer` (industry-standard, σωστές προμετρήσεις).
 *   - DISPLAY: ενιαίο συνεχές κέλυφος (P4/P5).
 *
 * Οι 4 ζώνες (ADR-396 §2.1):
 *   Z1 κατακόρυφη όψη · Z2 οροφή πιλοτής (soffit) · Z3 δώμα (top) ·
 *   Z4 περβάζια κουφωμάτων (reveal strips).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md
 * @see src/subapps/dxf-viewer/bim/walls/wall-material-catalog.ts (materialId presets)
 * @see src/subapps/dxf-viewer/bim/config/material-to-atoe-mapping.ts (ΑΤΟΕ BOQ)
 */

import type {
  WallMaterialPresetId,
  WallMaterialCustomId,
} from '../walls/wall-material-catalog';

// ============================================================================
// ZONES
// ============================================================================

/** Οι 4 ζώνες μόνωσης του κελύφους (ADR-396 §2.1). */
export type EnvelopeZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4';

/** On/off toggles ανά ζώνη — μέρος του per-floor spec (ADR-396 D6). */
export interface EnvelopeZoneToggles {
  /** Z1 — κατακόρυφη εξωτ. όψη τοίχων/κολωνών/δοκαριών. */
  readonly Z1: boolean;
  /** Z2 — οροφή πιλοτής (κάτω παρειά εκτεθειμένης πλάκας). */
  readonly Z2: boolean;
  /** Z3 — δώμα (επάνω παρειά πλάκας τελευταίου ορόφου). */
  readonly Z3: boolean;
  /** Z4 — περβάζια κουφωμάτων (4 λωρίδες ανά εξωτερικό άνοιγμα). */
  readonly Z4: boolean;
}

// ============================================================================
// DATA MODEL
// ============================================================================

/**
 * Material id για στρώση κελύφους. Presets από wall-material-catalog ή
 * free-form string (custom, βλ. `classifyWallMaterial`). Τα presets που
 * έχουν νόημα για ETICS είναι `mat-eps-graphite` (Neopor) + `mat-xps`.
 */
export type EnvelopeMaterialId =
  | WallMaterialPresetId
  | WallMaterialCustomId
  | string;

/**
 * Per-element εξωτερική στρώση μόνωσης (industry-standard, ADR-396 §3 DATA).
 * Προσαρτάται σε column/beam/slab/opening στη Φάση P2.
 */
export interface EnvelopeLayer {
  readonly materialId: EnvelopeMaterialId;
  /** Πάχος στρώσης σε ΜΕΤΡΑ (SSoT unit — όχι mm). */
  readonly thickness_m: number;
  /** Σε ποια ζώνη ανήκει η στρώση (καθορίζει advisory min + BOQ grouping). */
  readonly zone: EnvelopeZoneId;
}

/**
 * Per-floor ορισμός θερμοπρόσοψης (ADR-396 §3 DEFINITION). Ο χρήστης το
 * ορίζει ΜΙΑ φορά· το command «Εφαρμογή Θερμοπρόσοψης» (P6) παράγει τα
 * per-element `EnvelopeLayer`.
 */
export interface ThermalEnvelopeSpec {
  /** Υλικό κελύφους (default `mat-eps-graphite`). */
  readonly materialId: EnvelopeMaterialId;
  /** Πάχος Z1/Z2/Z3 σε ΜΕΤΡΑ (default 0.10). */
  readonly thickness_m: number;
  /** Πάχος περβαζιών Z4 σε ΜΕΤΡΑ (default 0.05, χωριστό από Z1). */
  readonly revealThickness_m: number;
  /** Ποιες ζώνες είναι ενεργές. */
  readonly zones: EnvelopeZoneToggles;
}

// ============================================================================
// CONSTANTS / CONFIG
// ============================================================================

/**
 * Canonical material id για γραφιτούχα EPS (Neopor) — το default preset του
 * ETICS κελύφους. Πρέπει να ταυτίζεται με wall-material-catalog +
 * material-to-atoe-mapping (OIK-10.05).
 */
export const GRAPHITE_EPS_MATERIAL_ID = 'mat-eps-graphite' as const;

/**
 * Default πάχη (ΜΕΤΡΑ) — ADR-396 §5.
 */
export const DEFAULT_ENVELOPE_THICKNESS_M = 0.1 as const; // Z1/Z2/Z3
export const DEFAULT_REVEAL_THICKNESS_M = 0.05 as const; // Z4

/**
 * ΚΕΝΑΚ advisory ελάχιστα πάχη σε ΜΕΤΡΑ (OQ-1 RESOLVED 2026-05-29).
 *
 * ⚠️ ADVISORY ΜΟΝΟ — ΔΕΝ μπλοκάρει (ADR-396 D6). Ο ΚΕΝΑΚ ορίζει συντελεστή
 * θερμοπερατότητας U, όχι σταθερό πάχος· αυτές είναι πρακτικές κατώφλιες
 * τιμές για γραφιτούχα EPS που, αν παραβιαστούν, δίνουν soft warning.
 *
 * - `facade` (Z1/Z2/Z3): 7εκ — κανονικές επιφάνειες.
 * - `reveal` (Z4): 2εκ — μικρές επιφάνειες (εσωτ. περιγράμματα ανοιγμάτων).
 */
export const KENAK_MIN_THICKNESS_M = {
  facade: 0.07,
  reveal: 0.02,
} as const;

// ============================================================================
// ADVISORY HELPERS (pure, SSoT για threshold logic)
// ============================================================================

/** Επιστρέφει το advisory ελάχιστο πάχος (ΜΕΤΡΑ) για μια ζώνη. */
export function getEnvelopeMinThickness(zone: EnvelopeZoneId): number {
  return zone === 'Z4' ? KENAK_MIN_THICKNESS_M.reveal : KENAK_MIN_THICKNESS_M.facade;
}

/**
 * True όταν το πάχος είναι κάτω από το ΚΕΝΑΚ advisory όριο της ζώνης
 * (→ soft warning, ΟΧΙ block).
 */
export function isBelowKenakAdvisory(thickness_m: number, zone: EnvelopeZoneId): boolean {
  return thickness_m < getEnvelopeMinThickness(zone);
}
