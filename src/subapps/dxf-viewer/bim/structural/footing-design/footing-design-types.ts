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
  /** Ονομαστική επικάλυψη cnom (mm) — για το ενεργό βάθος d της κάμψης (Slice 2). */
  readonly coverMm: number;
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
 * Κατανομή πίεσης εδάφους κάτω από ορθογώνιο πέδιλο υπό αξονικό + διαξονική ροπή
 * (ευθύγραμμη, rigid-footing). ΕΝΑ SSoT — το μοιράζονται ο έλεγχος έδρασης (SLS) και
 * η κάμψη (ULS), ώστε η λογική κατανομής να μη διπλασιάζεται (N.0.2). `upliftsBase`
 * = η συνισταμένη βγαίνει εκτός πυρήνα (kern) → μερική αποκόλληση (e>dim/6).
 */
export interface BasePressure {
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
}

/**
 * Αποτέλεσμα ελέγχου έδρασης εδάφους (EC7) — η κατανομή πίεσης (SLS) + σύγκριση με
 * σ_allow. Όταν `upliftsBase` (e>L/6) → μερική αποκόλληση → απαιτείται άνω σχάρα
 * (Slice 2 — βλ. {@link FlexureResult.hoggingGoverns}).
 */
export interface BearingResult extends BasePressure {
  /** p_max vs σ_allow. */
  readonly check: DesignCheck;
}

/**
 * Αποτέλεσμα ελέγχου κάμψης πεδίλου (EC2 §9.8.2, ULS). Η ανοδική πίεση εδάφους
 * προκαλεί πρόβολο που κάμπτει το πέδιλο στην παρειά της κολώνας → απαιτούμενος
 * **κάτω** οπλισμός (sagging) ανά διεύθυνση. Σε αποκόλληση/εκκεντρότητα (e>kern)
 * εμφανίζεται αντιστροφή → απαιτείται **άνω** σχάρα (hogging). As ανά μέτρο πλάτους.
 */
export interface FlexureResult {
  /** Απαιτούμενος κάτω οπλισμός, ράβδοι // X (mm²/m). */
  readonly asBottomXMm2PerM: number;
  /** Απαιτούμενος κάτω οπλισμός, ράβδοι // Y (mm²/m). */
  readonly asBottomYMm2PerM: number;
  /** Απαιτούμενος άνω (hogging) οπλισμός (mm²/m· 0 όταν δεν κυριαρχεί). */
  readonly asTopMm2PerM: number;
  /** True όταν απαιτείται άνω σχάρα (έκκεντρο/αποκόλληση, ULS). */
  readonly hoggingGoverns: boolean;
  /** ULS εκκεντρότητα / πλάτος κατά X (αδιάστατο). */
  readonly eccentricityRatioX: number;
  /** ULS εκκεντρότητα / μήκος κατά Y (αδιάστατο). */
  readonly eccentricityRatioY: number;
}

/** Πλήρες αποτέλεσμα σχεδιασμού πεδίλου (DERIVED). Slices 1-2 = bearing + flexure. */
export interface FootingDesignResult {
  readonly bearing: BearingResult;
  readonly flexure: FlexureResult;
}
