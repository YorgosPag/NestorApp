/**
 * ADR-422 L6 — Όρια θερμοπερατότητας κελύφους ΚΕΝΑΚ (U_max ανά στοιχείο × ζώνη).
 *
 * Config-only SSoT για τον **έλεγχο συμμόρφωσης κελύφους** (Revit Energy / 4M-FineHEAT
 * KENAK): τα ανώτατα επιτρεπόμενα `U` (W/m²K) ανά δομικό στοιχείο εξωτ. περιβλήματος
 * και κλιματική ζώνη (ΤΟΤΕΕ 20701-1 Πίνακας 3.3α, νέα κτίρια). Επεκτείνει το θεμέλιο
 * του ADR-396 (`kenak-thermal-config`) — **reuse** `ClimateZone` + `KENAK_MAX_U_WALL`
 * (όριο τοίχου), προσθέτει στέγη/δάπεδο-εδάφους/κούφωμα + το mapping
 * `(kind, condition) → U_max` που κωδικοποιεί ΚΑΙ το gate (μόνο εξωτ. κέλυφος).
 *
 * ⚠️ ADVISORY ΜΟΝΟ — soft check (mirror `isAboveKenakUMax`), ΔΕΝ μπλοκάρει. Ο έλεγχος
 * γίνεται στο **βασικό U** του στοιχείου (το ΔU_TB θερμογέφυρας αφορά μόνο το φορτίο,
 * όχι το κανονιστικό U_max). Documented defaults — εύκολα editable.
 *
 * @see ../kenak-thermal-config (ClimateZone + KENAK_MAX_U_WALL — θεμέλιο ADR-396)
 * @see ./derive-envelope-compliance (per-boundary έλεγχος — consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L6)
 */

import {
  KENAK_MAX_U_WALL,
  type ClimateZone,
} from '../kenak-thermal-config';
import type { BoundaryCondition, HeatLoadBoundaryKind } from './heat-load-types';

/**
 * ΚΕΝΑΚ / ΤΟΤΕΕ 20701-1 ανώτατο `U` (W/m²K) **οριζόντιου/κεκλιμένου δομικού στοιχείου
 * σε επαφή με τον εξωτ. αέρα** (στέγη / δώμα), ανά κλιματική ζώνη (νέα κτίρια).
 */
export const KENAK_MAX_U_ROOF: Record<ClimateZone, number> = {
  A: 0.5,
  B: 0.45,
  C: 0.4,
  D: 0.35,
};

/**
 * ΚΕΝΑΚ / ΤΟΤΕΕ 20701-1 ανώτατο `U` (W/m²K) **δαπέδου σε επαφή με το έδαφος** (ή με
 * μη θερμαινόμενο χώρο), ανά κλιματική ζώνη. Χαλαρότερο όριο (αδράνεια εδάφους).
 */
export const KENAK_MAX_U_FLOOR_GROUND: Record<ClimateZone, number> = {
  A: 1.2,
  B: 0.9,
  C: 0.75,
  D: 0.7,
};

/**
 * ΚΕΝΑΚ / ΤΟΤΕΕ 20701-1 ανώτατο `U` (W/m²K) **διαφανών/μη επιφανειών — κουφωμάτων**
 * (παράθυρα/πόρτες) σε επαφή με τον εξωτ. αέρα, ανά κλιματική ζώνη.
 */
export const KENAK_MAX_U_OPENING: Record<ClimateZone, number> = {
  A: 2.8,
  B: 2.6,
  C: 2.4,
  D: 2.2,
};

/**
 * Ανώτατο επιτρεπόμενο `U` (W/m²K) μιας οριακής επιφάνειας έναντι ΚΕΝΑΚ, βάσει
 * τύπου στοιχείου + οριακής συνθήκης + ζώνης. Επιστρέφει `null` όταν το στοιχείο
 * **δεν ανήκει στο εξωτ. κέλυφος** που ελέγχει ο ΚΕΝΑΚ (γειτονικοί/μη-θερμαινόμενοι
 * χώροι, οροφή ενδιάμεσου ορόφου, δάπεδο ενδιάμεσου ορόφου → δεν ελέγχονται).
 *
 * Έτσι η ίδια συνάρτηση κωδικοποιεί ΚΑΙ τον πίνακα ορίων ΚΑΙ το gate εξωτ. κελύφους.
 */
export function getKenakMaxU(
  kind: HeatLoadBoundaryKind,
  condition: BoundaryCondition,
  zone: ClimateZone,
): number | null {
  if (condition === 'external-air') {
    switch (kind) {
      case 'wall':
        return KENAK_MAX_U_WALL[zone];
      case 'window':
      case 'door':
        return KENAK_MAX_U_OPENING[zone];
      case 'roof':
        return KENAK_MAX_U_ROOF[zone];
      default:
        return null;
    }
  }
  if (condition === 'ground' && kind === 'floor') {
    return KENAK_MAX_U_FLOOR_GROUND[zone];
  }
  return null;
}

/**
 * True όταν το βασικό `U` της επιφάνειας ΥΠΕΡΒΑΙΝΕΙ το ΚΕΝΑΚ όριο → μη συμμόρφωση
 * (→ soft warning, ΟΧΙ block). Mirror του `isAboveKenakUMax` (ADR-396).
 */
export function isAboveKenakBoundaryUMax(uValue: number, uMax: number): boolean {
  return uValue > uMax;
}
