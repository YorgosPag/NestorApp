/**
 * Footing shear resistance + one-way (beam) shear — EC2 §6.2.2 (ADR-464, Slice 3).
 *
 * ΕΝΑ SSoT για την αντοχή σκυροδέματος σε τέμνουσα χωρίς συνδετήρες v_Rd,c (EC2
 * εξ. 6.2.a)· το μοιράζονται ΚΑΙ ο έλεγχος τέμνουσας μονής διεύθυνσης (εδώ) ΚΑΙ η
 * διάτρηση (`footing-punching.ts`, §6.4.4 — ίδιος τύπος v_Rd,c) — μηδέν διπλό (N.0.2):
 *
 *   v_Rd,c = max( C_Rd,c·k·(100·ρl·fck)^(1/3) ,  v_min )
 *   C_Rd,c = 0.18/γc · k = 1+√(200/d) ≤ 2 · v_min = 0.035·k^1.5·√fck · ρl ≤ 0.02
 *
 * One-way shear: στην κρίσιμη διατομή d από την παρειά κολώνας, η ανοδική πίεση
 * εδάφους πέρα από αυτήν δίνει V_Ed → v_Ed = V_Ed/(b·d) ανά διεύθυνση. Το πέδιλο
 * συνήθως ΔΕΝ έχει συνδετήρες → επάρκεια μόνο μέσω v_Rd,c (αλλιώς αυξάνεις πάχος).
 *
 * Μονάδες: mm γεωμετρία, kN/kNm φορτία ULS, MPa τάσεις. Pure — reuse `computeBasePressure`.
 *
 * @see ./footing-punching.ts — διάτρηση (ίδιο v_Rd,c)
 * @see ../concrete-grades.ts — fck, γc
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import { CONCRETE_GRADES, GAMMA_C, type ConcreteGrade } from '../concrete-grades';
import { computeBasePressure, makeDesignCheck } from './footing-bearing';
import type { FootingDesignInput, OneWayShearResult } from './footing-design-types';

const MM_TO_M = 1 / 1000;
/** EC2 §6.2.2(1) C_Rd,c = 0.18/γc. */
const C_RDC_FACTOR = 0.18;
/** EC2 §6.2.2(1) — άνω όριο ρl στον τύπο v_Rd,c. */
const MAX_RHO_L = 0.02;
/** EC2 §6.4.2 — κρίσιμη διατομή τέμνουσας μονής διεύθυνσης = d από την παρειά. */
const ONE_WAY_CRITICAL_DISTANCE_FACTOR = 1;

/**
 * Αντοχή σκυροδέματος σε τέμνουσα χωρίς συνδετήρες v_Rd,c (MPa), EC2 §6.2.2(1) —
 * ΕΝΑ SSoT για one-way shear & διάτρηση. `dMm` = ενεργό βάθος, `rhoL` = ποσοστό
 * εφελκυόμενου οπλισμού (cap 2%). 0 για εκφυλισμένο d.
 */
export function concreteShearResistanceMpa(
  grade: ConcreteGrade,
  dMm: number,
  rhoL: number,
  gammaC: number = GAMMA_C,
): number {
  if (dMm <= 0) return 0;
  const fck = CONCRETE_GRADES[grade].fckMpa;
  const k = Math.min(1 + Math.sqrt(200 / dMm), 2.0);
  const rho = Math.min(Math.max(rhoL, 0), MAX_RHO_L);
  const vRdc = (C_RDC_FACTOR / gammaC) * k * Math.cbrt(100 * rho * fck);
  const vMin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
  return Math.max(vRdc, vMin);
}

/** Ενεργό βάθος πεδίλου d ≈ thickness − cover (mm). */
function effectiveDepthMm(input: FootingDesignInput): number {
  return Math.max(0, input.thicknessMm - input.coverMm);
}

/** Αδρανές αποτέλεσμα (μηδέν demand, adequate) — όταν δεν αξιολογείται. */
function notApplicable(vRdcMpa: number): OneWayShearResult {
  return { vEdXMpa: 0, vEdYMpa: 0, vRdcMpa, check: makeDesignCheck(0, vRdcMpa) };
}

/**
 * v_Ed (MPa) μιας κρίσιμης διατομής τέμνουσας: ανοδική πίεση `pKpa` στον πρόβολο
 * πέρα από την κρίσιμη διατομή (μήκος (dim−col)/2 − d), σε πλάτος `perpDimMm`.
 * 0 όταν η κρίσιμη διατομή πέφτει εκτός του προβόλου.
 */
function oneWayVEdMpa(
  pKpa: number,
  footingDimMm: number,
  columnDimMm: number,
  perpDimMm: number,
  dMm: number,
): number {
  const cantileverM = ((footingDimMm - Math.max(0, columnDimMm)) / 2) * MM_TO_M;
  const criticalM = ONE_WAY_CRITICAL_DISTANCE_FACTOR * dMm * MM_TO_M;
  const beyondM = cantileverM - criticalM;
  if (beyondM <= 0 || dMm <= 0 || perpDimMm <= 0 || pKpa <= 0) return 0;
  const vEdKn = pKpa * beyondM * (perpDimMm * MM_TO_M); // kN
  return (vEdKn * 1000) / (perpDimMm * dMm); // N / mm² = MPa
}

/**
 * Έλεγχος τέμνουσας μονής διεύθυνσης πεδίλου (EC2 §6.2.2). Συντηρητικά χρησιμοποιεί
 * την ULS p_max (ομοιόμορφα) ανά διεύθυνση· το δυσμενέστερο v_Ed οδηγεί το check.
 * Αδρανές χωρίς διαστασιολογημένη κολώνα (advisory).
 */
export function computeFootingOneWayShear(input: FootingDesignInput): OneWayShearResult {
  const { widthMm, lengthMm, columnWidthMm, columnDepthMm, ulsLoad } = input;
  const dMm = effectiveDepthMm(input);
  const vRdc = concreteShearResistanceMpa(input.concreteGrade, dMm, input.flexuralRatioL);
  if (columnWidthMm <= 0 || columnDepthMm <= 0 || dMm <= 0) return notApplicable(vRdc);

  const pMaxKpa = computeBasePressure(ulsLoad.axialKn, ulsLoad.momentXKnm, ulsLoad.momentYKnm, widthMm, lengthMm).pMaxKpa;
  // X: κρίσιμη διατομή κάθετα στο X (πρόβολος κατά X)· πλάτος = μήκος Y.
  const vEdXMpa = oneWayVEdMpa(pMaxKpa, widthMm, columnWidthMm, lengthMm, dMm);
  const vEdYMpa = oneWayVEdMpa(pMaxKpa, lengthMm, columnDepthMm, widthMm, dMm);
  return { vEdXMpa, vEdYMpa, vRdcMpa: vRdc, check: makeDesignCheck(Math.max(vEdXMpa, vEdYMpa), vRdc) };
}
