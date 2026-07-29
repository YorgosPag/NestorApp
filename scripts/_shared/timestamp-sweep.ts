/**
 * =============================================================================
 * TIMESTAMP SWEEP — ανακάλυψη χρονικών πεδίων σε ΟΛΟ το Firestore
 * =============================================================================
 *
 * Ο στοχευμένος έλεγχος (`audit-unreadable-timestamps.ts`) απαντά «πόσα έγγραφα
 * σπάει **αυτή** η αλλαγή». Το sweep απαντά το ευρύτερο: **πού αλλού υπάρχουν
 * χαλασμένες ημερομηνίες**, χωρίς να ξέρουμε από πριν τα ονόματα των πεδίων.
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΠΑΡΑΒΙΑΖΕΙ ΤΟΝ ΚΑΝΟΝΑ «μόνο ο SSoT κρίνει»:
 * Η ευρετική εδώ επιλέγει **ποια πεδία να ρωτήσουμε**. Το **αν διαβάζεται** μια
 * τιμή το απαντά πάντα και μόνο η `normalizeToMillisOrNull` (μέσω
 * {@link readInstantField}). Επιλογή ερωτήματος ≠ κριτήριο εγκυρότητας.
 *
 * ΤΟ ΤΕΧΝΑΣΜΑ (γιατί δεν βασιζόμαστε σε λίστα ονομάτων):
 * Ένα πεδίο θεωρείται χρονικό μόνο όταν το **αποδεικνύουν τα ίδια τα δεδομένα** —
 * τουλάχιστον μία τιμή του διαβάστηκε από τον SSoT **και** υπάρχει δεύτερο,
 * ανεξάρτητο σήμα (τύπος `Timestamp`/`Date` σε κάποιο έγγραφο, ή χρονικό όνομα).
 * Χωρίς τη σύζευξη, ένα πεδίο `floor: "2026"` θα περνούσε για ημερομηνία — το
 * `new Date("2026")` είναι έγκυρο. Έτσι το «πόσα είναι χαλασμένα» μετριέται
 * **μόνο μέσα σε πεδία που αποδεδειγμένα κρατούν χρόνο**.
 *
 * @module scripts/_shared/timestamp-sweep
 * @see docs/centralized-systems/reference/adrs/ADR-218-timestamp-conversion-centralization.md
 */

import type { Firestore } from 'firebase-admin/firestore';
import { readInstantField, describeRawType, type UnreadableShape } from './timestamp-readability';

// =============================================================================
// ΕΥΡΕΤΙΚΗ ΑΝΑΚΑΛΥΨΗΣ (επιλέγει ΕΡΩΤΗΜΑΤΑ, όχι απαντήσεις)
// =============================================================================

/**
 * Ονόματα που υπόσχονται χρόνο — **camelCase κατάληξη**, case-sensitive. Σήμα #1.
 *
 * ⚠️ Η πρώτη εκδοχή ήταν case-insensitive αναζήτηση υποσυμβολοσειράς και
 * παρήγαγε σκέτο θόρυβο: `elev(at)ion`, `preload(On)Idle`,
 * `nameAutoGener(at)ed`. Με `/i`, το `[A-Z]` ταιριάζει και πεζά — το «όριο
 * λέξης» εξαφανίζεται. Η κατάληξη είναι το πραγματικό σήμα: ό,τι κρατά χρόνο
 * σε αυτό το repo λέγεται `…At` / `…Date` / `…Until` / `…From`.
 */
const TEMPORAL_SUFFIX = /[a-z](At|Date|Time|Timestamp|On|Since|Until|From|Expiry|Deadline|Due)$/;

/** Πεδία που είναι σκέτα «date»/«time» χωρίς πρόθεμα. */
const TEMPORAL_EXACT_NAMES: ReadonlySet<string> = new Set(['date', 'time', 'timestamp', 'datetime']);

export function isTemporalFieldName(field: string): boolean {
  return TEMPORAL_EXACT_NAMES.has(field.toLowerCase()) || TEMPORAL_SUFFIX.test(field);
}

/** Τύποι που **είναι** χρόνος ό,τι κι αν λέει το όνομα. Σήμα #2. */
const TEMPORAL_TYPES: ReadonlySet<string> = new Set(['Timestamp', 'Date']);

/**
 * Τύποι που **ποτέ** δεν κρατούν χρονική στιγμή σε αυτό το μοντέλο δεδομένων.
 * Ένα `boolean` περνά τη `normalizeToDate` (`new Date(true)` = 1970-01-01T00:00:00.001Z)
 * — ιδιοτροπία της JS, όχι ημερομηνία. Ένα πεδίο που έχει έστω μία τέτοια τιμή
 * αποκλείεται συνολικά.
 */
const NEVER_TEMPORAL_TYPES: ReadonlySet<string> = new Set(['boolean', 'array']);

/**
 * Πάνω από αυτό το εργαλείο **σταματά και ρωτάει** αντί να διαβάσει τα πάντα.
 * SSoT για το όριο — το χρησιμοποιεί και ο στοχευμένος έλεγχος
 * (`audit-unreadable-timestamps.ts`). Ένα audit που φέρνει ολόκληρη συλλογή στη
 * μνήμη χωρίς σελιδοποίηση παύει να είναι audit και γίνεται περιστατικό.
 */
export const MAX_DOCS_PER_COLLECTION = 5_000;

// =============================================================================
// TYPES
// =============================================================================

export interface SweepFieldFinding {
  collection: string;
  field: string;
  /** Έγγραφα της συλλογής στα οποία εμφανίζεται το πεδίο. */
  present: number;
  readable: number;
  unreadable: number;
  shapes: Record<string, number>;
  /** Όλοι οι τύποι που παρατηρήθηκαν — >1 σημαίνει type drift. */
  types: Record<string, number>;
  hasTemporalName: boolean;
  hasTemporalType: boolean;
  /**
   * `confirmed` — το πεδίο κρατά **αποδεδειγμένα** χρόνο: υπάρχει τιμή τύπου
   * `Timestamp`/`Date`. `name-only` — μόνο το όνομα το υπόσχεται (τυπικά ISO
   * strings)· γνήσιο στις περισσότερες περιπτώσεις, αλλά θέλει ανθρώπινο μάτι.
   */
  confidence: 'confirmed' | 'name-only';
  offenderIds: string[];
}

export interface SweepResult {
  collectionsScanned: number;
  docsScanned: number;
  skippedCollections: string[];
  findings: SweepFieldFinding[];
}

// =============================================================================
// ΣΥΣΣΩΡΕΥΣΗ
// =============================================================================

interface FieldAccumulator {
  present: number;
  readable: number;
  unreadable: number;
  shapes: Record<string, number>;
  types: Record<string, number>;
  hasTemporalName: boolean;
  hasTemporalType: boolean;
  /** Έστω μία τιμή τύπου που ποτέ δεν κρατά χρόνο ⇒ το πεδίο αποκλείεται. */
  disqualified: boolean;
  offenderIds: string[];
}

const MAX_OFFENDER_IDS = 25;

function emptyAccumulator(field: string): FieldAccumulator {
  return {
    present: 0,
    readable: 0,
    unreadable: 0,
    shapes: {},
    types: {},
    hasTemporalName: isTemporalFieldName(field),
    hasTemporalType: false,
    disqualified: false,
    offenderIds: [],
  };
}

function recordValue(
  acc: FieldAccumulator,
  data: Record<string, unknown>,
  field: string,
  docId: string
): void {
  acc.present += 1;
  const rawType = describeRawType(data[field]);
  acc.types[rawType] = (acc.types[rawType] ?? 0) + 1;
  if (TEMPORAL_TYPES.has(rawType)) acc.hasTemporalType = true;
  if (NEVER_TEMPORAL_TYPES.has(rawType)) acc.disqualified = true;

  const reading = readInstantField(data, field);
  if (reading.readable) {
    acc.readable += 1;
    return;
  }
  acc.unreadable += 1;
  const shape: UnreadableShape = reading.shape ?? 'unknown-shape';
  acc.shapes[shape] = (acc.shapes[shape] ?? 0) + 1;
  if (acc.offenderIds.length < MAX_OFFENDER_IDS) acc.offenderIds.push(docId);
}

/**
 * Το πεδίο πέρασε και τα δύο φίλτρα: τα δεδομένα απέδειξαν ότι κρατά χρόνο
 * (≥1 αναγνώσιμη τιμή) **και** υπάρχει ανεξάρτητο σήμα (τύπος ή όνομα).
 */
function isProvenTemporal(acc: FieldAccumulator): boolean {
  if (acc.disqualified) return false;
  return acc.readable > 0 && (acc.hasTemporalType || acc.hasTemporalName);
}

// =============================================================================
// ΣΑΡΩΣΗ
// =============================================================================

async function sweepCollection(
  db: Firestore,
  name: string
): Promise<{ docs: number; fields: Map<string, FieldAccumulator> } | null> {
  const ref = db.collection(name);
  const countSnap = await ref.count().get();
  if (countSnap.data().count > MAX_DOCS_PER_COLLECTION) return null;

  const snap = await ref.get();
  const fields = new Map<string, FieldAccumulator>();

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    for (const field of Object.keys(data)) {
      let acc = fields.get(field);
      if (!acc) {
        acc = emptyAccumulator(field);
        fields.set(field, acc);
      }
      recordValue(acc, data, field, doc.id);
    }
  }

  return { docs: snap.size, fields };
}

/**
 * Σαρώνει κάθε top-level συλλογή και επιστρέφει **μόνο** τα αποδεδειγμένα
 * χρονικά πεδία που έχουν ≥1 μη αναγνώσιμη τιμή, ή ανάμεικτους τύπους.
 */
export async function sweepAllCollections(db: Firestore): Promise<SweepResult> {
  const roots = await db.listCollections();
  const findings: SweepFieldFinding[] = [];
  const skipped: string[] = [];
  let docsScanned = 0;

  for (const root of roots) {
    const scanned = await sweepCollection(db, root.id);
    if (!scanned) {
      skipped.push(root.id);
      continue;
    }
    docsScanned += scanned.docs;

    for (const [field, acc] of scanned.fields) {
      if (!isProvenTemporal(acc)) continue;
      const mixedTypes = Object.keys(acc.types).length > 1;
      if (acc.unreadable === 0 && !mixedTypes) continue;
      const { disqualified: _ignored, ...rest } = acc;
      findings.push({
        collection: root.id,
        field,
        ...rest,
        confidence: acc.hasTemporalType ? 'confirmed' : 'name-only',
      });
    }
  }

  findings.sort((a, b) => b.unreadable - a.unreadable || a.collection.localeCompare(b.collection));

  return { collectionsScanned: roots.length, docsScanned, skippedCollections: skipped, findings };
}
