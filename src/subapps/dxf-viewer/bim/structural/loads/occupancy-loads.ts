/**
 * Occupancy-driven auto structural area loads — pure SSoT (ADR-474).
 *
 * Revit-grade «zero-input» φορτία: ο μηχανικός **δεν πληκτρολογεί kPa**. Από την
 * κατηγορία χρήσης (EN1991-1-1) + τη γεωμετρία πλάκας παράγονται αυτόματα τα
 * χαρακτηριστικά κατανεμημένα φορτία ορόφου:
 *
 *   · Ωφέλιμο q_k  → πίνακας EN1991-1-1 Table 6.2 ανά κατηγορία χρήσης.
 *   · Μόνιμο g_k   → ίδιο βάρος πλάκας (t·γ_concrete) + επιστρώσεις + κινητά χωρίσματα.
 *
 * **Override (Revit-grade):** αν ο μηχανικός ορίσει ρητή building-level τιμή kPa
 * (`structural-settings`), αυτή **κερδίζει**· αλλιώς ισχύει το αυτόματο default.
 * Default κατηγορία = κατοικία (cat A) → πλήρης αυτοματισμός χωρίς καμία επιλογή.
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: φορτία kPa (=kN/m²), μήκη mm.
 *
 * @see ./load-takedown.ts — ο καταναλωτής (tributary takedown, TakedownSettings)
 * @see ../structural-settings.ts — building-level explicit kPa + occupancy
 * @see docs/centralized-systems/reference/adrs/ADR-474-occupancy-driven-auto-loads.md
 */

/** Κατηγορία χρήσης χώρου (EN1991-1-1 §6.3.1 — υποσύνολο κύριων κατηγοριών A–E). */
export type OccupancyCategory =
  | 'residential' // Cat A — κατοικίες / οικιακοί χώροι
  | 'office' // Cat B — γραφεία
  | 'congregation' // Cat C — χώροι συνάθροισης
  | 'shopping' // Cat D — εμπορικοί χώροι
  | 'storage'; // Cat E — αποθήκες / βιομηχανικοί χώροι

/** Σειρά εμφάνισης στο UI (default πρώτη). */
export const OCCUPANCY_CATEGORY_ORDER: readonly OccupancyCategory[] = [
  'residential',
  'office',
  'congregation',
  'shopping',
  'storage',
];

/** Default κατηγορία όταν δεν έχει οριστεί — κατοικία (πλήρης αυτοματισμός). */
export const DEFAULT_OCCUPANCY: OccupancyCategory = 'residential';

/**
 * **SSoT** χαρακτηριστικό ωφέλιμο φορτίο q_k (kPa) ανά κατηγορία χρήσης — EN1991-1-1
 * Table 6.2 (συνιστώμενες τιμές· εθνικό παράρτημα μπορεί να διαφοροποιεί — DEFER NA).
 */
export const OCCUPANCY_IMPOSED_KPA: Record<OccupancyCategory, number> = {
  residential: 2.0, // Cat A floors
  office: 3.0, // Cat B
  congregation: 5.0, // Cat C3/C4 (συνάθροιση, conservative)
  shopping: 5.0, // Cat D2
  storage: 7.5, // Cat E1
};

/** Type guard για persisted/UI τιμές. */
export function isOccupancyCategory(v: string | undefined): v is OccupancyCategory {
  return (
    v === 'residential' ||
    v === 'office' ||
    v === 'congregation' ||
    v === 'shopping' ||
    v === 'storage'
  );
}

// ─── Κληρονομικότητα από γενική κατηγορία κτιρίου (full SSoT) ─────────────────

/** Γενική κατηγορία κτιρίου (project-level `Building.category`) — η δηλωμένη χρήση. */
export type BuildingCategory = 'residential' | 'commercial' | 'mixed' | 'industrial';

/**
 * **SSoT** αντιστοίχιση γενικής κατηγορίας κτιρίου → structural occupancy (EN1991-1-1).
 * Το `Building.category` είναι το ΕΝΑ «τι κτίριο είναι» — η structural occupancy
 * **κληρονομεί** από εκεί (μηδέν διπλότυπο), με προαιρετικό per-building override μέσω
 * `structuralSettings.occupancy`. Default τιμές (ο μηχανικός υπερβαίνει αν διαφέρει):
 *   residential→A(2.0)· commercial→D εμπορικό(5.0, conservative)· mixed→B μέση(3.0)·
 *   industrial→E αποθήκη(7.5).
 */
const OCCUPANCY_BY_BUILDING_CATEGORY: Record<BuildingCategory, OccupancyCategory> = {
  residential: 'residential',
  commercial: 'shopping',
  mixed: 'office',
  industrial: 'storage',
};

function isBuildingCategory(v: string | undefined): v is BuildingCategory {
  return v === 'residential' || v === 'commercial' || v === 'mixed' || v === 'industrial';
}

/**
 * ADR-474 — structural occupancy ΑΠΟ τη γενική κατηγορία κτιρίου (SSoT inheritance).
 * Άγνωστη/absent → `undefined` (ο caller πέφτει στο `structuralSettings.occupancy`
 * override ή στο {@link DEFAULT_OCCUPANCY}). Μηδέν διπλασιασμός της «χρήσης κτιρίου».
 */
export function resolveOccupancyFromBuildingCategory(
  category: string | undefined,
): OccupancyCategory | undefined {
  return isBuildingCategory(category) ? OCCUPANCY_BY_BUILDING_CATEGORY[category] : undefined;
}

// ─── Μόνιμο φορτίο g_k (auto από γεωμετρία πλάκας) ────────────────────────────

/** kN/m³ — ίδιο βάρος οπλισμένου σκυροδέματος (EN1991-1-1 Table A.1). */
const CONCRETE_UNIT_WEIGHT_KN_M3 = 25;

/** mm — αντιπροσωπευτικό πάχος πλάκας όταν λείπει ρητή τιμή. */
export const DEFAULT_SLAB_THICKNESS_MM = 200;

/** kPa — επιστρώσεις / δάπεδα (τυπική μόνιμη πρόσθετη δράση). */
const FINISHES_ALLOWANCE_KPA = 1.5;

/** kPa — κινητά χωρίσματα ως ομοιόμορφη δράση (EN1991-1-1 §6.3.1.2, ≤2 kN/m). */
const PARTITIONS_ALLOWANCE_KPA = 1.0;

/** True όταν μια kPa τιμή είναι έγκυρη πεπερασμένη θετική (explicit override). */
function isPositiveKpa(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * ADR-474 — αυτόματο μόνιμο φορτίο ορόφου g_k (kPa) = ίδιο βάρος πλάκας
 * (t·γ_concrete) + επιστρώσεις + κινητά χωρίσματα. `slabThicknessMm` absent/≤0 ⇒
 * {@link DEFAULT_SLAB_THICKNESS_MM}.
 */
export function resolveDefaultDeadLoadKpa(slabThicknessMm?: number): number {
  const tMm = isPositiveKpa(slabThicknessMm) ? slabThicknessMm : DEFAULT_SLAB_THICKNESS_MM;
  const slabSelfWeightKpa = (tMm / 1000) * CONCRETE_UNIT_WEIGHT_KN_M3;
  return slabSelfWeightKpa + FINISHES_ALLOWANCE_KPA + PARTITIONS_ALLOWANCE_KPA;
}

/** ADR-474 — αυτόματο ωφέλιμο φορτίο q_k (kPa) από την κατηγορία χρήσης. */
export function resolveImposedLoadKpa(occupancy?: OccupancyCategory): number {
  return OCCUPANCY_IMPOSED_KPA[occupancy ?? DEFAULT_OCCUPANCY];
}

// ─── Effective resolver (explicit-wins, αλλιώς auto) ─────────────────────────

/** Είσοδος επίλυσης ενεργών area loads — explicit building τιμές + auto παράγοντες. */
export interface EffectiveAreaLoadInput {
  /** Ρητό building-level μόνιμο G (kPa) — override· absent ⇒ auto από πλάκα. */
  readonly explicitDeadKpa?: number;
  /** Ρητό building-level ωφέλιμο Q (kPa) — override· absent ⇒ auto από occupancy. */
  readonly explicitLiveKpa?: number;
  /** Κατηγορία χρήσης (auto q_k). Absent ⇒ {@link DEFAULT_OCCUPANCY}. */
  readonly occupancy?: OccupancyCategory;
  /** Αντιπροσωπευτικό πάχος πλάκας (auto g_k). Absent ⇒ default. */
  readonly slabThicknessMm?: number;
}

/** Ενεργά κατανεμημένα φορτία ορόφου (kPa) έτοιμα για takedown. */
export interface EffectiveAreaLoads {
  readonly deadAreaLoadKpa: number;
  readonly liveAreaLoadKpa: number;
}

/**
 * ADR-474 — **ΕΝΑ SSoT** επίλυσης ενεργών area loads (μοιράζεται από ΟΛΟΥΣ τους
 * takedown triggers — proactive + ribbon — μηδέν διπλότυπο `?? 0`). Revit-grade
 * override: ρητή building-level kPa **κερδίζει**· αλλιώς αυτόματο default από
 * occupancy (q_k) + γεωμετρία πλάκας (g_k). Μηδέν input μηχανικού στο default path.
 */
export function resolveEffectiveAreaLoads(input: EffectiveAreaLoadInput): EffectiveAreaLoads {
  return {
    deadAreaLoadKpa: isPositiveKpa(input.explicitDeadKpa)
      ? input.explicitDeadKpa
      : resolveDefaultDeadLoadKpa(input.slabThicknessMm),
    liveAreaLoadKpa: isPositiveKpa(input.explicitLiveKpa)
      ? input.explicitLiveKpa
      : resolveImposedLoadKpa(input.occupancy),
  };
}
