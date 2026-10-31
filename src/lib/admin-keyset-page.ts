/**
 * @fileoverview **ΜΙΑ ΣΕΛΙΔΑ ΕΝΟΣ ΕΡΩΤΗΜΑΤΟΣ FIRESTORE, ΜΕ ΔΡΟΜΕΑ** (Admin SDK) — keyset pagination.
 * @related Google AIP-158 · Stripe `starting_after` · `lib/api/page-token.ts` · `lib/pagination.ts` · ADR-ACC-010 §2.1.1
 * @module lib/admin-keyset-page
 *
 * 🔑 **Γιατί keyset και όχι `startAfter(snapshot)`**: ο δρομέας είναι οι **τιμές** της τελευταίας γραμμής
 * (πεδίο ταξινόμησης + id εγγράφου), όχι ένα έγγραφο που πρέπει να ξαναδιαβαστεί. Άρα (α) **καμία** επιπλέον
 * ανάγνωση ανά σελίδα, (β) ο δρομέας **επιβιώνει** αν σβηστεί η γραμμή στην οποία δείχνει (το `doc(id).get()` του
 * audit-log θα γύριζε στην πρώτη σελίδα σιωπηλά).
 *
 * 🔑 **Tie-breaker στο id**: η ταξινόμηση είναι `(πεδίο, __name__)` στην **ίδια** φορά. Χωρίς αυτό, δύο εγγραφές
 * με την ίδια ημερομηνία (το σύνηθες σε ημερολόγιο) θα μπορούσαν να χαθούν ή να διπλασιαστούν στο όριο σελίδας.
 * Ο σύνθετος δείκτης `(…, πεδίο ↓)` καλύπτει ήδη το `__name__ ↓` — ο Firestore το προσθέτει σιωπηρά με τη φορά
 * του τελευταίου πεδίου — άρα **κανένας** νέος δείκτης.
 *
 * 🔑 **`limit + 1`**: το `hasNext` **μετριέται**, δεν μαντεύεται από το «γέμισε η σελίδα» (που έλεγε ψέματα όταν το
 * σύνολο ήταν ακριβώς πολλαπλάσιο του μεγέθους).
 *
 * 🔴 **Ο δρομέας είναι δεμένος στο ερώτημα** (AIP-158: «αλλαγή άλλων παραμέτρων μαζί με token ⇒ σφάλμα»): κουβαλά
 * αποτύπωμα της εμβέλειας (φίλτρα + ταξινόμηση). Token άλλων φίλτρων ⇒ `InvalidPageTokenError` ⇒ 400 — **ποτέ**
 * σελίδα του λάθος συνόλου, ποτέ «πρώτη σελίδα» σιωπηλά.
 *
 * ⚠️ **Χωρίς fallback**: σφάλμα Firestore (π.χ. δείκτης που λείπει) ανεβαίνει στον καλούντα. Η οθόνη δείχνει
 * σφάλμα, όχι «κενή λίστα».
 *
 * ⚠️ Το CHECK 3.91 **δεν** βλέπει ερωτήματα που περνούν από εδώ (το `.get()` ζει σε αυτό το αρχείο). Όποιος καλεί
 * χρειάζεται άγκυρα ισοτιμίας δεικτών πάνω στη **δήλωση** του ερωτήματός του.
 *
 * **Layering**: server-only (Admin SDK).
 */

import 'server-only';

import { createHash } from 'node:crypto';
import { FieldPath, Timestamp, type DocumentData, type Query } from 'firebase-admin/firestore';

import { decodePageToken, encodePageToken } from '@/lib/api/page-token';
import { canonicalJson } from '@/lib/legal/canonical-json';
import type { PaginatedResult } from '@/lib/pagination';

/**
 * Τι κρατά το πεδίο ταξινόμησης: **κείμενο** (π.χ. `YYYY-MM-DD` — προεπιλογή) ή Firestore **`Timestamp`** (π.χ. το
 * `serverTimestamp()` των ιστορικών). Μπαίνει στο αποτύπωμα: δρομέας του ενός είδους δεν γίνεται δεκτός από το άλλο.
 */
export type KeysetOrderKind = 'string' | 'timestamp';

/** Η ταξινόμηση της λίστας — βλ. `orderValueOf` για το τι επιτρέπεται στο πεδίο. */
export interface KeysetOrder {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
  /** Απόν ⇒ `'string'` (και το αποτύπωμα μένει ίδιο με πριν υπάρξει το πεδίο). */
  readonly kind?: KeysetOrderKind;
}

/** Τιμές φίλτρων που ορίζουν το σύνολο — μπαίνουν στο αποτύπωμα του δρομέα. */
export type KeysetScope = Readonly<Record<string, string | number | boolean>>;

export interface KeysetPageSpec<T> {
  /** Το φιλτραρισμένο ερώτημα — **χωρίς** `orderBy` και `limit` (τα βάζει ο αναγνώστης). */
  readonly base: Query;
  readonly order: KeysetOrder;
  readonly scope: KeysetScope;
  readonly pageSize: number;
  /** Η θέση μετά την οποία ξεκινά η σελίδα — ήδη αποκωδικοποιημένη (`decodeKeysetCursor`)· `null` ⇒ η πρώτη. */
  readonly after: KeysetPosition | null;
  /** Έγγραφο → γραμμή. Το `id` για συλλογές που δεν αποθηκεύουν την ταυτότητα μέσα στο έγγραφο (π.χ. ιστορικά). */
  readonly map: (data: DocumentData, id: string) => T;
}

/** Ο δρομέας είναι χαλασμένος ή ανήκει σε **άλλο** ερώτημα — ο καλών απαντά 400. */
export class InvalidPageTokenError extends Error {
  /** Ο κωδικός της άρνησης στην απάντηση 400 — ο πελάτης τον μεταφράζει, δεν διαβάζει το μήνυμα. */
  static readonly code = 'INVALID_PAGE_TOKEN';

  constructor() {
    super('Invalid page cursor for this query');
    this.name = 'InvalidPageTokenError';
  }
}

export interface KeysetPosition {
  /** Η τιμή ταξινόμησης **κωδικοποιημένη** ως κείμενο (για `'timestamp'`: `δευτερόλεπτα.νανοδευτερόλεπτα`). */
  readonly value: string;
  readonly id: string;
}

/** `Timestamp` ↔ κείμενο χωρίς απώλεια: `<δευτερόλεπτα>.<νανοδευτερόλεπτα 9 ψηφία>`. */
const TIMESTAMP_VALUE = /^(-?\d+)\.(\d{9})$/;

function encodeTimestampValue(seconds: number, nanoseconds: number): string {
  return `${seconds}.${String(nanoseconds).padStart(9, '0')}`;
}

/** Η κωδικοποιημένη τιμή είναι έγκυρη για το είδος της ταξινόμησης; (κρίνεται στην αποκωδικοποίηση — 400, όχι 500) */
function isValidOrderValue(kind: KeysetOrderKind, value: string): boolean {
  return kind === 'timestamp' ? TIMESTAMP_VALUE.test(value) : value.length > 0;
}

/** Η τιμή που δέχεται το `startAfter` — το ίδιο είδος με το πεδίο, αλλιώς ο Firestore θα συνέκρινε άλλο τύπο. */
function startAfterValue(kind: KeysetOrderKind, value: string): string | Timestamp {
  if (kind === 'string') return value;
  const [, seconds, nanoseconds] = TIMESTAMP_VALUE.exec(value) ?? [];
  return new Timestamp(Number(seconds), Number(nanoseconds));
}

/** Αποτύπωμα «ποιο ερώτημα»: ίδια φίλτρα + ίδια ταξινόμηση ⇔ ίδιο αποτύπωμα, ανεξάρτητα από τη σειρά των κλειδιών. */
function scopeFingerprint(order: KeysetOrder, scope: KeysetScope): string {
  // Κανονική μορφή: το `'string'` είναι η προεπιλογή ⇒ ρητό ή απόν δίνει το ΙΔΙΟ αποτύπωμα (και ίδιο με πριν το `kind`).
  const { field, direction, kind } = order;
  const canonicalOrder = kind === 'timestamp' ? { field, direction, kind } : { field, direction };
  return createHash('sha256').update(canonicalJson({ order: canonicalOrder, scope })).digest('base64url').slice(0, 16);
}

export function encodeKeysetCursor(position: KeysetPosition, order: KeysetOrder, scope: KeysetScope): string {
  return encodePageToken({ v: position.value, i: position.id, f: scopeFingerprint(order, scope) });
}

/**
 * Token → θέση (`null` token ⇒ `null`, η πρώτη σελίδα), ή `InvalidPageTokenError` αν είναι χαλασμένο ή άλλου
 * ερωτήματος. Καλείται **πριν** από την ανάγνωση: μια άρνηση του πελάτη δεν είναι βλάβη της βάσης.
 */
export function decodeKeysetCursor(raw: string | null, order: KeysetOrder, scope: KeysetScope): KeysetPosition | null {
  if (raw === null) return null;
  const fields = decodePageToken(raw, ['v', 'i', 'f']);
  if (fields === null || fields.f !== scopeFingerprint(order, scope)) throw new InvalidPageTokenError();
  if (!isValidOrderValue(order.kind ?? 'string', fields.v)) throw new InvalidPageTokenError();
  return { value: fields.v, id: fields.i };
}

function isTimestampLike(value: unknown): value is { readonly seconds: number; readonly nanoseconds: number } {
  if (typeof value !== 'object' || value === null) return false;
  const { seconds, nanoseconds } = value as { seconds?: unknown; nanoseconds?: unknown };
  return Number.isInteger(seconds) && Number.isInteger(nanoseconds);
}

/**
 * Η τιμή ταξινόμησης μιας γραμμής, κωδικοποιημένη. Το `orderBy` αποκλείει ήδη έγγραφα χωρίς το πεδίο· αν βρεθεί άλλος
 * τύπος, είναι βλάβη δεδομένων — την **ονομάζουμε** αντί να βγάλουμε δρομέα που θα έδειχνε σε λάθος θέση.
 */
function orderValueOf(data: DocumentData, order: KeysetOrder, id: string): string {
  const value: unknown = data[order.field];
  if ((order.kind ?? 'string') === 'timestamp') {
    if (!isTimestampLike(value)) {
      throw new Error(`Keyset order field "${order.field}" is not a Timestamp on document ${id}`);
    }
    return encodeTimestampValue(value.seconds, value.nanoseconds);
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Keyset order field "${order.field}" is not a non-empty string on document ${id}`);
  }
  return value;
}

/** **Μία σελίδα**: `(πεδίο, id)` στην ίδια φορά, `startAfter` τη θέση του δρομέα, `limit + 1`. */
export async function readKeysetPage<T>(spec: KeysetPageSpec<T>): Promise<PaginatedResult<T>> {
  const { base, order, scope, pageSize, after } = spec;
  let query = base.orderBy(order.field, order.direction).orderBy(FieldPath.documentId(), order.direction);
  if (after !== null) query = query.startAfter(startAfterValue(order.kind ?? 'string', after.value), after.id);

  const docs = (await query.limit(pageSize + 1).get()).docs;
  const visible = docs.slice(0, pageSize);
  const last = visible[visible.length - 1];
  const hasNext = docs.length > pageSize && last !== undefined;

  return {
    items: visible.map((doc) => spec.map(doc.data(), doc.id)),
    hasNext,
    nextCursor: hasNext
      ? encodeKeysetCursor({ value: orderValueOf(last.data(), order, last.id), id: last.id }, order, scope)
      : null,
    pageSize,
  };
}
