/**
 * Floor Naming SSoT (ADR-369 §9 Q9) — Phase A1
 *
 * Auto-generation `Floor.name` (short) + `Floor.longName` (Greek canonical)
 * για όλα τα floor kinds.
 *
 * Storage convention (ADR-369 §9 Q9 + user decision 2026-05-20):
 *   - `Floor.longName` αποθηκεύεται **πάντα ως Ελληνικό canonical** στη Firestore
 *     (π.χ. "1ος Όροφος", "Ισόγειο", "Υπόγειο").
 *   - English rendering για την UI παράγεται at render time μέσω
 *     {@link import('@/lib/intl-domain').formatFloorLabel}.
 *
 * Mezzanine convention (ADR-369 §9 Q6 + user decision 2026-05-20):
 *   - `Floor.number` παραμένει `z.number().int()` ακέραιος.
 *   - Μεσοπάτωμα = ξεχωριστό `kind: 'mezzanine'` + `mezzanineParentNumber` field
 *     στον Floor (δείχνει σε ποιον γονικό όροφο ανήκει).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q6, Q9
 */

// ─── Floor kind taxonomy ─────────────────────────────────────────────────────

export type FloorKind =
  | 'foundation'
  | 'basement'
  | 'ground'
  | 'standard'
  | 'roof'
  | 'mezzanine'
  // ADR-461 — απόληξη κλιμακοστασίου (κλειστός χώρος πάνω από το δώμα: stair head /
  // μηχανοστάσιο). Special level (Revit «Building Story» OFF), διακριτό από 'roof'.
  | 'stair-penthouse';

export const FLOOR_KIND_VALUES: readonly FloorKind[] = [
  'foundation',
  'basement',
  'ground',
  'standard',
  'roof',
  'mezzanine',
  'stair-penthouse',
] as const;

export function isFloorKind(value: unknown): value is FloorKind {
  return typeof value === 'string' && (FLOOR_KIND_VALUES as readonly string[]).includes(value);
}

// ─── Special levels SSoT (ADR-461 — Revit «Building Story» OFF) ───────────────

/**
 * Στάθμες που ΔΕΝ μετρώνται ως όροφοι («Όροφοι: N»): θεμελίωση, δώμα, απόληξη
 * κλιμακοστασίου. Έχουν δικό τους DXF Level (σχεδιάσιμες) αλλά είναι εκτός count.
 */
export const SPECIAL_LEVEL_KINDS: readonly FloorKind[] = [
  'foundation',
  'roof',
  'stair-penthouse',
] as const;

/**
 * True όταν ο όροφος αυτού του είδους μετράει ως «Building Story» (counted storey).
 * Special levels (foundation/roof/stair-penthouse) → false. SSoT για το «Όροφοι: N».
 */
export function isBuildingStorey(kind: FloorKind): boolean {
  return !(SPECIAL_LEVEL_KINDS as readonly string[]).includes(kind);
}

/**
 * Μετράει μόνο τους counted storeys μιας λίστας ορόφων (special levels εξαιρούνται).
 * Floors χωρίς `kind` (legacy) θεωρούνται storeys (back-compat). SSoT για «Όροφοι: N».
 */
export function countBuildingStoreys(floors: ReadonlyArray<{ kind?: FloorKind }>): number {
  return floors.reduce((n, f) => (f.kind === undefined || isBuildingStorey(f.kind) ? n + 1 : n), 0);
}

// ─── Short name (locale-independent — engineering code) ──────────────────────

/**
 * Παράγει short engineering code για floor (locale-independent).
 *   foundation → "F"
 *   roof       → "R"
 *   ground     → "GF"
 *   basement   → "B1", "B2", "B3", ... (|number| or 1 αν number=0)
 *   mezzanine  → "M1", "M2", ... (number or 1 αν number=0)
 *   standard   → "L1", "L2", ... (number)
 */
export function generateAutoShortName(kind: FloorKind, number: number): string {
  switch (kind) {
    case 'foundation':
      return 'F';
    case 'roof':
      return 'R';
    case 'ground':
      return 'GF';
    case 'basement': {
      const level = Math.abs(number) || 1;
      return `B${level}`;
    }
    case 'mezzanine': {
      const idx = Math.abs(number) || 1;
      return `M${idx}`;
    }
    case 'standard':
      return `L${number}`;
    case 'stair-penthouse':
      return 'SP';
  }
}

// ─── Long name (Greek canonical) ─────────────────────────────────────────────

/**
 * Παράγει Greek canonical long name για floor.
 * Αποθηκεύεται as-is στη Firestore (`Floor.longName`).
 *
 *   foundation → "Θεμελίωση"
 *   roof       → "Δώμα"
 *   ground     → "Ισόγειο"
 *   basement   → "Υπόγειο" (|n|=1) | "{n}ο Υπόγειο" (|n|>1)
 *   mezzanine  → "Μεσοπάτωμα" (1) | "{n}ο Μεσοπάτωμα" (n>1)
 *   standard   → "{n}ος Όροφος"
 */
export function generateAutoLongName(kind: FloorKind, number: number): string {
  switch (kind) {
    case 'foundation':
      return 'Θεμελίωση';
    case 'roof':
      return 'Δώμα';
    case 'ground':
      return 'Ισόγειο';
    case 'basement': {
      const level = Math.abs(number) || 1;
      return level === 1 ? 'Υπόγειο' : `${level}ο Υπόγειο`;
    }
    case 'mezzanine': {
      const idx = Math.abs(number) || 1;
      return idx === 1 ? 'Μεσοπάτωμα' : `${idx}ο Μεσοπάτωμα`;
    }
    case 'standard':
      return `${number}ος Όροφος`;
    case 'stair-penthouse':
      return 'Απόληξη Κλιμακοστασίου';
  }
}

// ─── Kind inference (Revit-style auto-classification) ────────────────────────

/**
 * Εξάγει το πιο πιθανό `kind` από τον αριθμό του ορόφου.
 *   number === 0  → 'ground'
 *   number  >  0  → 'standard'
 *   number  <  0  → 'basement'
 *
 * Σημείωση: 'foundation' / 'roof' / 'mezzanine' / 'stair-penthouse' είναι
 * user-explicit kinds — δεν προκύπτουν από το νούμερο. Ο caller τα ορίζει ρητά.
 */
export function inferKindFromNumber(number: number): FloorKind {
  if (number === 0) return 'ground';
  if (number < 0) return 'basement';
  return 'standard';
}

// ─── Defaults (ADR-369 §9 Q4 — FFL Hybrid A) ─────────────────────────────────

/** Default storey height (METRES). Greek residential standard. */
export const DEFAULT_FLOOR_HEIGHT_M = 3.0;

/**
 * Default finish thickness (MILLIMETRES) — από FFL προς Top-of-Structural-Slab.
 * Greek typical: 80mm (συνήθως 20mm μάρμαρο + 60mm γαρμπιλομπετόν ή equivalent).
 * Used για auto-derive ToS dimensions στα construction drawings + BOQ.
 */
export const DEFAULT_FLOOR_FINISH_THICKNESS_MM = 80;
