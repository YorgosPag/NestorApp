/**
 * ADR-422 L1.6 — EN ISO 13370 ground coupling (πλάκα επί εδάφους) — PURE SSoT.
 *
 * Αντικαθιστά τον geometry-blind σταθερό μειωτικό συντελεστή `b≈0.5` του δαπέδου
 * επί εδάφους με ακριβή σύζευξη EN ISO 13370 §9.1/§9.3 (όπως Revit Energy «Ground»,
 * 4M-FineHEAT, ΚΕΝΑΚ/ΤΟΤΕΕ 20701-2). Η απώλεια προς το έδαφος εξαρτάται από τη
 * **γεωμετρία** (λόγος εμβαδού/εκτεθειμένης περιμέτρου — edge effect) και την
 * **αντίσταση** της διάταξης slab+εδάφους:
 *
 *   B′  = A / (0.5 · P)                         [χαρακτηριστική διάσταση, m]
 *   d_t = w + λ_g · (R_si + R_f + R_se)          [ισοδύναμο πάχος, m]
 *   U_g (two-branch, §9.3):
 *     d_t < B′  (αμόνωτο/μέτρια)  → (2·λ_g/(π·B′+d_t)) · ln(π·B′/d_t + 1)
 *     d_t ≥ B′  (καλά μονωμένο)   → λ_g / (0.457·B′ + d_t)
 *
 * Το `U_g` (floor-to-external) **ΕΝΣΩΜΑΤΩΝΕΙ** τη διαδρομή εδάφους → εφαρμόζεται με
 * πλήρες ΔΤ (b=1.0). Μικρό/στενόμακρο δάπεδο → μεγαλύτερο U_g (edge-dominated)·
 * μεγάλο → μικρότερο. Καθαρή αριθμητική — full unit-testable, μηδέν state/geometry.
 *
 * ΣΚΟΠΙΜΩΣ ΕΚΤΟΣ v1 (future): ground walls (υπόγειο), περιμετρική μόνωση edge
 * insulation `ψ_g` (linear), εποχιακή διακύμανση εδάφους (§E), per-soil-type λ catalog.
 *
 * @see ./heat-load-config (λ_g/R_si/w σταθερές) · ./space-boundary-resolver (caller)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1.6)
 */

/** Είσοδος υπολογισμού `U_g` δαπέδου επί εδάφους (όλα σε SI: m, W/m²K, m²K/W). */
export interface GroundFloorCouplingInput {
  /** m² — εμβαδό δαπέδου `A`. */
  readonly areaM2: number;
  /** m — εκτεθειμένη περίμετρος `P` (Σ μηκών εξωτ. τοίχων του χώρου). */
  readonly exposedPerimeterM: number;
  /** W/m²K — U της ίδιας της πλάκας (R_f = 1/U_floor). */
  readonly floorUValueWperM2K: number;
  /** m — αντιπροσωπευτικό πάχος εξωτ. τοίχου `w`. */
  readonly wallThicknessM: number;
  /** W/mK — θερμική αγωγιμότητα εδάφους `λ_g`. */
  readonly soilConductivityWperMK: number;
  /** m²K/W — εσωτερική επιφανειακή αντίσταση δαπέδου `R_si`. */
  readonly internalSurfaceResistanceM2KperW: number;
  /** m²K/W — εξωτερική επιφανειακή αντίσταση `R_se`. */
  readonly externalSurfaceResistanceM2KperW: number;
}

/**
 * Χαρακτηριστική διάσταση `B′ = A / (0.5·P)` (m) — μεγάλο δάπεδο→μεγάλο B′→μικρό U_g.
 * `NaN` αν `A`/`P` μη θετικά (degenerate γεωμετρία — ο orchestrator κάνει fallback).
 */
export function computeCharacteristicDimension(areaM2: number, exposedPerimeterM: number): number {
  if (!(areaM2 > 0) || !(exposedPerimeterM > 0)) return Number.NaN;
  return areaM2 / (0.5 * exposedPerimeterM);
}

/**
 * Ισοδύναμο πάχος `d_t = w + λ_g·(R_si + R_f + R_se)` (m) — καλή μόνωση (μεγάλο R_f)
 * → μεγάλο d_t → μικρό U_g. `R_f` = αντίσταση της ίδιας της πλάκας (= 1/U_floor).
 */
export function computeEquivalentThickness(
  wallThicknessM: number,
  soilConductivityWperMK: number,
  internalSurfaceResistanceM2KperW: number,
  floorResistanceM2KperW: number,
  externalSurfaceResistanceM2KperW: number,
): number {
  return (
    wallThicknessM +
    soilConductivityWperMK *
      (internalSurfaceResistanceM2KperW +
        floorResistanceM2KperW +
        externalSurfaceResistanceM2KperW)
  );
}

/**
 * `U_g` (W/m²K) two-branch EN ISO 13370 §9.3: `d_t<B′` (αμόνωτο/μέτρια μονωμένο) vs
 * `d_t≥B′` (καλά μονωμένο). Το `U_g` ενσωματώνει τη διαδρομή εδάφους → b=1.
 */
export function computeGroundUValue(
  characteristicDimensionM: number,
  equivalentThicknessM: number,
  soilConductivityWperMK: number,
): number {
  const bPrime = characteristicDimensionM;
  const dt = equivalentThicknessM;
  const lambda = soilConductivityWperMK;
  if (dt < bPrime) {
    return ((2 * lambda) / (Math.PI * bPrime + dt)) * Math.log((Math.PI * bPrime) / dt + 1);
  }
  return lambda / (0.457 * bPrime + dt);
}

/**
 * Πλήρες `U_g` δαπέδου επί εδάφους από geometry + αντιστάσεις. Επιστρέφει `null` σε
 * degenerate γεωμετρία (`P≤0`/`A≤0` ⇒ fallback flat `b` στον caller, zero-regression)
 * ή μη έγκυρο αποτέλεσμα. Idempotent.
 */
export function computeGroundFloorUValue(input: GroundFloorCouplingInput): number | null {
  const bPrime = computeCharacteristicDimension(input.areaM2, input.exposedPerimeterM);
  if (!Number.isFinite(bPrime) || bPrime <= 0) return null;
  const floorResistanceM2KperW = input.floorUValueWperM2K > 0 ? 1 / input.floorUValueWperM2K : 0;
  const dt = computeEquivalentThickness(
    input.wallThicknessM,
    input.soilConductivityWperMK,
    input.internalSurfaceResistanceM2KperW,
    floorResistanceM2KperW,
    input.externalSurfaceResistanceM2KperW,
  );
  if (!(dt > 0)) return null;
  const uG = computeGroundUValue(bPrime, dt, input.soilConductivityWperMK);
  return Number.isFinite(uG) && uG > 0 ? uG : null;
}
