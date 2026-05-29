/**
 * ADR-396 Phase P8 — ΚΕΝΑΚ θερμική config (κλιματικές ζώνες + όρια U + reference τοίχος).
 *
 * Config-only (μηδέν logic-heavy· τιμές νομοθεσίας/προτύπων). SSoT για:
 *   - τις 4 κλιματικές ζώνες της Ελλάδας (ΤΟΤΕΕ 20701-3),
 *   - τα ανώτατα όρια U_max εξωτ. τοίχου ανά ζώνη (ΤΟΤΕΕ 20701-1),
 *   - τον αντιπροσωπευτικό «τυπικό τοίχο» για τον υπολογισμό assembly U μέσα
 *     στον dialog θερμοπρόσοψης (ο dialog είναι ανά-όροφο, όχι ανά συγκεκριμένο
 *     τοίχο — απόφαση Giorgio P8).
 *
 * ⚠️ ADVISORY ΜΟΝΟ — soft-warn (mirror `isBelowKenakAdvisory`, ADR-396 D6/OQ-1),
 * ΔΕΝ μπλοκάρει. Η κλιματική ζώνη αποθηκεύεται ως ρύθμιση κτιρίου
 * (`Building.climateZone`, OQ-7a).
 *
 * @see ./assembly-u-value (computeAssemblyUValue — pure math)
 * @see ../types/thermal-envelope-types (ENVELOPE_MATERIAL_OPTIONS — ίδιο pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.2(b), §7 (P8), OQ-7
 */

import type { ThermalLayer } from './assembly-u-value';

/**
 * Κλιματική ζώνη Ελλάδας. ASCII internal (A/B/C/D)· τα ελληνικά labels
 * (Α/Β/Γ/Δ) προέρχονται από i18n. Πρέπει να ταυτίζεται με
 * `Building.climateZone` (src/types/building/contracts.ts).
 */
export type ClimateZone = 'A' | 'B' | 'C' | 'D';

/**
 * ΚΕΝΑΚ / ΤΟΤΕΕ 20701-1 ανώτατο U (W/m²K) ΕΞΩΤΕΡΙΚΟΥ ΤΟΙΧΟΥ σε επαφή με τον
 * εξωτ. αέρα, ανά κλιματική ζώνη (νέα κτίρια).
 */
export const KENAK_MAX_U_WALL: Record<ClimateZone, number> = {
  A: 0.55,
  B: 0.45,
  C: 0.4,
  D: 0.35,
};

/**
 * Αντιπροσωπευτικός «τυπικός τοίχος» (χωρίς τη θερμοπρόσοψη) για τον
 * υπολογισμό του assembly U στο panel: εξωτ. σοβάς + οπτοπλινθοδομή + εσωτ.
 * σοβάς. λ από `wall-material-catalog`. Documented default — εύκολα editable.
 */
export const REFERENCE_BARE_WALL_LAYERS: readonly ThermalLayer[] = [
  { thickness_m: 0.02, lambda: 0.87 }, // εξωτ. σοβάς (mat-plaster-ext)
  { thickness_m: 0.2, lambda: 0.51 }, // οπτοπλινθοδομή (mat-brick-masonry)
  { thickness_m: 0.02, lambda: 0.7 }, // εσωτ. σοβάς (mat-plaster-int)
];

/** Επιλογή κλιματικής ζώνης για το dialog Select (mirror ENVELOPE_MATERIAL_OPTIONS). */
export interface ClimateZoneOption {
  readonly id: ClimateZone;
  /** i18n key στο `dxf-viewer-shell` namespace (N.11). */
  readonly labelKey: string;
}

export const CLIMATE_ZONE_OPTIONS: readonly ClimateZoneOption[] = [
  { id: 'A', labelKey: 'ribbon.commands.thermalEnvelope.climateZone.zones.A' },
  { id: 'B', labelKey: 'ribbon.commands.thermalEnvelope.climateZone.zones.B' },
  { id: 'C', labelKey: 'ribbon.commands.thermalEnvelope.climateZone.zones.C' },
  { id: 'D', labelKey: 'ribbon.commands.thermalEnvelope.climateZone.zones.D' },
] as const;

/** Επιστρέφει το ΚΕΝΑΚ ανώτατο U (W/m²K) εξωτ. τοίχου της ζώνης. */
export function getKenakMaxUWall(zone: ClimateZone): number {
  return KENAK_MAX_U_WALL[zone];
}

/**
 * True όταν το U της διάταξης ΥΠΕΡΒΑΙΝΕΙ το ΚΕΝΑΚ όριο της ζώνης
 * (→ soft warning, ΟΧΙ block).
 */
export function isAboveKenakUMax(uValue: number, zone: ClimateZone): boolean {
  return uValue > getKenakMaxUWall(zone);
}
