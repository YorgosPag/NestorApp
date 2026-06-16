/**
 * Footing flexure check — EC2 §9.8.2 (ADR-464, Slice 2).
 *
 * Η ανοδική πίεση εδάφους κάμπτει το πέδιλο σαν πρόβολο που εξέχει από την παρειά
 * της κολώνας. Στην κρίσιμη διατομή (παρειά) η ροπή ανά μέτρο πλάτους:
 *
 *   M_Ed = p · a² / 2   (a = μήκος προβόλου = (dim − columnDim)/2, p = ULS πίεση)
 *
 * και ο απαιτούμενος **κάτω** οπλισμός (sagging) με απλοποιημένο μοχλοβραχίονα
 * z ≈ 0.9·d (d = thickness − cover):
 *
 *   As = M_Ed / (z · fyd)   (ανά μέτρο πλάτους)
 *
 * Σε εκκεντρότητα/αποκόλληση (e > kern → μέρος της βάσης σηκώνεται) εμφανίζεται
 * αντιστροφή ροπών → απαιτείται **άνω** σχάρα (hogging). Συντηρητικά ο άνω οπλισμός
 * λαμβάνεται ίσος με τον δυσμενέστερο κάτω (το πλήρες M_hog → loads phase, DEFER).
 *
 * Σύμβαση μονάδων εισόδου: mm γεωμετρία, kN/kNm φορτία ULS, mm επικάλυψη. Το ίδιο
 * βάρος πεδίλου ΔΕΝ συμμετέχει στην καμπτική πίεση (αυτο-ισορροπεί με την αντίδραση
 * εδάφους κάτω του). Pure — reuse `computeBasePressure` (SSoT) + `rebarFydMpa`.
 *
 * @see ./footing-bearing.ts — η κοινή κατανομή πίεσης
 * @see ../rebar-catalog.ts — fyd (B500C)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import { rebarFydMpa } from '../rebar-catalog';
import { computeBasePressure } from './footing-bearing';
import type { FlexureResult, FootingDesignInput } from './footing-design-types';

const MM_TO_M = 1 / 1000;
/** Απλοποιημένος μοχλοβραχίονας εσωτερικών δυνάμεων z ≈ 0.9·d (EC2 πρακτική). */
const LEVER_ARM_FACTOR = 0.9;
/** kNm → N·mm (1 kNm = 10⁶ N·mm). */
const KNM_TO_NMM = 1e6;

/**
 * Απαιτούμενος καμπτικός οπλισμός ανά μέτρο πλάτους (mm²/m) από ανοδική πίεση
 * `pKpa` σε πρόβολο μήκους `cantileverMm`, ενεργό βάθος `dMm`, fyd `fydMpa`.
 * Επιστρέφει 0 για εκφυλισμένη είσοδο.
 */
function flexuralAsPerMetre(
  pKpa: number,
  cantileverMm: number,
  dMm: number,
  fydMpa: number,
): number {
  if (pKpa <= 0 || cantileverMm <= 0 || dMm <= 0 || fydMpa <= 0) return 0;
  const aM = cantileverMm * MM_TO_M;
  const mEdKnmPerM = (pKpa * aM * aM) / 2; // kNm ανά μέτρο πλάτους
  const mEdNmm = mEdKnmPerM * KNM_TO_NMM; // N·mm ανά μέτρο πλάτους
  const zMm = LEVER_ARM_FACTOR * dMm;
  return mEdNmm / (zMm * fydMpa); // mm² ανά μέτρο πλάτους
}

/** Μήκος προβόλου από την παρειά της κολώνας (mm)· column dim 0 ⇒ πλήρες ημι-ίχνος. */
function cantileverMm(footingDimMm: number, columnDimMm: number): number {
  return Math.max(0, (footingDimMm - Math.max(0, columnDimMm)) / 2);
}

/**
 * Έλεγχος κάμψης μεμονωμένου πεδίλου (EC2 §9.8.2, ULS). Χρησιμοποιεί την ULS
 * κατανομή πίεσης (χωρίς ίδιο βάρος) — συντηρητικά την p_max ομοιόμορφα στον
 * πρόβολο. Όταν η ULS συνισταμένη βγαίνει εκτός πυρήνα → `hoggingGoverns`.
 */
export function computeFootingFlexure(input: FootingDesignInput): FlexureResult {
  const { ulsLoad, widthMm, lengthMm, thicknessMm, columnWidthMm, columnDepthMm } = input;
  const pressure = computeBasePressure(
    ulsLoad.axialKn,
    ulsLoad.momentXKnm,
    ulsLoad.momentYKnm,
    widthMm,
    lengthMm,
  );

  const fydMpa = rebarFydMpa();
  const dMm = Math.max(0, thicknessMm - input.coverMm);
  const asBottomXMm2PerM = flexuralAsPerMetre(pressure.pMaxKpa, cantileverMm(widthMm, columnWidthMm), dMm, fydMpa);
  const asBottomYMm2PerM = flexuralAsPerMetre(pressure.pMaxKpa, cantileverMm(lengthMm, columnDepthMm), dMm, fydMpa);

  const hoggingGoverns = pressure.upliftsBase;
  const asTopMm2PerM = hoggingGoverns ? Math.max(asBottomXMm2PerM, asBottomYMm2PerM) : 0;

  return {
    asBottomXMm2PerM,
    asBottomYMm2PerM,
    asTopMm2PerM,
    hoggingGoverns,
    eccentricityRatioX: widthMm > 0 ? pressure.eccentricityXMm / widthMm : 0,
    eccentricityRatioY: lengthMm > 0 ? pressure.eccentricityYMm / lengthMm : 0,
  };
}
