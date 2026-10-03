/**
 * Floor Naming SSoT (ADR-369 §9 Q9) — Phase A1 · ADR-903 (λεξιλόγιο ορόφου)
 *
 * Το **λεξιλόγιο** της στάθμης (Revit Level · ArchiCAD Story · IfcBuildingStorey): είδη,
 * ποια μετρούν ως όροφοι, short engineering code. **Καμία ανθρώπινη ετικέτα εδώ** — αυτή
 * ζει σε i18n (`floors:label.*`) και αποδίδεται από τον **έναν** μορφοποιητή
 * `@/lib/floor/floor-label` (client + server). Η Ελληνική canonical `longName` που
 * αποθηκεύεται: `canonicalFloorLongName` στο `@/lib/floor/floor-label-bundle`.
 *
 * Storage convention (ADR-369 §9 Q9 + user decision 2026-05-20):
 *   - `Floor.longName` αποθηκεύεται **πάντα ως Ελληνικό canonical** στη Firestore
 *     (π.χ. "1ος Όροφος", "Ισόγειο", "Υπόγειο").
 *   - Η ετικέτα UI παράγεται at render time από το `FloorRef` (ADR-903).
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
  | 'stair-penthouse'
  // ADR-903 — ελληνική πρακτική (ΝΟΚ · Spitogatos/xe φίλτρα · idealista «semisótano»):
  | 'semi-basement' // ημιυπόγειο — κάτω από το έδαφος, μετρά ως όροφος (όπως το υπόγειο)
  | 'raised-ground' // υπερυψωμένο ισόγειο — αριθμός 0, μετρά ως όροφος
  | 'pilotis' // πυλωτή — ανοιχτή στάθμη με υποστυλώματα· «Πυλωτή + 4 όροφοι» ⇒ ΔΕΝ μετρά
  | 'attic'; // σοφίτα ως στάθμη — ΔΕΝ μετρά (το «ρετιρέ» είναι ΕΙΔΟΣ ΑΚΙΝΗΤΟΥ, όχι στάθμη)

export const FLOOR_KIND_VALUES: readonly FloorKind[] = [
  'foundation',
  'basement',
  'semi-basement',
  'ground',
  'raised-ground',
  'pilotis',
  'standard',
  'roof',
  'mezzanine',
  'stair-penthouse',
  'attic',
] as const;

export function isFloorKind(value: unknown): value is FloorKind {
  return typeof value === 'string' && (FLOOR_KIND_VALUES as readonly string[]).includes(value);
}

// ─── Special levels SSoT (ADR-461 — Revit «Building Story» OFF) ───────────────

/**
 * Στάθμες που ΔΕΝ μετρώνται ως όροφοι («Όροφοι: N»): θεμελίωση, δώμα, απόληξη
 * κλιμακοστασίου, πυλωτή, σοφίτα (ADR-903, απόφαση Giorgio 2026-10-03: «Πυλωτή + 4
 * όροφοι»). Έχουν δικό τους DXF Level (σχεδιάσιμες) αλλά είναι εκτός count.
 */
export const SPECIAL_LEVEL_KINDS: readonly FloorKind[] = [
  'foundation',
  'roof',
  'stair-penthouse',
  'pilotis',
  'attic',
] as const;

/** Στάθμες κάτω από το έδαφος — IFC `Pset_BuildingStoreyCommon.AboveGround = false`. */
const BELOW_GROUND_KINDS: readonly FloorKind[] = ['foundation', 'basement', 'semi-basement'] as const;

/**
 * IFC `AboveGround` (ADR-903). SSoT για κάθε ερώτηση «υπόγεια στάθμη;» — π.χ. το ημιυπόγειο
 * συμπεριφέρεται όπως το υπόγειο (θεμελίωση, ελάχιστο ύψος) χωρίς κάθε καταναλωτής να το ξέρει.
 */
export function isAboveGround(kind: FloorKind): boolean {
  return !(BELOW_GROUND_KINDS as readonly string[]).includes(kind);
}

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
 *   semi-basement → "SB" · raised-ground → "RG" · pilotis → "PL" · attic → "AT" (ADR-903)
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
    case 'semi-basement':
      return 'SB';
    case 'raised-ground':
      return 'RG';
    case 'pilotis':
      return 'PL';
    case 'attic':
      return 'AT';
  }
}

// ─── Long name ────────────────────────────────────────────────────────────────
// ADR-903: η Ελληνική canonical longName ΜΕΤΑΚΟΜΙΣΕ στο `canonicalFloorLongName`
// (`@/lib/floor/floor-label-bundle`) — αποδίδεται από τα ΙΔΙΑ κλειδιά i18n με την UI,
// αντί για δεύτερο ελληνικό κείμενο γραμμένο εδώ.

// ─── Kind inference (Revit-style auto-classification) ────────────────────────

/**
 * Εξάγει το πιο πιθανό `kind` από τον αριθμό του ορόφου.
 *   number === 0  → 'ground'
 *   number  >  0  → 'standard'
 *   number  <  0  → 'basement'
 *
 * Σημείωση: 'foundation' / 'roof' / 'mezzanine' / 'stair-penthouse' / 'semi-basement' /
 * 'raised-ground' / 'pilotis' / 'attic' (ADR-903) είναι
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
