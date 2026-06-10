/**
 * ADR-422 L7.9-C — Construction-material thermal properties (ρ/c/λ) SSoT.
 *
 * Ο **αδελφός** του `wall-material-catalog.ts` για το ξεχωριστό vocabulary των
 * σύνθετων **slab / roof** build-ups (`CONSTRUCTION_MATERIAL_IDS` — γενικά
 * `mat-concrete`/`mat-screed`/`mat-insulation`/`mat-tile`/...). Ο wall catalog
 * κλειδώνει σε **graded** presets (`mat-concrete-c25`, `mat-plaster-int`,
 * `mat-xps`) με exact-match → ΔΕΝ resolve-άρει τα γενικά slab ids· γι' αυτό το
 * geometry-derived `κ_m` των πλακών (L7.9-C) χρειάζεται τη δική του πηγή ρ/c/λ.
 *
 * Τιμές: EN ISO 10456 / ΤΟΤΕΕ 20701-2 (αντιπροσωπευτικές, documented/editable).
 * IFC4: `Pset_MaterialCommon.MassDensity` (ρ) + `Pset_MaterialThermal`
 * (`SpecificHeatCapacity` c, `ThermalConductivity` λ).
 *
 * Resolution = **longest-prefix match** (mirror `resolveMaterialKey` στο
 * `material-catalog-defs.ts`) ώστε να δουλεύει ΚΑΙ για γενικά ids (`mat-concrete`)
 * ΚΑΙ για graded παραλλαγές που μπορεί να φέρει ένα library layer
 * (`mat-concrete-c25` → `mat-concrete`). Άγνωστο / custom id ⇒ `undefined`
 * (ο caller το παραλείπει — μηδέν συνεισφορά μάζας, mirror του wall adapter).
 *
 * ΜΟΝΑΔΕΣ: ρ kg/m³, c J/kgK, λ W/mK. Pure lookup — μηδέν state / THREE / I/O.
 *
 * @see ../walls/wall-material-catalog — το graded-preset αδελφό catalog (τοίχοι)
 * @see ../materials/construction-materials — CONSTRUCTION_MATERIAL_IDS vocabulary
 * @see ./heat-load/assembly-heat-capacity — consumer (slabDnaToHeatCapacityLayers)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.9-C)
 */

/** Θερμικές ιδιότητες ενός construction υλικού: ρ (kg/m³) + c (J/kgK) + λ (W/mK). */
export interface ConstructionMaterialThermal {
  /** Πυκνότητα ρ (kg/m³). */
  readonly density: number;
  /** Ειδική θερμοχωρητικότητα c (J/kgK). */
  readonly specificHeat: number;
  /** Θερμική αγωγιμότητα λ (W/mK) — για το insulation-stop του `κ_m`. */
  readonly lambda: number;
}

/**
 * ρ/c/λ ανά γενικό construction material key (EN ISO 10456 / ΤΟΤΕΕ 20701-2).
 * Τα κλειδιά είναι τα **prefixes** του `CONSTRUCTION_MATERIAL_IDS` — η resolution
 * γίνεται με longest-prefix match, οπότε graded παραλλαγές (π.χ. `mat-concrete-c25`)
 * πέφτουν στον γενικό πρόγονο (`mat-concrete`).
 */
export const CONSTRUCTION_MATERIAL_THERMAL: Readonly<Record<string, ConstructionMaterialThermal>> = {
  // Φέρον σκυρόδεμα (γενικό RC — ο γενικός πρόγονος των graded mat-concrete-c*).
  'mat-concrete':  { density: 2400, specificHeat: 840, lambda: 2.0 },
  // Τσιμεντοκονία / γαρμπιλομπετόν δαπέδου.
  'mat-screed':    { density: 2000, specificHeat: 1000, lambda: 1.4 },
  // Θερμο/ηχομονωτικό (XPS/EPS/ορυκτοβάμβακας) — λ ≤ insulation-stop threshold.
  'mat-insulation': { density: 35, specificHeat: 1450, lambda: 0.035 },
  // Κεραμικό πλακίδιο δαπέδου.
  'mat-tile':      { density: 2000, specificHeat: 840, lambda: 1.3 },
  // Κεραμίδι στέγης (clay roof tile).
  'mat-roof-tile': { density: 2000, specificHeat: 800, lambda: 1.0 },
  // Επίχρισμα / σοβάς (γύψος-ασβέστης).
  'mat-plaster':   { density: 1200, specificHeat: 1000, lambda: 0.70 },
  // Στεγανωτική / φράγμα υδρατμών μεμβράνη (ασφαλτική/PVC φύλλο).
  'mat-membrane':  { density: 1100, specificHeat: 1000, lambda: 0.23 },
  // Έρμα χαλικιού / προστατευτικό αδρανές δώματος.
  'mat-gravel':    { density: 1800, specificHeat: 910, lambda: 2.0 },
  // Γενικό τελείωμα δαπέδου (όταν δεν είναι κεραμικό).
  'mat-finish':    { density: 1500, specificHeat: 1000, lambda: 0.50 },
  // Ξύλο (μασίφ / σύνθετο).
  'mat-wood':      { density: 500, specificHeat: 1600, lambda: 0.13 },
  // Μέταλλο (χάλυβας).
  'mat-metal':     { density: 7800, specificHeat: 450, lambda: 50 },
};

/** Ταξινομημένα κλειδιά κατά φθίνον μήκος — longest-prefix-wins resolution. */
const THERMAL_KEYS_BY_LENGTH: readonly string[] = Object.keys(CONSTRUCTION_MATERIAL_THERMAL).sort(
  (a, b) => b.length - a.length,
);

/**
 * Θερμικές ιδιότητες ενός construction materialId με longest-prefix match, ή
 * `undefined` αν δεν αντιστοιχεί σε γνωστό υλικό (custom / άγνωστο → ο caller
 * πέφτει σε fallback / παράλειψη). Mirror `resolveMaterialKey`.
 */
export function getConstructionMaterialThermal(
  materialId: string | undefined,
): ConstructionMaterialThermal | undefined {
  if (!materialId) return undefined;
  for (const key of THERMAL_KEYS_BY_LENGTH) {
    if (materialId.startsWith(key)) return CONSTRUCTION_MATERIAL_THERMAL[key];
  }
  return undefined;
}
