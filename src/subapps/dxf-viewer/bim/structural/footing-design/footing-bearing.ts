/**
 * Footing bearing check — EC7 (ADR-464, Slice 1).
 *
 * Υπολογίζει την κατανομή πίεσης εδάφους κάτω από μεμονωμένο πέδιλο υπό αξονικό
 * φορτίο + διαξονική ροπή (SLS) και τη συγκρίνει με την επιτρεπόμενη τάση έδρασης
 * σ_allow. Μέθοδος ευθύγραμμης κατανομής (rigid footing):
 *
 *   - **Εντός πυρήνα** (e_x ≤ W/6 ΚΑΙ e_y ≤ L/6 → bracket ≤ 1): πλήρης επαφή,
 *     p = N/A·(1 ± 6e_x/W ± 6e_y/L) — ακριβές.
 *   - **Εκτός πυρήνα** (bracket > 1): μερική αποκόλληση (p_min = 0). Για μονοαξονική
 *     αποκόλληση χρησιμοποιείται η ακριβής σχέση τριγωνικής επαφής
 *     p_max = 2N/(3·B·(D/2−e))· για διαξονική γωνιακή αποκόλληση λαμβάνεται
 *     **συντηρητική** εκτίμηση (max με την ελαστική N/A·(1+bracket)). Η ακριβής
 *     επαναληπτική διαξονική μέθοδος → loads phase (DEFER).
 *
 * Μονάδες: mm in, kN/kNm φορτία, kPa πίεση. Pure — zero deps πέραν των types.
 *
 * @see ./footing-design-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type {
  BasePressure,
  BearingResult,
  DesignCheck,
  FootingDesignInput,
} from './footing-design-types';

const MM_TO_M = 1 / 1000;
/** Όριο πυρήνα (kern) — e/dim πέραν του οποίου εμφανίζεται αποκόλληση (1/6 ορθογ.). */
export const KERN_RATIO = 1 / 6;

/** Μηδενική (no-demand) κατανομή πίεσης όταν δεν υπάρχει καθαρό θλιπτικό φορτίο/εμβαδό. */
const ZERO_PRESSURE: BasePressure = {
  pMaxKpa: 0,
  pMinKpa: 0,
  eccentricityXMm: 0,
  eccentricityYMm: 0,
  upliftsBase: false,
};

/**
 * Μέγιστη πίεση τριγωνικής (μερικής) επαφής για μονοαξονική αποκόλληση:
 * p_max = 2N / (3·B·(D/2 − e)). Συνεχής με την πλήρη επαφή στο όριο e = D/6.
 * Επιστρέφει `Infinity` όταν e ≥ D/2 (συνισταμένη εκτός βάσης → ανατροπή).
 */
function partialContactPMax(axialKn: number, perpM: number, dimM: number, eM: number): number {
  const halfContact = dimM / 2 - eM;
  if (halfContact <= 0) return Number.POSITIVE_INFINITY;
  return (2 * axialKn) / (3 * perpM * halfContact);
}

/**
 * ΕΝΑ SSoT για την κατανομή πίεσης εδάφους κάτω από ορθογώνιο πέδιλο (rigid) υπό
 * αξονικό N + διαξονική ροπή — εντός πυρήνα ακριβές (τραπεζοειδής), εκτός πυρήνα
 * μονοαξονική αποκόλληση ακριβής τριγωνική / διαξονική συντηρητική. Καλείται από
 * τον έλεγχο έδρασης (SLS) **και** την κάμψη (ULS) — μηδέν διπλότυπο (N.0.2).
 */
export function computeBasePressure(
  axialKn: number,
  momentXKnm: number,
  momentYKnm: number,
  widthMm: number,
  lengthMm: number,
): BasePressure {
  if (axialKn <= 0) return ZERO_PRESSURE;
  const widthM = widthMm * MM_TO_M;
  const lengthM = lengthMm * MM_TO_M;
  const areaM2 = widthM * lengthM;
  if (areaM2 <= 0) return ZERO_PRESSURE;

  const avgKpa = axialKn / areaM2;
  const eXm = Math.abs(momentXKnm) / axialKn;
  const eYm = Math.abs(momentYKnm) / axialKn;
  const kx = (6 * eXm) / widthM;
  const ky = (6 * eYm) / lengthM;
  const bracket = kx + ky;

  if (bracket <= 1) {
    return {
      pMaxKpa: avgKpa * (1 + bracket),
      pMinKpa: avgKpa * (1 - bracket),
      eccentricityXMm: eXm / MM_TO_M,
      eccentricityYMm: eYm / MM_TO_M,
      upliftsBase: false,
    };
  }

  // Εκτός πυρήνα — συντηρητική ελαστική βάση (αγνοεί αποκόλληση).
  let pMax = avgKpa * (1 + bracket);
  const rx = eXm / widthM;
  const ry = eYm / lengthM;
  if (rx > KERN_RATIO || ry > KERN_RATIO) {
    const yGoverns = ry >= rx;
    const eGov = yGoverns ? eYm : eXm;
    const dimGov = yGoverns ? lengthM : widthM;
    const perp = yGoverns ? widthM : lengthM;
    const eSec = yGoverns ? eXm : eYm;
    const dimSec = yGoverns ? widthM : lengthM;
    const uni = partialContactPMax(axialKn, perp, dimGov, eGov) * (1 + (6 * eSec) / dimSec);
    pMax = Math.max(pMax, uni);
  }
  return {
    pMaxKpa: pMax,
    pMinKpa: 0,
    eccentricityXMm: eXm / MM_TO_M,
    eccentricityYMm: eYm / MM_TO_M,
    upliftsBase: true,
  };
}

/**
 * Έλεγχος έδρασης εδάφους (EC7) — κατανομή πίεσης (SLS) + σύγκριση με σ_allow.
 * Το αξονικό περιλαμβάνει το ίδιο βάρος πεδίλου (μόνιμο, κεντρικό → δεν προσθέτει
 * ροπή αλλά αυξάνει το N → μειώνει την εκκεντρότητα).
 */
export function computeFootingBearing(input: FootingDesignInput): BearingResult {
  const { serviceLoad, footingSelfWeightKn, soilBearingCapacityKpa } = input;
  const axialKn = serviceLoad.axialKn + footingSelfWeightKn;
  const pressure = computeBasePressure(
    axialKn,
    serviceLoad.momentXKnm,
    serviceLoad.momentYKnm,
    input.widthMm,
    input.lengthMm,
  );

  const check: DesignCheck = {
    demand: pressure.pMaxKpa,
    capacity: soilBearingCapacityKpa,
    utilization:
      soilBearingCapacityKpa > 0 ? pressure.pMaxKpa / soilBearingCapacityKpa : pressure.pMaxKpa > 0 ? Number.POSITIVE_INFINITY : 0,
    adequate: pressure.pMaxKpa <= 0 || (soilBearingCapacityKpa > 0 && pressure.pMaxKpa <= soilBearingCapacityKpa),
  };

  return { ...pressure, check };
}
