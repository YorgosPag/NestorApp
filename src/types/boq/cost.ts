/**
 * BOQ Cost Types — Computed Results
 *
 * Τύποι για υπολογιζόμενα αποτελέσματα κοστολόγησης.
 * Κανένα από αυτά ΔΕΝ αποθηκεύεται στο Firestore — υπολογίζονται at runtime.
 *
 * @module types/boq/cost
 * @see ADR-175 §4.1.4 (Waste Factor), §3.4 (Cost Breakdown)
 */

import type { BOQMeasurementUnit, SourceAuthority } from './units';

// ============================================================================
// COST BREAKDOWN — ΑΝΑ ITEM
// ============================================================================

/** Πλήρης ανάλυση κόστους ενός BOQ item */
export interface CostBreakdown {
  /** Καθαρή ποσότητα (net — αυτό που μετράς) */
  netQuantity: number;

  /** Μικτή ποσότητα (gross — net × (1 + wasteFactor)) */
  grossQuantity: number;

  /** Κόστος υλικών (gross × materialUnitCost) */
  materialCost: number;

  /** Κόστος εργασίας (gross × laborUnitCost) */
  laborCost: number;

  /** Κόστος εξοπλισμού (gross × equipmentUnitCost) */
  equipmentCost: number;

  /** Μοναδιαίο κόστος (material + labor + equipment per unit) */
  unitCost: number;

  /** Συνολικό κόστος (material + labor + equipment) */
  totalCost: number;

  /** Ποσοστό φύρας που εφαρμόστηκε */
  wasteFactorApplied: number;

  /** Μονάδα μέτρησης */
  unit: BOQMeasurementUnit;
}

// ============================================================================
// PRICE RESOLUTION — ΤΙΜΟΚΑΤΑΛΟΓΟΣ INHERITANCE
// ============================================================================

/** Αποτέλεσμα αναζήτησης τιμής (3-level inheritance) */
export interface PriceResolution {
  /** Τιμή υλικού (resolved) */
  materialUnitCost: number;

  /** Τιμή εργασίας (resolved) */
  laborUnitCost: number;

  /** Τιμή εξοπλισμού (resolved) */
  equipmentUnitCost: number;

  /** Από ποιο επίπεδο προήλθε η τιμή */
  authority: SourceAuthority;

  /** ID τιμοκαταλόγου (αν authority = 'master' ή 'project') */
  priceListId: string | null;
}

// ============================================================================
// VARIANCE — ΑΠΟΚΛΙΣΗ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ
// ============================================================================

/** Αποτέλεσμα σύγκρισης εκτίμησης vs πραγματικών */
export interface VarianceResult {
  /** Εκτιμώμενη ποσότητα */
  estimated: number;

  /** Πραγματική ποσότητα */
  actual: number;

  /** Απόκλιση σε μονάδες (actual - estimated) */
  delta: number;

  /** Απόκλιση σε ποσοστό (delta / estimated × 100) */
  percent: number;

  /** Εκτιμώμενο κόστος */
  estimatedCost: number;

  /** Πραγματικό κόστος */
  actualCost: number;

  /** Απόκλιση κόστους (actual - estimated) */
  costDelta: number;
}

// ============================================================================
// CATEGORY COST — ΑΘΡΟΙΣΤΙΚΟ ΑΝΑ ΚΑΤΗΓΟΡΙΑ
// ============================================================================

/** Αθροιστικό κόστος ανά κατηγορία ΑΤΟΕ — computed */
export interface BOQCategoryCost {
  categoryCode: string;
  categoryName: string;
  itemCount: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalCost: number;
}
