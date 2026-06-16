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
}

/** Default settings όταν δεν έχει οριστεί τίποτα (standalone DXF χωρίς building). */
export const DEFAULT_STRUCTURAL_SETTINGS: StructuralSettings = {
  codeId: DEFAULT_STRUCTURAL_CODE,
  defaultConcreteGrade: DEFAULT_CONCRETE_GRADE,
};

/** True όταν η τιμή σ_allow είναι έγκυρη (πεπερασμένη θετική kPa). */
function isValidBearingCapacityKpa(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Κανονικοποίησε raw (πιθανώς μερικά / legacy) building settings σε πλήρες
 * έγκυρο `StructuralSettings` — άγνωστες/απούσες τιμές πέφτουν στα defaults. Το
 * `soilBearingCapacityKpa` παραμένει **απόν** όταν είναι μη-έγκυρο/absent (ΟΧΙ
 * explicit `undefined`) — ώστε το persist να μη σπάει το Firestore (ADR-390 Φ4).
 */
export function resolveStructuralSettings(
  raw: Partial<StructuralSettings> | null | undefined,
): StructuralSettings {
  if (!raw) return DEFAULT_STRUCTURAL_SETTINGS;
  const base: StructuralSettings = {
    codeId: isStructuralCodeId(raw.codeId) ? raw.codeId : DEFAULT_STRUCTURAL_CODE,
    defaultConcreteGrade: isConcreteGrade(raw.defaultConcreteGrade)
      ? raw.defaultConcreteGrade
      : DEFAULT_CONCRETE_GRADE,
  };
  return isValidBearingCapacityKpa(raw.soilBearingCapacityKpa)
    ? { ...base, soilBearingCapacityKpa: raw.soilBearingCapacityKpa }
    : base;
}
