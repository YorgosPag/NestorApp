/**
 * Concrete grades SSoT (ADR-456 — Στατικά / Structural quantities).
 *
 * Single source of truth for concrete strength classes shared by ALL structural
 * BIM entities (columns first, then beams/foundations/slabs). Values follow
 * EN 1992-1-1 (Eurocode 2) Table 3.1 — the same class names are valid under the
 * legacy Greek ΕΚΩΣ workflow (C16/20 ≈ B25 etc.), so a single grade table serves
 * both code providers.
 *
 * Units: strengths σε MPa (= N/mm²), modulus σε GPa, density σε kg/m³.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

/**
 * Concrete strength class (fck/fck,cube). EN 1992-1-1 Table 3.1, normal-weight
 * concrete. The label is also the persisted SSoT value (Revit-style — survives
 * reload, appears verbatim in BOQ/schedule).
 */
export type ConcreteGrade =
  | 'C12/15'
  | 'C16/20'
  | 'C20/25'
  | 'C25/30'
  | 'C30/37'
  | 'C35/45'
  | 'C40/50'
  | 'C45/55'
  | 'C50/60';

/** Material properties per concrete class (EN 1992-1-1 Table 3.1). */
export interface ConcreteGradeProps {
  /** Characteristic cylinder compressive strength fck (MPa). */
  readonly fckMpa: number;
  /** Characteristic cube compressive strength fck,cube (MPa). */
  readonly fckCubeMpa: number;
  /** Secant modulus of elasticity Ecm (GPa). */
  readonly ecmGpa: number;
}

/**
 * EN 1992-1-1 Table 3.1 — fck / fck,cube / Ecm για τις κανονικές κατηγορίες
 * σκυροδέματος που χρησιμοποιούνται σε κτιριακά έργα. Ecm στρογγυλοποιημένο στο
 * πλησιέστερο GPa (Table 3.1 nominal values).
 */
export const CONCRETE_GRADES: Readonly<Record<ConcreteGrade, ConcreteGradeProps>> = {
  'C12/15': { fckMpa: 12, fckCubeMpa: 15, ecmGpa: 27 },
  'C16/20': { fckMpa: 16, fckCubeMpa: 20, ecmGpa: 29 },
  'C20/25': { fckMpa: 20, fckCubeMpa: 25, ecmGpa: 30 },
  'C25/30': { fckMpa: 25, fckCubeMpa: 30, ecmGpa: 31 },
  'C30/37': { fckMpa: 30, fckCubeMpa: 37, ecmGpa: 33 },
  'C35/45': { fckMpa: 35, fckCubeMpa: 45, ecmGpa: 34 },
  'C40/50': { fckMpa: 40, fckCubeMpa: 50, ecmGpa: 35 },
  'C45/55': { fckMpa: 45, fckCubeMpa: 55, ecmGpa: 36 },
  'C50/60': { fckMpa: 50, fckCubeMpa: 60, ecmGpa: 37 },
};

/** Ordered list of grades (weakest → strongest) for UI dropdowns. */
export const CONCRETE_GRADE_ORDER: readonly ConcreteGrade[] = [
  'C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60',
];

/**
 * Default concrete class για νέα δομικά στοιχεία (C25/30 = ο πιο κοινός
 * κτιριακός τύπος στην Ελλάδα μετά τους Ευρωκώδικες).
 */
export const DEFAULT_CONCRETE_GRADE: ConcreteGrade = 'C25/30';

/**
 * Πυκνότητα ΑΟΠΛΟΥ σκυροδέματος (kg/m³). EN 1991-1-1 Annex A: άοπλο = 2400,
 * οπλισμένο = 2500. Χρησιμοποιούμε 2400 για το ΣΚΥΡΟΔΕΜΑ καθαρά, επειδή το βάρος
 * του χάλυβα οπλισμού μετριέται ΞΕΧΩΡΙΣΤΑ (βλ. reinforcement compute) — αλλιώς θα
 * διπλομετρούσαμε τον χάλυβα. Συμβατό με `system-materials-seed.ts` (density 2400).
 */
export const CONCRETE_DENSITY_KGM3 = 2400;

/** Partial safety factor for concrete γc (EN 1992-1-1 §2.4.2.4, persistent/transient). */
export const GAMMA_C = 1.5;

/** Type guard — true όταν το string είναι έγκυρη κατηγορία σκυροδέματος. */
export function isConcreteGrade(value: string | undefined | null): value is ConcreteGrade {
  return value != null && value in CONCRETE_GRADES;
}

/**
 * Βάρος σκυροδέματος (kg) από όγκο (m³). Ο όγκος είναι το `ColumnGeometry.volume`
 * (καθαρός όγκος πυρήνα). Επιστρέφει 0 για μη-θετικό όγκο.
 */
export function concreteWeightKg(volumeM3: number): number {
  if (!Number.isFinite(volumeM3) || volumeM3 <= 0) return 0;
  return volumeM3 * CONCRETE_DENSITY_KGM3;
}

/**
 * Τιμή σχεδιασμού θλιπτικής αντοχής σκυροδέματος fcd = αcc·fck/γc (MPa).
 * αcc=1.0 (Ελληνικό Εθνικό Προσάρτημα EN 1992-1-1). Για μελλοντικό στατικό
 * υπολογισμό (Slice 3+) — δεν χρησιμοποιείται ακόμα στις ποσότητες.
 */
export function concreteFcdMpa(grade: ConcreteGrade, gammaC: number = GAMMA_C): number {
  return CONCRETE_GRADES[grade].fckMpa / gammaC;
}
