/**
 * torsion-capacity — SSoT στρεπτικής αντοχής ορθογώνιας RC διατομής (ADR-499 §C v1,
 * EC2 §6.3.2). Η **βασική** πύλη: η μέγιστη στρεπτική ροπή που μπορεί να παραλάβει η
 * διατομή πριν συνθλιβεί ο λοξός θλιπτήρας σκυροδέματος (`T_Rd,max`). Όταν `T_Ed > T_Rd,max`
 * **καμία ποσότητα συνδετήρων δεν αρκεί** — απαιτείται μεγαλύτερη διατομή ή αλλαγή
 * σχεδιασμού (→ diagnostic, Slice D).
 *
 * **Μοντέλο (EC2 §6.3.2):** η συμπαγής διατομή ανάγεται σε ισοδύναμο **λεπτότοιχο σωλήνα**:
 *   · `t_ef = A/u` (πάχος τοιχώματος· A = μικτό εμβαδό, u = περίμετρος)
 *   · `A_k = (b − t_ef)(h − t_ef)` (εμβαδό εντός της κεντρικής γραμμής του τοιχώματος)
 *   · `T_Rd,max = 2·ν·α_cw·f_cd·A_k·t_ef·sinθ·cosθ`· με `cotθ=1` (θ=45°) ⇒ `sinθcosθ=0.5`,
 *     `α_cw=1`, `ν=ν₁≈0.6` ⇒ **`T_Rd,max = 0.6·f_cd·A_k·t_ef`**.
 *
 * **Scope v1 (βασικό):** μόνο ο θλιπτήρας `T_Rd,max` (ορθογώνια διατομή). **DEFER (πλήρες
 * §6.3, νέα συνεδρία):** στρεπτικοί συνδετήρες `A_st/s`, διαμήκης στρεπτικός χάλυβας,
 * αλληλεπίδραση διάτμησης-στρέψης `T_Ed/T_Rd,max + V_Ed/V_Rd,max ≤ 1`, μη-ορθογώνιες.
 *
 * Pure — zero React/DOM/Firestore. Είσοδος mm + MPa· έξοδος kNm.
 *
 * @see ./suggest-reinforcement.ts — VRD_MAX (ο αδελφός θλιπτήρας διάτμησης, ίδιο ν₁)
 * @see ../loads/beam-torsion.ts — `computeBeamDesignTorsion` (το demand `T_Ed`)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

/** Συντελεστής μείωσης αντοχής ρηγματωμένου σκυροδέματος ν₁ (EC2 §6.2.3(3)· ίδιο με V_Rd,max). */
const TORSION_NU1 = 0.6;

/** sinθ·cosθ με cotθ=1 (θ=45°, συντηρητικό) = 0.5. */
const TORSION_STRUT_FACTOR = 0.5;

const NMM_TO_KNM = 1e6;

/**
 * Ιδιότητες του ισοδύναμου **λεπτότοιχου σωλήνα** (EC2 §6.3.2(1)) στον οποίο ανάγεται η
 * συμπαγής ορθογώνια διατομή `b×h` (mm) για τον σχεδιασμό σε στρέψη:
 *   · `t_ef = A/u` — πάχος τοιχώματος (μικτό εμβαδό / περίμετρος).
 *   · `A_k = (b − t_ef)(h − t_ef)` — εμβαδό εντός της κεντρικής γραμμής του τοιχώματος.
 *   · `u_k = 2((b − t_ef) + (h − t_ef))` — περίμετρος της κεντρικής γραμμής.
 * **ΕΝΑ SSoT** που μοιράζονται: `T_Rd,max` (θλιπτήρας, εδώ), `A_st/s` στρεπτικοί συνδετήρες
 * και `A_sl` διαμήκης στρεπτικός χάλυβας (§6.3-c). `null` σε εκφυλισμένη/εκφυλισμένο τοίχωμα.
 */
export interface TorsionTubeProperties {
  /** Ενεργό πάχος τοιχώματος t_ef (mm). */
  readonly tEfMm: number;
  /** Εμβαδό εντός κεντρικής γραμμής A_k (mm²). */
  readonly akMm2: number;
  /** Περίμετρος κεντρικής γραμμής u_k (mm). */
  readonly ukMm: number;
}

export function torsionTubeProperties(widthMm: number, depthMm: number): TorsionTubeProperties | null {
  if (widthMm <= 0 || depthMm <= 0) return null;
  const grossAreaMm2 = widthMm * depthMm;
  const perimeterMm = 2 * (widthMm + depthMm);
  const tEfMm = grossAreaMm2 / perimeterMm; // EC2 §6.3.2(1): t_ef = A/u
  const innerWidthMm = widthMm - tEfMm;
  const innerDepthMm = depthMm - tEfMm;
  const akMm2 = innerWidthMm * innerDepthMm; // εμβαδό εντός κεντρικής γραμμής τοιχώματος
  if (akMm2 <= 0) return null;
  const ukMm = 2 * (innerWidthMm + innerDepthMm); // περίμετρος κεντρικής γραμμής
  return { tEfMm, akMm2, ukMm };
}

/**
 * Μέγιστη στρεπτική αντοχή `T_Rd,max` (kNm) ορθογώνιας διατομής `b×h` (mm) σε σκυρόδεμα
 * με `f_cd` (MPa = N/mm²). `0` για εκφυλισμένη διατομή ή όταν το ισοδύναμο τοίχωμα
 * καταναλώνει όλη τη διατομή (`A_k ≤ 0`). Καθαρά γεωμετρικό-υλικό όριο (steel-independent).
 */
export function plasticTorsionalResistanceKnm(widthMm: number, depthMm: number, fcdMpa: number): number {
  if (fcdMpa <= 0) return 0;
  const tube = torsionTubeProperties(widthMm, depthMm);
  if (!tube) return 0;
  // T_Rd,max = 2·ν·α_cw·f_cd·A_k·t_ef·sinθcosθ ⇒ (α_cw=1) = 2·ν·0.5·f_cd·A_k·t_ef.
  const tRdMaxNmm = 2 * TORSION_NU1 * TORSION_STRUT_FACTOR * fcdMpa * tube.akMm2 * tube.tEfMm;
  return tRdMaxNmm / NMM_TO_KNM;
}

/**
 * Λόγος εκμετάλλευσης αλληλεπίδρασης **διάτμησης-στρέψης** (EC2 §6.3.2(4)): για συμπαγείς
 * διατομές αρκεί `T_Ed/T_Rd,max + V_Ed/V_Rd,max ≤ 1` ώστε να μη συνθλιβεί ο λοξός θλιπτήρας
 * σκυροδέματος. Επιστρέφει το άθροισμα των δύο λόγων (≤ 1 ⇒ επαρκής διατομή). Μη-θετικές
 * αντοχές ⇒ `Infinity` (ανέφικτο) ώστε ο auto-sizer (§6.3-b) να συνεχίσει να μεγαλώνει.
 */
export function shearTorsionUtilization(
  tEdKnm: number,
  tRdMaxKnm: number,
  vEdKn: number,
  vRdMaxKn: number,
): number {
  if (tRdMaxKnm <= 0 || vRdMaxKn <= 0) return Infinity;
  return tEdKnm / tRdMaxKnm + vEdKn / vRdMaxKn;
}
