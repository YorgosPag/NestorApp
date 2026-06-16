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

import type { BearingResult, DesignCheck, FootingDesignInput } from './footing-design-types';

const MM_TO_M = 1 / 1000;
/** Όριο πυρήνα (kern) — e/dim πέραν του οποίου εμφανίζεται αποκόλληση. */
const KERN_RATIO = 1 / 6;

/** Μηδενική (no-demand) έδραση όταν δεν υπάρχει καθαρό θλιπτικό φορτίο. */
function zeroBearing(soilCapacityKpa: number): BearingResult {
  return {
    pMaxKpa: 0,
    pMinKpa: 0,
    eccentricityXMm: 0,
    eccentricityYMm: 0,
    upliftsBase: false,
    check: { demand: 0, capacity: soilCapacityKpa, utilization: 0, adequate: true },
  };
}

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
 * Έλεγχος έδρασης εδάφους (EC7) — επιστρέφει κατανομή πίεσης + σύγκριση με σ_allow.
 * Το αξονικό περιλαμβάνει το ίδιο βάρος πεδίλου (μόνιμο, κεντρικό → δεν προσθέτει
 * ροπή αλλά αυξάνει το N → μειώνει την εκκεντρότητα).
 */
export function computeFootingBearing(input: FootingDesignInput): BearingResult {
  const { serviceLoad, footingSelfWeightKn, soilBearingCapacityKpa } = input;
  const axialKn = serviceLoad.axialKn + footingSelfWeightKn;
  if (axialKn <= 0) return zeroBearing(soilBearingCapacityKpa);

  const widthM = input.widthMm * MM_TO_M;
  const lengthM = input.lengthMm * MM_TO_M;
  const areaM2 = widthM * lengthM;
  if (areaM2 <= 0) return zeroBearing(soilBearingCapacityKpa);

  const avgKpa = axialKn / areaM2;
  const eXm = Math.abs(serviceLoad.momentXKnm) / axialKn;
  const eYm = Math.abs(serviceLoad.momentYKnm) / axialKn;
  const kx = (6 * eXm) / widthM;
  const ky = (6 * eYm) / lengthM;
  const bracket = kx + ky;

  let pMaxKpa: number;
  let pMinKpa: number;
  let uplifts: boolean;
  if (bracket <= 1) {
    pMaxKpa = avgKpa * (1 + bracket);
    pMinKpa = avgKpa * (1 - bracket);
    uplifts = false;
  } else {
    uplifts = true;
    pMinKpa = 0;
    // Συντηρητική βάση (ελαστική, αγνοεί την αποκόλληση).
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
    pMaxKpa = pMax;
  }

  const check: DesignCheck = {
    demand: pMaxKpa,
    capacity: soilBearingCapacityKpa,
    utilization: soilBearingCapacityKpa > 0 ? pMaxKpa / soilBearingCapacityKpa : Number.POSITIVE_INFINITY,
    adequate: soilBearingCapacityKpa > 0 && pMaxKpa <= soilBearingCapacityKpa,
  };

  return {
    pMaxKpa,
    pMinKpa,
    eccentricityXMm: eXm / MM_TO_M,
    eccentricityYMm: eYm / MM_TO_M,
    upliftsBase: uplifts,
    check,
  };
}
