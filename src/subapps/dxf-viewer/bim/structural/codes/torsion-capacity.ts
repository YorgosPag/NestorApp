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
 * Μέγιστη στρεπτική αντοχή `T_Rd,max` (kNm) ορθογώνιας διατομής `b×h` (mm) σε σκυρόδεμα
 * με `f_cd` (MPa = N/mm²). `0` για εκφυλισμένη διατομή ή όταν το ισοδύναμο τοίχωμα
 * καταναλώνει όλη τη διατομή (`A_k ≤ 0`). Καθαρά γεωμετρικό-υλικό όριο (steel-independent).
 */
export function plasticTorsionalResistanceKnm(widthMm: number, depthMm: number, fcdMpa: number): number {
  if (widthMm <= 0 || depthMm <= 0 || fcdMpa <= 0) return 0;
  const grossAreaMm2 = widthMm * depthMm;
  const perimeterMm = 2 * (widthMm + depthMm);
  const tEfMm = grossAreaMm2 / perimeterMm; // EC2 §6.3.2(1): t_ef = A/u
  const akMm2 = (widthMm - tEfMm) * (depthMm - tEfMm); // εμβαδό εντός κεντρικής γραμμής τοιχώματος
  if (akMm2 <= 0) return 0;
  // T_Rd,max = 2·ν·α_cw·f_cd·A_k·t_ef·sinθcosθ ⇒ (α_cw=1) = 2·ν·0.5·f_cd·A_k·t_ef.
  const tRdMaxNmm = 2 * TORSION_NU1 * TORSION_STRUT_FACTOR * fcdMpa * akMm2 * tEfMm;
  return tRdMaxNmm / NMM_TO_KNM;
}
