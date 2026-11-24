/**
 * @fileoverview **Η εκτέλεση ερωτήματος** — φίλτρο → ταξινόμηση → δρομέας → όριο, ως καθαρή συνάρτηση.
 *
 * @module test-utils/fake-firestore/query-engine
 */

import { compareValues, matchesClause, readPath, type Doc, type WhereClause, type WhereOp } from './values';

/** Μια γραμμή που βλέπει το ερώτημα — η **δική της** διαδρομή συλλογής ταξιδεύει μαζί (collectionGroup, υποσυλλογές). */
export interface ScannedDoc {
  readonly path: string;
  readonly id: string;
  readonly data: Doc;
}

export interface OrderSpec {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

/** Δρομέας `startAfter(snapshot)`: το id, και —αν το έχει— το ίδιο το έγγραφο, για θέση κατά τιμή. */
export interface CursorSpec {
  readonly id: string;
  readonly data?: Doc;
}

export interface QuerySpec {
  readonly clauses: readonly WhereClause[];
  readonly order: OrderSpec | null;
  readonly cap: number | null;
  readonly after: CursorSpec | null;
  readonly fields?: readonly string[];
}

export const EMPTY_SPEC: QuerySpec = { clauses: [], order: null, cap: null, after: null };

/** Το `FieldPath.documentId()` του Admin SDK, σειριοποιημένο — το id του εγγράφου, όχι πεδίο. */
const DOCUMENT_ID = '__name__';

/** Οι τελεστές **ανισότητας** του Firestore — αυτοί που υπονοούν ταξινόμηση στο πεδίο τους. */
const INEQUALITY_OPS: ReadonlySet<WhereOp> = new Set<WhereOp>(['<', '<=', '>', '>=', '!=']);

/**
 * 🏆 **Η ΣΕΙΡΑ ΠΟΥ ΕΦΑΡΜΟΖΕΙ ΠΡΑΓΜΑΤΙ Ο FIRESTORE** — οι κανόνες του `StructuredQuery.order_by` (αναφορά REST, standard edition):
 *
 *   1. κάθε πεδίο με φίλτρο **ανισότητας** πρέπει να είναι στο `orderBy`· όσα λείπουν **προστίθενται**, σε
 *      **λεξικογραφική** σειρά ονόματος πεδίου·
 *   2. αν δεν ζητήθηκε σειρά στο `__name__`, προστίθεται **τελευταία**·
 *   3. ό,τι προστίθεται παίρνει τη **φορά του τελευταίου ρητού** `orderBy` — αύξουσα αν δεν δόθηκε κανένα.
 *
 * 🔴 **Το ελάττωμα που διορθώνει (συμβόλαιο Q14, κόκκινο στον emulator από `8a3f77ed`, 2026-11-09 ως 2026-11-24):** ως
 * τότε ερώτημα με ανισότητα και **χωρίς** `orderBy` ταξινομούνταν εδώ κατά id. Το `where('at','<',…)` έδινε `['mid','old']`·
 * ο emulator `['old','mid']` (κατά `at`). Η προσδοκία του συμβολαίου είχε γραφτεί πάνω στο ψεύτικο — δηλαδή το όργανο
 * επικύρωνε το δικό του λάθος.
 *
 * `fields`: τα πεδία ταξινόμησης **πριν** από το id. `byIdOnly`: ρητό `orderBy(documentId())` — το id είναι μοναδικό, άρα
 * ό,τι θα προστίθετο μετά δεν αλλάζει τίποτα.
 */
interface EffectiveOrder {
  readonly fields: readonly OrderSpec[];
  readonly sign: 1 | -1;
  readonly byIdOnly: boolean;
}

function effectiveOrderOf(spec: QuerySpec): EffectiveOrder {
  const explicit = spec.order;
  const direction = explicit?.direction ?? 'asc';
  const sign = direction === 'asc' ? 1 : -1;
  if (explicit?.field === DOCUMENT_ID) return { fields: [], sign, byIdOnly: true };

  const implied = [...new Set(spec.clauses.filter((clause) => INEQUALITY_OPS.has(clause.op)).map((clause) => String(clause.field)))]
    .filter((field) => field !== DOCUMENT_ID && field !== explicit?.field)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((field): OrderSpec => ({ field, direction }));
  return { fields: explicit === null ? implied : [explicit, ...implied], sign, byIdOnly: false };
}

/** Σύγκριση κατά τα πεδία ταξινόμησης, και ισοπαλία κατά id **με την ίδια φορά** (το σιωπηρό `__name__`). */
function compareByOrder(order: EffectiveOrder, a: { readonly id: string; readonly data: Doc }, b: { readonly id: string; readonly data: Doc }): number {
  for (const { field, direction } of order.fields) {
    const by = compareValues(readPath(a.data, field), readPath(b.data, field));
    if (by !== 0) return direction === 'asc' ? by : -by;
  }
  return order.sign * compareValues(a.id, b.id);
}

/**
 * **Ταξινόμηση πιστή στο Firestore** (ADR-890 §17): έγγραφα **χωρίς** πεδίο ταξινόμησης **εξαιρούνται** — η παγίδα που
 * κρύβει σιωπηλά έγγραφα. Χωρίς κανένα πεδίο η σειρά είναι **κατά id εγγράφου**, όχι σειρά εισαγωγής (συμβόλαιο Q11)· η
 * διαδρομή σπάει την ισοπαλία ίδιων id σε `collectionGroup`.
 */
function ordered(rows: readonly ScannedDoc[], order: EffectiveOrder): ScannedDoc[] {
  return rows
    .filter((row) => order.fields.every(({ field }) => readPath(row.data, field) !== undefined))
    .sort((a, b) => compareByOrder(order, a, b) || compareValues(a.path, b.path));
}

/**
 * Θέση μετά τον δρομέα. Βρέθηκε στα αποτελέσματα ⇒ αμέσως μετά. Αλλιώς, με `orderBy` και δεδομένα δρομέα ⇒ ό,τι
 * ταξινομείται **αυστηρά μετά** (τιμές, id) — όπως ο Firestore, που θέτει τον δρομέα από τις **τιμές** του στιγμιότυπου.
 */
function afterCursor(rows: ScannedDoc[], cursor: CursorSpec, order: EffectiveOrder, explicit: OrderSpec | null): ScannedDoc[] {
  // Κατά id: ο δρομέας είναι **θέση** — ό,τι ταξινομείται αυστηρά μετά, ακόμη κι αν εκείνο το έγγραφο σβήστηκε.
  if (order.byIdOnly) return rows.filter((row) => order.sign * compareValues(row.id, cursor.id) > 0);
  const at = rows.findIndex((row) => row.id === cursor.id);
  if (at !== -1) return rows.slice(at + 1);
  const { data } = cursor;
  if (explicit === null || data === undefined) return [];
  return rows.filter((row) => compareByOrder(order, row, { id: cursor.id, data }) > 0);
}

/**
 * Η τιμή που κρίνει μια συνθήκη: για `FieldPath.documentId()` (σειριοποιημένο `__name__`) το **id** του εγγράφου, αλλιώς τα
 * δεδομένα του (συμβόλαιο Q13). Πριν, το fake έψαχνε πεδίο `__name__` και δεν ταίριαζε ποτέ τίποτα.
 */
function matchesRow(row: ScannedDoc, clause: QuerySpec['clauses'][number]): boolean {
  if (String(clause.field) !== DOCUMENT_ID) return matchesClause(row.data, clause);
  return matchesClause({ [DOCUMENT_ID]: row.id }, { ...clause, field: DOCUMENT_ID });
}

export function runQuery(rows: readonly ScannedDoc[], spec: QuerySpec): ScannedDoc[] {
  const order = effectiveOrderOf(spec);
  let result = ordered(rows.filter((row) => spec.clauses.every((clause) => matchesRow(row, clause))), order);
  if (spec.after !== null) result = afterCursor(result, spec.after, order, spec.order);
  return spec.cap === null ? result : result.slice(0, spec.cap);
}
