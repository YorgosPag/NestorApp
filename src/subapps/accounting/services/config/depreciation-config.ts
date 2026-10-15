/**
 * @fileoverview Αποσβέσεις — συντελεστές και σύμβαση περιόδου (SSoT)
 * @description Η ΜΙΑ αρχή για «πόσο αποσβένεται ένα πάγιο και από πότε». Τη διαβάζουν η φόρμα παγίου (εμφάνιση,
 *   προτεινόμενη ωφέλιμη ζωή), ο διακομιστής (ο συντελεστής ΑΠΟΦΑΣΙΖΕΤΑΙ εδώ, όχι από τον πελάτη) και ο πίνακας
 *   αποσβέσεων (`engines/depreciation-schedule.ts`).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-15, ADR-ACC-010 §2.1.1 Φάση 4): οι συντελεστές ζούσαν ΜΟΝΟ στη φόρμα του browser και το
 *   `POST /api/accounting/assets` αποθήκευε όποιον `depreciationRate` έστελνε ο πελάτης.
 *
 * Νομική βάση: ν.4172/2013 (ΚΦΕ) αρ.24 παρ.4 (συντελεστές) και παρ.6 (έναρξη) · ΠΟΛ 1073/2015.
 *
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AssetCategory } from '../../types/assets';

/** Ετήσιος συντελεστής φορολογικής απόσβεσης (%) ανά κατηγορία — σταθερή μέθοδος (ΚΦΕ αρ.24 παρ.4). */
export const ASSET_DEPRECIATION_RATES: Readonly<Record<AssetCategory, number>> = {
  buildings: 4,
  machinery: 10,
  vehicles: 16,
  furniture: 10,
  computers: 20,
  measurement_instruments: 10,
  other: 10,
};

/**
 * **Έλεγχος περιόδου** (SAP «period control»): ποιοι μήνες μετρούν στην αρχή και στο τέλος της ζωής του παγίου.
 *
 * - `acquisition: 'following_month'` — ΚΦΕ αρ.24 παρ.6: η απόσβεση αρχίζει τον μήνα που ΑΚΟΛΟΥΘΕΙ την έναρξη χρήσης.
 *   Πάγιο σε χρήση 15/3 ⇒ πρώτος μήνας απόσβεσης ο Απρίλιος (9/12 μέσα στη χρήση).
 * - `disposal: 'through_month'` — ο μήνας της εκποίησης μετρά (εκποίηση 30/6 ⇒ ως και τον Ιούνιο).
 */
export const DEPRECIATION_PERIOD_CONTROL = {
  acquisition: 'following_month',
  disposal: 'through_month',
} as const;

/** Ο συντελεστής της κατηγορίας. Ο ΜΟΝΟΣ τρόπος να αποκτήσει πάγιο συντελεστή. */
export function depreciationRateFor(category: AssetCategory): number {
  return ASSET_DEPRECIATION_RATES[category];
}

/** Προτεινόμενη ωφέλιμη ζωή σε έτη (100 / συντελεστής) — πληροφοριακή, δεν μπαίνει στον υπολογισμό. */
export function defaultUsefulLifeYears(category: AssetCategory): number {
  return Math.round(100 / depreciationRateFor(category));
}
