/**
 * ADR-929 Φ4 — **πόσο ακριβής είναι μια γραμμένη διάσταση;** Από το κείμενο **όπως γράφτηκε**, όχι από υπόθεση.
 *
 * 🔑 «3.50» σε μέτρα έχει τελευταίο ψηφίο τα εκατοστά ⇒ η αληθινή τιμή είναι κάπου στο [3,495, 3,505) ⇒ ομοιόμορφο σφάλμα
 * στρογγυλοποίησης με σ = 10 mm / √12. Το «350» σε εκατοστά λέει το ίδιο. Το «3500» σε χιλιοστά είναι δέκα φορές ακριβέστερο.
 * Έτσι ο λύτης δίνει σε κάθε διάσταση **το βάρος που της αξίζει**, και μια διάσταση γραμμένη με εκατοστό δεν «χτυπά» ως
 * σύγκρουση επειδή η γεωμετρία διαφέρει κατά 4 mm.
 * ⚠️ Ο εκθέτης των ελληνικών σχεδίων («3.50⁵» = 3,505 m) δεν είναι ψηφίο ASCII: η αντιστοίχιση πέφτει στο κοντινότερο
 * ψηφίο και η ακρίβεια **υπερεκτιμάται** (συντηρητικά, ποτέ το αντίθετο).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/dimension-precision
 */

import { normalizeNumber } from '../../../systems/dynamic-input/utils/number';
import { WRITTEN_UNITS_MM, writtenNumberTokens } from '../reading/written-values';

/** Χωρίς αναγνωρίσιμο αριθμό στο κείμενο: η συνήθης ακρίβεια σχεδίου (εκατοστό). */
export const DEFAULT_DIMENSION_PRECISION_MM = 10;

/**
 * Το μέγεθος του τελευταίου γραμμένου ψηφίου, σε mm· η προεπιλογή όταν κανένας αριθμός του κειμένου δεν δίνει την τιμή.
 * Οι μονάδες και ο αριθμός έρχονται από το SSoT `reading/written-values` (ADR-929 Φ0.5).
 */
export function writtenPrecisionMm(raw: string, valueMm: number): number {
  for (const token of writtenNumberTokens(raw)) {
    const decimals = token.split(/[.,]/)[1]?.length ?? 0;
    const value = Number.parseFloat(normalizeNumber(token));
    for (const unit of WRITTEN_UNITS_MM) {
      const lastDigitMm = unit * 10 ** -decimals;
      if (Math.abs(value * unit - valueMm) <= lastDigitMm) return Math.max(lastDigitMm, 1);
    }
  }
  return DEFAULT_DIMENSION_PRECISION_MM;
}

/** Τυπική απόκλιση της γραμμένης τιμής (mm): στρογγυλοποίηση (ομοιόμορφη) ⊕ σφάλμα σχεδίασης. */
export function dimensionSigmaMm(precisionMm: number, draftSigmaMm: number): number {
  return Math.hypot(precisionMm / Math.sqrt(12), draftSigmaMm);
}
