/**
 * ADR-396 Phase P8 — Assembly U-value (θερμοπερατότητα) PURE SSoT.
 *
 * Υπολογισμός συντελεστή θερμοπερατότητας `U` (W/m²K) μιας σύνθετης δομικής
 * διάταξης (assembly) από τις στρώσεις της. Steady-state, 1D, κατά ISO 6946:
 *
 *   R_total = Rsi + Σ(dᵢ / λᵢ) + Rse
 *   U       = 1 / R_total
 *
 * όπου `d` = πάχος στρώσης (m), `λ` = θερμική αγωγιμότητα (W/mK), `Rsi`/`Rse` =
 * αντιστάσεις εσωτ./εξωτ. επιφανειακού στρώματος αέρα. ΟΧΙ thermal bridges /
 * ψυχρές γέφυρες (απλοποίηση προμελέτης — parity Revit Insight quick-check).
 *
 * ΜΟΝΑΔΕΣ: meters-in, W/m²K-out. Καμία γεωμετρία / state / persistence εδώ.
 *
 * @see ./kenak-thermal-config (ΚΕΝΑΚ max-U ανά κλιματική ζώνη + reference wall)
 * @see ../walls/wall-material-catalog (λ ανά υλικό — getThermalConductivityLambda)
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.2(b), §7 (P8)
 */

/** Μία θερμική στρώση: πάχος (m) + αγωγιμότητα λ (W/mK). */
export interface ThermalLayer {
  /** Πάχος στρώσης σε ΜΕΤΡΑ. */
  readonly thickness_m: number;
  /** Θερμική αγωγιμότητα λ σε W/mK. */
  readonly lambda: number;
}

/** Επιφανειακές αντιστάσεις (m²K/W) — override για ειδικές περιπτώσεις. */
export interface SurfaceResistances {
  /** Εσωτερική επιφανειακή αντίσταση Rsi (m²K/W). */
  readonly rsi: number;
  /** Εξωτερική επιφανειακή αντίσταση Rse (m²K/W). */
  readonly rse: number;
}

/**
 * ISO 6946 — οριζόντια ροή θερμότητας (κατακόρυφος τοίχος). Default που
 * χρησιμοποιεί ο ΚΕΝΑΚ για εξωτερικούς τοίχους.
 */
export const RSI_WALL_DEFAULT = 0.13 as const;
export const RSE_WALL_DEFAULT = 0.04 as const;

const DEFAULT_SURFACE_RESISTANCES: SurfaceResistances = {
  rsi: RSI_WALL_DEFAULT,
  rse: RSE_WALL_DEFAULT,
};

/**
 * Συνολική θερμική αντίσταση `R_total` (m²K/W) της διάταξης. Degenerate
 * στρώσεις (μη-πεπερασμένο/μη-θετικό πάχος ή λ) αγνοούνται — δεν συνεισφέρουν.
 */
export function computeAssemblyRValue(
  layers: readonly ThermalLayer[],
  surface: SurfaceResistances = DEFAULT_SURFACE_RESISTANCES,
): number {
  const layersR = layers.reduce((sum, layer) => {
    const { thickness_m, lambda } = layer;
    if (!Number.isFinite(thickness_m) || !Number.isFinite(lambda)) return sum;
    if (thickness_m <= 0 || lambda <= 0) return sum;
    return sum + thickness_m / lambda;
  }, 0);
  return surface.rsi + layersR + surface.rse;
}

/**
 * Συντελεστής θερμοπερατότητας `U = 1 / R_total` (W/m²K). Επιστρέφει
 * `Infinity` αν `R_total ≤ 0` (αδύνατο με θετικά Rsi/Rse — defensive).
 */
export function computeAssemblyUValue(
  layers: readonly ThermalLayer[],
  surface: SurfaceResistances = DEFAULT_SURFACE_RESISTANCES,
): number {
  const r = computeAssemblyRValue(layers, surface);
  return r > 0 ? 1 / r : Infinity;
}
