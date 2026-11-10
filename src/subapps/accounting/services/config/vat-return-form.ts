/**
 * @fileoverview **Δήλωση ΦΠΑ (Φ2) — τα πεδία εκροών χωρίς ΦΠΑ: η ρίζα** (ADR-ACC-003 §22.7).
 * @module subapps/accounting/services/config/vat-return-form
 *
 * Πηγή: ΑΑΔΕ, έντυπο **«050 Φ.Π.Α. έκδοση 2025 – Φ2 TAXIS»** (απόφαση Α.1077/2025, Β΄ 2770 — πράξεις από 1.7.2025)
 * και εγκύκλιος **Ε.2071/2025** (26.8.2025, ΑΔΑ 9Λ9Ρ46ΜΠ3Ζ-ΖΘΦ). Πίνακας Β, υποπίνακας α «Εκροές».
 * https://www.aade.gr/sites/default/files/2025-06/f2_taxis_2025.pdf
 *
 * 🔑 **Μόνο ταυτότητες** (όπως το `en16931-vat-codes.ts`): ο αριθμός του πεδίου και αν οι πράξεις του δίνουν δικαίωμα
 * έκπτωσης — αυτό λέει η **επικεφαλίδα** του ίδιου του πεδίου στο έντυπο. Κανένα κείμενο (κανένα UI ακόμη).
 *
 * ⚠️ Τα πεδία 301–309 (φορολογητέες εκροές ανά συντελεστή) **δεν** ανήκουν εδώ: εδώ ζει μόνο ό,τι δέχεται γραμμή 0%
 * με αιτία εξαίρεσης §8.3. Τα 313–315 αφορούν τον κύκλο εργασιών / αγορές, όχι την αιτία.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

/** Η έκδοση του εντύπου που περιγράφεται εδώ. */
export const VAT_RETURN_FORM_EDITION = '050-FPA-2025' as const;

/**
 * Τα πεδία εκροών **χωρίς ΦΠΑ** του Φ2 2025. `deductible` = οι πράξεις του πεδίου δίνουν δικαίωμα έκπτωσης του φόρου
 * εισροών (επικεφαλίδα του εντύπου· ν. 5144/2024 άρθρο 35 §2):
 * - 342 Ενδοκοινοτικές παραδόσεις
 * - 345 Ενδοκοινοτικές παροχές υπηρεσιών άρθρ. 18.2.α (λεκτικό Ε.2071/2025 §2.i)
 * - 348 Εξαγωγές & απαλλαγές πλοίων & αεροσκαφών
 * - 349 Λοιπές εκροές χωρίς ΦΠΑ **με** δικαίωμα έκπτωσης
 * - 310 Εκροές απαλλασσόμενες & εξαιρούμενες **χωρίς** δικαίωμα έκπτωσης
 */
export const VAT_RETURN_EXEMPT_OUTPUT_FIELDS = [
  { field: 342, deductible: true },
  { field: 345, deductible: true },
  { field: 348, deductible: true },
  { field: 349, deductible: true },
  { field: 310, deductible: false },
] as const;

/** Αριθμός πεδίου Φ2 εκροών χωρίς ΦΠΑ — παραγόμενος από τον πίνακα, ποτέ γραμμένος με το χέρι. */
export type VatReturnExemptOutputField = (typeof VAT_RETURN_EXEMPT_OUTPUT_FIELDS)[number]['field'];

/** Δίνουν οι πράξεις του πεδίου δικαίωμα έκπτωσης; Ο τύπος είναι στενεμένος ⇒ η εύρεση δεν αποτυγχάνει ποτέ. */
export function isDeductibleVatReturnField(field: VatReturnExemptOutputField): boolean {
  return VAT_RETURN_EXEMPT_OUTPUT_FIELDS.some((entry) => entry.field === field && entry.deductible);
}
