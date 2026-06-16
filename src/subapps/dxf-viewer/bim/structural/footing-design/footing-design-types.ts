/**
 * Footing design engine — types (ADR-464, Slice 1).
 *
 * Pure data contracts για τον code-driven σχεδιασμό θεμελίωσης. **DERIVED, ΠΟΤΕ
 * persisted** (geometry-is-SSoT — ίδια φιλοσοφία με τις reinforcement ποσότητες):
 * όλα παράγονται on-demand από γεωμετρία + φορτία + έδαφος + υλικά.
 *
 * Slice 1 = `bearing` (έλεγχος έδρασης εδάφους, EC7). Τα `flexure` (Slice 2) και
 * `punching` (Slice 3) προστίθενται στο `FootingDesignResult` καθώς ωριμάζει το
 * engine — additive, μη-breaking.
 *
 * Μονάδες: μήκη mm, φορτία kN/kNm, τάσεις kPa (= kN/m²).
 *
 * @see ./footing-bearing.ts — ο EC7 υπολογισμός έδρασης
 * @see ../loads/structural-loads-types.ts — CombinedLoad (ULS/SLS)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { CombinedLoad } from '../loads/structural-loads-types';

/**
 * Είσοδος σχεδιασμού μεμονωμένου πεδίλου (pad). Ορθογώνιο ίχνος width(X)×length(Y),
 * πάχος thickness· η κολώνα (column W×D) εδράζεται στο κέντρο (η εκκεντρότητα
 * εκφράζεται μέσω των ροπών του φορτίου). `serviceLoad` = SLS (έδραση)· `ulsLoad`
 * = ULS (κάμψη/διάτρηση, Slices 2-3).
 */
export interface FootingDesignInput {
  readonly widthMm: number;
  readonly lengthMm: number;
  readonly thicknessMm: number;
  readonly columnWidthMm: number;
  readonly columnDepthMm: number;
  /** SLS συνδυασμένο φορτίο κολώνας (kN/kNm) — έλεγχος έδρασης. */
  readonly serviceLoad: CombinedLoad;
  /** ULS συνδυασμένο φορτίο (kN/kNm) — κάμψη/διάτρηση (Slices 2-3). */
  readonly ulsLoad: CombinedLoad;
  /** Επιτρεπόμενη τάση έδρασης εδάφους σ_allow (kPa, SLS). */
  readonly soilBearingCapacityKpa: number;
  /** Ίδιο βάρος πεδίλου (kN, μόνιμο) — προστίθεται στο SLS αξονικό για την έδραση. */
  readonly footingSelfWeightKn: number;
}

/**
 * Γενικός έλεγχος επάρκειας: `utilization = demand/capacity` (≤1 → adequate).
 * `demand`/`capacity` σε όποιες μονάδες ταιριάζουν στον έλεγχο (kPa, MPa, …).
 */
export interface DesignCheck {
  readonly demand: number;
  readonly capacity: number;
  readonly utilization: number;
  readonly adequate: boolean;
}

/**
 * Αποτέλεσμα ελέγχου έδρασης εδάφους (EC7). Κατανομή πίεσης κάτω από το πέδιλο
 * υπό αξονικό + διαξονική ροπή· `upliftsBase` όταν η συνισταμένη βγαίνει εκτός
 * του πυρήνα (kern) → μερική αποκόλληση (e>L/6) → απαιτείται άνω σχάρα (Slice 2).
 */
export interface BearingResult {
  /** Μέγιστη πίεση εδάφους p_max (kPa). */
  readonly pMaxKpa: number;
  /** Ελάχιστη πίεση εδάφους p_min (kPa· 0 σε αποκόλληση). */
  readonly pMinKpa: number;
  /** Εκκεντρότητα κατά X (mm) = M_x/N. */
  readonly eccentricityXMm: number;
  /** Εκκεντρότητα κατά Y (mm) = M_y/N. */
  readonly eccentricityYMm: number;
  /** True όταν η συνισταμένη βγαίνει εκτός πυρήνα (μερική αποκόλληση βάσης). */
  readonly upliftsBase: boolean;
  /** p_max vs σ_allow. */
  readonly check: DesignCheck;
}

/** Πλήρες αποτέλεσμα σχεδιασμού πεδίλου (DERIVED). Slice 1 = bearing μόνο. */
export interface FootingDesignResult {
  readonly bearing: BearingResult;
}
