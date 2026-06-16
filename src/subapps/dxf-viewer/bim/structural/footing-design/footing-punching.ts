/**
 * Footing punching shear — EC2 §6.4 (ADR-464, Slice 3).
 *
 * Η συγκεντρωμένη αντίδραση της κολώνας τείνει να διατρήσει το πέδιλο σε κωνική
 * επιφάνεια γύρω της. Ελέγχουμε τη διατμητική τάση στο **βασικό κρίσιμο περίγραμμα**
 * u1 σε απόσταση 2d από την παρειά της κολώνας:
 *
 *   u1 = 2(c_x + c_y) + 2π·(2d)                       (στρογγυλεμένο ορθογώνιο)
 *   V_Ed,red = N_Ed − p_avg·A_crit                    (ανακούφιση εδάφους εντός u1)
 *   v_Ed = β·V_Ed,red / (u1·d)   vs   v_Rd,c          (EC2 §6.4.3 / §6.4.4)
 *
 * β = 1.15 (EC2 §6.4.3(6) απλοποιημένο, εσωτερική κολώνα)· το πλήρες β από ροπή/W1
 * = DEFER. v_Rd,c = ΕΝΑ SSoT (`footing-shear.concreteShearResistanceMpa`, §6.4.4
 * ίδιος τύπος). Αδρανές χωρίς διαστασιολογημένη κολώνα (advisory).
 *
 * Μονάδες: mm γεωμετρία, kN φορτία ULS, MPa τάσεις. Pure.
 *
 * @see ./footing-shear.ts — v_Rd,c (κοινό με one-way shear)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import { makeDesignCheck } from './footing-bearing';
import type { FootingDesignInput, PunchingResult } from './footing-design-types';
import { concreteShearResistanceMpa } from './footing-shear';

const MM2_TO_M2 = 1e-6;
/** EC2 §6.4.2 — απόσταση βασικού κρίσιμου περιγράμματος από την παρειά = 2d. */
const CONTROL_PERIMETER_DISTANCE_FACTOR = 2;
/** EC2 §6.4.3(6) — απλοποιημένος συντελεστής φορτίου β (εσωτερική κολώνα). */
const PUNCHING_BETA = 1.15;

/** Ενεργό βάθος πεδίλου d ≈ thickness − cover (mm). */
function effectiveDepthMm(input: FootingDesignInput): number {
  return Math.max(0, input.thicknessMm - input.coverMm);
}

/**
 * Έλεγχος διάτρησης μεμονωμένου πεδίλου (EC2 §6.4) στο βασικό περίγραμμα 2d. Η
 * δρώσα τέμνουσα ανακουφίζεται από την πίεση εδάφους εντός του περιγράμματος
 * (EC2 §6.4.4(2)). Αδρανές (adequate, μηδέν demand) χωρίς διαστασιολογημένη κολώνα.
 */
export function computeFootingPunching(input: FootingDesignInput): PunchingResult {
  const { widthMm, lengthMm, columnWidthMm, columnDepthMm, ulsLoad } = input;
  const dMm = effectiveDepthMm(input);
  const vRdc = concreteShearResistanceMpa(input.concreteGrade, dMm, input.flexuralRatioL);
  const aMm = CONTROL_PERIMETER_DISTANCE_FACTOR * dMm;
  const u1Mm = 2 * (columnWidthMm + columnDepthMm) + 2 * Math.PI * aMm;

  if (columnWidthMm <= 0 || columnDepthMm <= 0 || dMm <= 0) {
    return { vEdMpa: 0, vRdcMpa: vRdc, controlPerimeterMm: u1Mm, check: makeDesignCheck(0, vRdc) };
  }

  const nEdKn = Math.max(0, ulsLoad.axialKn);
  const footingAreaMm2 = widthMm * lengthMm;
  const pAvgKpa = footingAreaMm2 > 0 ? nEdKn / (footingAreaMm2 * MM2_TO_M2) : 0;
  // Στρογγυλεμένο ορθογώνιο εμβαδό εντός του βασικού περιγράμματος — capped στο
  // ίχνος (συμπαγές/χοντρό πέδιλο: το περίγραμμα ξεπερνά το πέδιλο → πλήρης ανακούφιση).
  const critAreaMm2 = columnWidthMm * columnDepthMm + 2 * aMm * (columnWidthMm + columnDepthMm) + Math.PI * aMm * aMm;
  const reliefKn = pAvgKpa * Math.min(critAreaMm2, footingAreaMm2) * MM2_TO_M2;
  const vEdRedKn = Math.max(0, nEdKn - reliefKn);

  const vEdMpa = u1Mm > 0 ? (PUNCHING_BETA * vEdRedKn * 1000) / (u1Mm * dMm) : 0;
  return { vEdMpa, vRdcMpa: vRdc, controlPerimeterMm: u1Mm, check: makeDesignCheck(vEdMpa, vRdc) };
}
