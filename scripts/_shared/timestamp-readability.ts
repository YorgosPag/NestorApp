/**
 * =============================================================================
 * TIMESTAMP READABILITY — καθαρή κατηγοριοποίηση, με τον SSoT ως μοναδικό κριτή
 * =============================================================================
 *
 * Απαντά **μία** ερώτηση ανά τιμή: «θα τη διαβάσει η παραγωγή;»
 *
 * ⚠️ ΚΡΙΣΙΜΟ ΣΥΜΒΟΛΑΙΟ (ADR-218 §Phase 4):
 * Η απάντηση δίνεται **αποκλειστικά** από την {@link normalizeToMillisOrNull}
 * του `src/lib/date-local` — τον ίδιο κώδικα που τρέχει στην παραγωγή. Αυτό το
 * module **ΔΕΝ έχει δικό του έλεγχο εγκυρότητας** και δεν πρέπει ποτέ να
 * αποκτήσει: ένας χειρόγραφος έλεγχος (`Date.parse`, `instanceof Timestamp`,
 * `!isNaN(...)`) μετράει **άλλο πράγμα** από αυτό που κάνει η εφαρμογή, και θα
 * βγάλει αριθμό που μοιάζει σωστός και είναι λάθος. Ακριβώς αυτή η κίνηση
 * γέννησε τους 11 τοπικούς κλώνους που η Phase 4 μόλις κατάργησε.
 *
 * Το `shape` **δεν αποφασίζει** — μόνο **περιγράφει** τη μορφή μιας τιμής που ο
 * SSoT ήδη απέρριψε, ώστε να ξεχωρίζει το «λείπει το πεδίο» (διορθώνεται με
 * backfill) από το «υπάρχει αλλά είναι σκουπίδι» (διορθώνεται στον writer).
 *
 * @module scripts/_shared/timestamp-readability
 * @see docs/centralized-systems/reference/adrs/ADR-218-timestamp-conversion-centralization.md
 */

import { normalizeToMillisOrNull } from '../../src/lib/date-local';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Η μορφή μιας τιμής **που ο SSoT δεν διάβασε**. Οι τέσσερις πρώτες τιμές
 * κόβονται από το `if (!val) return null` στην αρχή της `normalizeToDate` —
 * είναι falsy, όχι κατεστραμμένες.
 */
export type UnreadableShape =
  | 'missing'
  | 'null'
  | 'empty-string'
  | 'zero'
  | 'garbage-string'
  | 'garbage-number'
  | 'unknown-shape';

export interface FieldReading {
  /** Το πεδίο υπάρχει καν στο έγγραφο; */
  present: boolean;
  /** Η **μόνη** απόφαση — και την παίρνει ο SSoT. */
  readable: boolean;
  millis: number | null;
  /** Περιγραφή μορφής· `null` όταν η τιμή διαβάστηκε. */
  shape: UnreadableShape | null;
  /**
   * Ο τύπος όπως τον βλέπει το Admin SDK (`Timestamp`, `string`, `number`…).
   * Καταγράφεται **και για τις αναγνώσιμες** τιμές: μια τιμή που διαβάζεται
   * αλλά έχει άλλον τύπο από τον δηλωμένο είναι ανεξάρτητο εύρημα (type drift).
   */
  rawType: string;
  rawPreview: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const PREVIEW_MAX_CHARS = 100;

/** Ο τύπος όπως έφτασε από το Firestore — `Timestamp`, `string`, `number`, … */
export function describeRawType(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value !== 'object') return typeof value;
  const ctorName = (value as object).constructor?.name;
  return ctorName ?? 'object';
}

function previewOf(value: unknown): string {
  let text: string;
  try {
    text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  } catch {
    text = String(value);
  }
  if (text === undefined || text === null) text = String(value);
  return text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS)}…` : text;
}

/**
 * Περιγράφει τη μορφή μιας **ήδη απορριφθείσας** τιμής. Δεν καλείται ποτέ για
 * τιμή που ο SSoT διάβασε.
 */
function describeShape(value: unknown, present: boolean): UnreadableShape {
  if (!present || value === undefined) return 'missing';
  if (value === null) return 'null';
  if (value === '') return 'empty-string';
  if (typeof value === 'number') return value === 0 ? 'zero' : 'garbage-number';
  if (typeof value === 'string') return 'garbage-string';
  return 'unknown-shape';
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Διαβάζει ένα **top-level** πεδίο εγγράφου και απαντά αν η παραγωγή θα το
 * καταλάβει. Τα πεδία του audit είναι όλα flat· δεν υποστηρίζονται dotted paths.
 */
export function readInstantField(
  data: Record<string, unknown>,
  field: string
): FieldReading {
  const present = Object.prototype.hasOwnProperty.call(data, field);
  const raw = present ? data[field] : undefined;

  // ⚠️ Ο SSoT ρωτιέται ΠΡΩΤΟΣ και είναι ο μόνος που αποφασίζει.
  const millis = normalizeToMillisOrNull(raw);
  const readable = millis !== null;

  return {
    present,
    readable,
    millis,
    shape: readable ? null : describeShape(raw, present),
    rawType: describeRawType(raw),
    rawPreview: previewOf(raw),
  };
}

// =============================================================================
// ΑΛΥΣΙΔΑ `a ?? b` — όπως τη γράφει ο καταναλωτής
// =============================================================================

export interface ChainReading extends FieldReading {
  /** Ποιο πεδίο της αλυσίδας κατέληξε να διαβαστεί. */
  usedField: string;
}

/**
 * Μιμείται **ακριβώς** το `data.updatedAt ?? data.createdAt` του καταναλωτή:
 * επιλέγεται το πρώτο πεδίο με τιμή που δεν είναι `null`/`undefined`. Αν κανένα
 * δεν έχει, διαβάζεται το τελευταίο — ώστε η αναφορά να δείχνει το πεδίο που
 * θα κοιτούσε ο κώδικας.
 */
export function readInstantChain(
  data: Record<string, unknown>,
  chain: readonly string[]
): ChainReading {
  for (const field of chain) {
    const value = data[field];
    if (value !== null && value !== undefined) {
      return { ...readInstantField(data, field), usedField: field };
    }
  }
  const last = chain[chain.length - 1];
  return { ...readInstantField(data, last), usedField: last };
}

// =============================================================================
// ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ — «μη αναγνώσιμο» ≠ «αλλάζει το αποτέλεσμα»
// =============================================================================

/**
 * - `always`      — δεν υπήρχε προηγούμενος φύλακας· κάθε μη αναγνώσιμη τιμή αλλάζει το αποτέλεσμα.
 * - `only-truthy` — ο καταναλωτής έχει ήδη `if (!value) continue`, οπότε
 *                   missing/null/''/0 **παρακάμπτονταν και πριν** την αλλαγή.
 * - `ordering-only` — αλλάζει μόνο σειρά ταξινόμησης, και μόνο με ≥2 εγγραφές.
 */
export type BehaviourChange = 'always' | 'only-truthy' | 'ordering-only';

/** Οι falsy μορφές που ένας `if (!value)` φύλακας απέρριπτε ΚΑΙ πριν. */
export const FALSY_SHAPES: ReadonlySet<UnreadableShape> = new Set<UnreadableShape>([
  'missing',
  'null',
  'empty-string',
  'zero',
]);

export function changesBehaviour(mode: BehaviourChange, shape: UnreadableShape): boolean {
  if (mode === 'only-truthy') return !FALSY_SHAPES.has(shape);
  return true;
}
