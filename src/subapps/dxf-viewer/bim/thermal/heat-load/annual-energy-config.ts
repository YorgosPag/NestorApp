/**
 * ADR-422 L7 — Ετήσια ενεργειακή ζήτηση θέρμανσης: config SSoT (βαθμοημέρες + bands).
 *
 * Config-only SSoT για τη **μέθοδο βαθμοημερών (degree-day, ΤΟΤΕΕ 20701-3 / EN ISO
 * 13790 simplified)**: τις αντιπροσωπευτικές βαθμοημέρες θέρμανσης `HDD` (K·ημέρα,
 * base-18) ανά κλιματική ζώνη + τα ενδεικτικά κατώφλια ειδικής ζήτησης (kWh/m²·έτος)
 * → ετικέτα ενεργειακής κατηγορίας. Isolation (mirror της D-B του L6 `kenak-envelope-
 * limits`) — **ΟΧΙ fork** του ADR-396 `kenak-thermal-config` — αλλά **reuse** `ClimateZone`.
 *
 * ⚠️ ΕΝΔΕΙΚΤΙΚΟ (advisory): η κατηγορία εδώ αφορά τη **ζήτηση** (demand, ανεξάρτητη
 * συστήματος/καυσίμου), ΟΧΙ την επίσημη ΚΕΝΑΚ κατάταξη πρωτογενούς ενέργειας (λόγος
 * προς κτίριο αναφοράς — απαιτεί βαθμό απόδοσης λέβητα, future L8). Documented defaults,
 * εύκολα editable. Καμία inline literal στον engine (`derive-annual-energy`).
 *
 * @see ../kenak-thermal-config (ClimateZone — θεμέλιο ADR-396, reuse)
 * @see ./derive-annual-energy (deriveAnnualHeating — consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7)
 */

import type { ClimateZone } from '../kenak-thermal-config';

/**
 * ΤΟΤΕΕ 20701-3 — αντιπροσωπευτικές **βαθμοημέρες θέρμανσης** `HDD` (K·ημέρα, base-18)
 * ανά κλιματική ζώνη. Ολοκληρώνουν το ΔΤ (Ti − Te) επί την περίοδο θέρμανσης → η
 * ετήσια ζήτηση `Q_H = H · HDD · 24 / 1000` **δεν** χρησιμοποιεί το ΔΤ σχεδιασμού.
 *
 * ⚠️ Αντιπροσωπευτικές τιμές ανά ΖΩΝΗ (documented defaults — η ΤΟΤΕΕ 20701-3 δίνει
 * βαθμοημέρες ανά συγκεκριμένη πόλη/υψόμετρο· εδώ μία τυπική τιμή ζώνης, editable).
 * Ψυχρότερη ζώνη → περισσότερες βαθμοημέρες:
 *   - A (νότια/νησιά, ηπιότερη): ~900 K·ημέρα
 *   - B: ~1300 K·ημέρα
 *   - C: ~1800 K·ημέρα
 *   - D (ορεινή/βόρεια, ψυχρότερη): ~2400 K·ημέρα
 */
export const HEATING_DEGREE_DAYS: Record<ClimateZone, number> = {
  A: 900,
  B: 1300,
  C: 1800,
  D: 2400,
};

/** Ένα ενδεικτικό band κατηγορίας ζήτησης: ανώτατη ειδική ζήτηση → ετικέτα. */
export interface EnergyDemandClassBand {
  /** kWh/m²·έτος — ανώτατο όριο (inclusive) του band. `Infinity` = χειρότερο band. */
  readonly maxSpecificDemandKWhM2: number;
  /** Ετικέτα κατηγορίας (alphanumeric code, μη-μεταφράσιμο: A+ … H). */
  readonly label: string;
}

/**
 * Ενδεικτικά κατώφλια ειδικής ζήτησης θέρμανσης (kWh/m²·έτος) → ετικέτα κατηγορίας,
 * **αύξουσα σειρά** ορίου (καλύτερη → χειρότερη). Documented indicative defaults
 * (πρότυπο ΚΕΝΑΚ A+→H, εδώ ως **ζήτηση** όχι πρωτογενής ενέργεια). Το τελευταίο band
 * έχει `Infinity` ⇒ καλύπτει κάθε υψηλότερη ζήτηση. Εύκολα editable.
 */
export const ENERGY_DEMAND_CLASS_BANDS: readonly EnergyDemandClassBand[] = [
  { maxSpecificDemandKWhM2: 30, label: 'A+' },
  { maxSpecificDemandKWhM2: 50, label: 'A' },
  { maxSpecificDemandKWhM2: 70, label: 'B+' },
  { maxSpecificDemandKWhM2: 95, label: 'B' },
  { maxSpecificDemandKWhM2: 120, label: 'C' },
  { maxSpecificDemandKWhM2: 150, label: 'D' },
  { maxSpecificDemandKWhM2: 185, label: 'E' },
  { maxSpecificDemandKWhM2: 225, label: 'F' },
  { maxSpecificDemandKWhM2: 270, label: 'G' },
  { maxSpecificDemandKWhM2: Infinity, label: 'H' },
] as const;

/** Επιστρέφει τις αντιπροσωπευτικές βαθμοημέρες θέρμανσης (K·ημέρα) της ζώνης. */
export function getHeatingDegreeDays(zone: ClimateZone): number {
  return HEATING_DEGREE_DAYS[zone];
}

/**
 * Ταξινομεί την ειδική ετήσια ζήτηση (kWh/m²·έτος) σε **ενδεικτική** κατηγορία
 * (A+ … H). Επιστρέφει την ετικέτα του πρώτου band που καλύπτει τη ζήτηση
 * (`qH ≤ maxSpecificDemandKWhM2`). Idempotent, pure.
 */
export function classifyEnergyDemand(specificDemandKWhM2: number): string {
  for (const band of ENERGY_DEMAND_CLASS_BANDS) {
    if (specificDemandKWhM2 <= band.maxSpecificDemandKWhM2) return band.label;
  }
  // Αδύνατο (το τελευταίο band είναι Infinity) — defensive fallback.
  return ENERGY_DEMAND_CLASS_BANDS[ENERGY_DEMAND_CLASS_BANDS.length - 1].label;
}
