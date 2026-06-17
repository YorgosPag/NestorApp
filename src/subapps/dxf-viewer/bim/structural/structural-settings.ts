/**
 * Project/building-level structural settings SSoT (ADR-456 — Στατικά, Slice 2b).
 *
 * Στο Revit ο κανονισμός σχεδιασμού είναι **building-wide** ρύθμιση (ένα κτίριο
 * σχεδιάζεται κατά έναν κανονισμό) — ΟΧΙ per-element. Αυτό το module ορίζει το
 * σχήμα της ρύθμισης· persist-άρεται στο `buildings/{buildingId}.structuralSettings`
 * (sibling των ADR-451 `hasFoundation`/`foundationDepth`) μέσω του
 * `structural-settings.service.ts`, και διαβάζεται από το column ribbon UI για
 * auto-suggest + validation.
 *
 * Zero-React / zero-store deps — pure types + resolver, ώστε να το εισάγουν
 * ελεύθερα ο store, το service ΚΑΙ ο validator chain χωρίς κύκλους.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import {
  DEFAULT_STRUCTURAL_CODE,
  isStructuralCodeId,
  type StructuralCodeId,
} from './codes';
import {
  DEFAULT_CONCRETE_GRADE,
  isConcreteGrade,
  type ConcreteGrade,
} from './concrete-grades';
import type { OccupancyCategory } from './loads/occupancy-loads';

// Inline guard — αποφεύγει εξάρτηση σε value import από νέο module (Turbopack isolatedModules).
const OCCUPANCY_CATEGORIES: ReadonlySet<string> = new Set([
  'residential', 'office', 'congregation', 'shopping', 'storage',
]);
function isOccupancyCategory(v: string | undefined): v is OccupancyCategory {
  return typeof v === 'string' && OCCUPANCY_CATEGORIES.has(v);
}

/**
 * Building-level structural settings. Persisted verbatim στο building doc
 * (Revit-style — survives reload, ίδιο για όλους τους ορόφους του κτιρίου).
 */
export interface StructuralSettings {
  /** Ενεργός κανονισμός σχεδιασμού (Ευρωκώδικες / ΕΚΩΣ-ΕΑΚ). */
  readonly codeId: StructuralCodeId;
  /** Προεπιλεγμένη κατηγορία σκυροδέματος για νέα δομικά στοιχεία. */
  readonly defaultConcreteGrade: ConcreteGrade;
  /**
   * ADR-464 — Επιτρεπόμενη τάση έδρασης εδάφους σ_allow (kPa, SLS). Building-level
   * παραδοχή εδαφοτεχνικής μελέτης (Revit: Soil → Allowable bearing pressure)·
   * input για τον έλεγχο έδρασης θεμελίωσης (`footing-bearing`, EC7). Optional:
   * absent → δεν έχει οριστεί έδαφος → ο bearing check παραμένει αδρανής (advisory).
   */
  readonly soilBearingCapacityKpa?: number;
  /**
   * ADR-464 Slice 4 — Μόνιμο κατανεμημένο φορτίο ορόφου G (kPa, χαρακτηριστικό):
   * ίδιο βάρος πλάκας + επικαλύψεις + μόνιμες δράσεις ανά m². Building-level παραδοχή
   * (Revit: Structural Loads → area load) — input για το tributary load takedown
   * (`load-takedown`). Optional: absent → ο takedown παραμένει αδρανής (advisory).
   */
  readonly deadAreaLoadKpa?: number;
  /**
   * ADR-464 Slice 4 — Μεταβλητό (ωφέλιμο) κατανεμημένο φορτίο ορόφου Q (kPa,
   * χαρακτηριστικό) ανά χρήση (EN1991-1-1). Building-level παραδοχή· input για το
   * tributary takedown. Optional: absent → auto από `occupancy` (ADR-474).
   */
  readonly liveAreaLoadKpa?: number;
  /**
   * ADR-474 — Κατηγορία χρήσης κτιρίου (EN1991-1-1). Οδηγεί τα **αυτόματα** area
   * loads όταν δεν υπάρχουν ρητά kPa: q_k από την κατηγορία, g_k από τη γεωμετρία
   * πλάκας. Optional: absent → {@link DEFAULT_OCCUPANCY} (κατοικία· πλήρης
   * αυτοματισμός χωρίς επιλογή). Ρητά kPa πάντα υπερισχύουν (Revit-grade override).
   */
  readonly occupancy?: OccupancyCategory;
}

/** Default settings όταν δεν έχει οριστεί τίποτα (standalone DXF χωρίς building). */
export const DEFAULT_STRUCTURAL_SETTINGS: StructuralSettings = {
  codeId: DEFAULT_STRUCTURAL_CODE,
  defaultConcreteGrade: DEFAULT_CONCRETE_GRADE,
};

/** True όταν μια τιμή είναι έγκυρη πεπερασμένη θετική (kPa) — σ_allow & area loads. */
export function isValidPositiveKpa(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Κανονικοποίησε raw (πιθανώς μερικά / legacy) building settings σε πλήρες
 * έγκυρο `StructuralSettings` — άγνωστες/απούσες τιμές πέφτουν στα defaults. Τα
 * optional kPa πεδία (σ_allow / area loads) παραμένουν **απόντα** όταν είναι μη-
 * έγκυρα/absent (ΟΧΙ explicit `undefined`) — ώστε το persist να μη σπάει το
 * Firestore (ADR-390 Φ4).
 */
export function resolveStructuralSettings(
  raw: Partial<StructuralSettings> | null | undefined,
): StructuralSettings {
  if (!raw) return DEFAULT_STRUCTURAL_SETTINGS;
  let base: StructuralSettings = {
    codeId: isStructuralCodeId(raw.codeId) ? raw.codeId : DEFAULT_STRUCTURAL_CODE,
    defaultConcreteGrade: isConcreteGrade(raw.defaultConcreteGrade)
      ? raw.defaultConcreteGrade
      : DEFAULT_CONCRETE_GRADE,
  };
  if (isValidPositiveKpa(raw.soilBearingCapacityKpa)) {
    base = { ...base, soilBearingCapacityKpa: raw.soilBearingCapacityKpa };
  }
  if (isValidPositiveKpa(raw.deadAreaLoadKpa)) {
    base = { ...base, deadAreaLoadKpa: raw.deadAreaLoadKpa };
  }
  if (isValidPositiveKpa(raw.liveAreaLoadKpa)) {
    base = { ...base, liveAreaLoadKpa: raw.liveAreaLoadKpa };
  }
  if (isOccupancyCategory(raw.occupancy)) {
    base = { ...base, occupancy: raw.occupancy };
  }
  return base;
}
