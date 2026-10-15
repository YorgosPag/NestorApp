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
import { FieldPath, type DocumentData, type Query } from 'firebase-admin/firestore';

import { decodePageToken, encodePageToken } from '@/lib/api/page-token';
import { canonicalJson } from '@/lib/legal/canonical-json';
import type { PaginatedResult } from '@/lib/pagination';

/** Η ταξινόμηση της λίστας. Το πεδίο πρέπει να κρατά **κείμενο** (π.χ. `YYYY-MM-DD`) — βλ. `orderValueOf`. */
export interface KeysetOrder {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
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
  readonly map: (data: DocumentData) => T;
}

/** Ο δρομέας είναι χαλασμένος ή ανήκει σε **άλλο** ερώτημα — ο καλών απαντά 400. */
export class InvalidPageTokenError extends Error {
  constructor() {
    super('Invalid page cursor for this query');
    this.name = 'InvalidPageTokenError';
  }
}

export interface KeysetPosition {
  readonly value: string;
  readonly id: string;
}

/** Αποτύπωμα «ποιο ερώτημα»: ίδια φίλτρα + ίδια ταξινόμηση ⇔ ίδιο αποτύπωμα, ανεξάρτητα από τη σειρά των κλειδιών. */
function scopeFingerprint(order: KeysetOrder, scope: KeysetScope): string {
  return createHash('sha256').update(canonicalJson({ order, scope })).digest('base64url').slice(0, 16);
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
  return { value: fields.v, id: fields.i };
}

/**
 * Η τιμή ταξινόμησης μιας γραμμής. Το `orderBy` αποκλείει ήδη έγγραφα χωρίς το πεδίο· αν βρεθεί άλλος τύπος, είναι
 * βλάβη δεδομένων — την **ονομάζουμε** αντί να βγάλουμε δρομέα που θα έδειχνε σε λάθος θέση.
 */
function orderValueOf(data: DocumentData, field: string, id: string): string {
  const value: unknown = data[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Keyset order field "${field}" is not a non-empty string on document ${id}`);
  }
  return value;
}

/** **Μία σελίδα**: `(πεδίο, id)` στην ίδια φορά, `startAfter` τη θέση του δρομέα, `limit + 1`. */
export async function readKeysetPage<T>(spec: KeysetPageSpec<T>): Promise<PaginatedResult<T>> {
  const { base, order, scope, pageSize, after } = spec;
  let query = base.orderBy(order.field, order.direction).orderBy(FieldPath.documentId(), order.direction);
  if (after !== null) query = query.startAfter(after.value, after.id);

  const docs = (await query.limit(pageSize + 1).get()).docs;
  const visible = docs.slice(0, pageSize);
  const last = visible[visible.length - 1];
  const hasNext = docs.length > pageSize && last !== undefined;

  return {
    items: visible.map((doc) => spec.map(doc.data())),
    hasNext,
    nextCursor: hasNext
      ? encodeKeysetCursor({ value: orderValueOf(last.data(), order.field, last.id), id: last.id }, order, scope)
      : null,
    pageSize,
  };
}
