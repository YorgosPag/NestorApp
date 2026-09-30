/**
 * @fileoverview **Η εκτέλεση ερωτήματος** — φίλτρο → ταξινόμηση → δρομέας → όριο, ως καθαρή συνάρτηση.
 *
 * @module test-utils/fake-firestore/query-engine
 */

import { compareValues, matchesClause, readPath, type Doc, type WhereClause } from './values';

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
}

export const EMPTY_SPEC: QuerySpec = { clauses: [], order: null, cap: null, after: null };

/**
 * **`orderBy` πιστό στο Firestore** (ADR-890 §17): έγγραφα **χωρίς** το πεδίο **εξαιρούνται** — η παγίδα που κρύβει
 * σιωπηλά έγγραφα· ισοπαλία κατά id **με την ίδια φορά** (ο Firestore προσθέτει σιωπηρά `__name__`).
 */
function ordered(rows: readonly ScannedDoc[], order: OrderSpec): ScannedDoc[] {
  const sign = order.direction === 'asc' ? 1 : -1;
  return rows
    .filter((row) => readPath(row.data, order.field) !== undefined)
    .sort((a, b) => sign * (compareValues(readPath(a.data, order.field), readPath(b.data, order.field)) || compareValues(a.id, b.id)));
}

/**
 * Θέση μετά τον δρομέα. Βρέθηκε στα αποτελέσματα ⇒ αμέσως μετά. Αλλιώς, με `orderBy` και δεδομένα δρομέα ⇒ ό,τι
 * ταξινομείται **αυστηρά μετά** (τιμή, id) — όπως ο Firestore, που θέτει τον δρομέα από τις **τιμές** του στιγμιότυπου.
 */
function afterCursor(rows: ScannedDoc[], cursor: CursorSpec, order: OrderSpec | null): ScannedDoc[] {
  const at = rows.findIndex((row) => row.id === cursor.id);
  if (at !== -1) return rows.slice(at + 1);
  if (order === null || cursor.data === undefined) return [];
  const sign = order.direction === 'asc' ? 1 : -1;
  const bound = readPath(cursor.data, order.field);
  return rows.filter((row) => sign * (compareValues(readPath(row.data, order.field), bound) || compareValues(row.id, cursor.id)) > 0);
}

/**
 * Χωρίς `orderBy` ο Firestore επιστρέφει **κατά id εγγράφου** — όχι σειρά εισαγωγής. Και τα δύο παλιά fakes έδιναν σειρά
 * εισαγωγής· το έπιασε το συμβόλαιο στον emulator (Q11, 2026-09-30), με **μηδέν** καλούντες να εξαρτώνται από αυτήν.
 */
function byDocumentId(rows: readonly ScannedDoc[]): ScannedDoc[] {
  return [...rows].sort((a, b) => compareValues(a.id, b.id) || compareValues(a.path, b.path));
}

export function runQuery(rows: readonly ScannedDoc[], spec: QuerySpec): ScannedDoc[] {
  let result = rows.filter((row) => spec.clauses.every((clause) => matchesClause(row.data, clause)));
  result = spec.order !== null ? ordered(result, spec.order) : byDocumentId(result);
  if (spec.after !== null) result = afterCursor(result, spec.after, spec.order);
  return spec.cap === null ? result : result.slice(0, spec.cap);
}
