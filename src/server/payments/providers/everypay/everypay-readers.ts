/**
 * @fileoverview Αναγνώστες απαντήσεων Everypay — `unknown` ⇒ τύποι του port, **χωρίς** `as` (ADR-ACC-030 §4)
 * @description Ο πάροχος επιστρέφει JSON που δεν ελέγχουμε. Κάθε πεδίο διαβάζεται με φρουρό· ό,τι λείπει ή έχει
 *   άλλη μορφή γίνεται `null`, και ο adapter αποφασίζει (συνήθως «ακόμη ανοιχτό» — ποτέ «πληρώθηκε» από
 *   ελλιπή δεδομένα). Τα ποσά είναι ακέραια λεπτά· δεκτό και αριθμητικό κείμενο.
 *
 * @see https://docs.everypay.gr/api-reference/
 */

import { normalizeToISO, nowISO } from '@/lib/date-local';
import { isNonEmptyTrimmedString, isPlainRecord, plainRecordOrNull } from '@/lib/type-guards';

import type { ProviderMovement } from '../../payment-provider';

export function textField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return isNonEmptyTrimmedString(value) ? value.trim() : null;
}

/**
 * Κωδικός του παρόχου ως κείμενο (`41001`), ή `null`. Η τεκμηρίωση τον δείχνει **και** ως αριθμό (webhook JSON)
 * **και** ως κείμενο (πεδίο φόρμας του callback) — ένας αναγνώστης για τις δύο μορφές.
 */
export function codeField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  const text = textField(record, key);
  return text !== null && /^[A-Za-z0-9_.-]{1,32}$/.test(text) ? text : null;
}

/** Ακέραιο ποσό σε λεπτά, ή `null`. */
export function minorAmountField(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  const parsed = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Κατάσταση σε πεζά, χωρίς κενά/παύλες (`'Partially Refunded'` ⇒ `'partiallyrefunded'`). */
export function statusField(record: Record<string, unknown> | null): string | null {
  const status = textField(record, 'status');
  return status === null ? null : status.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Οι εγγραφές μιας απάντησης λίστας (`GET /payments` · `GET /refunds`): `{ total_count, items: [...] }` — η μορφή
 * της τεκμηρίωσης, **μόνο** αυτή. Άλλη μορφή ⇒ `null`, ποτέ `[]`: μια κενή λίστα από απάντηση που δεν καταλάβαμε
 * σημαίνει «καμία επιστροφή» και καταγράφεται σιωπηλά ως `unchanged` (ADR-ACC-030 §5.9 #6 — έτσι χάθηκε επιστροφή).
 */
export function listItemsOrNull(body: unknown): Record<string, unknown>[] | null {
  const items = plainRecordOrNull(body)?.items;
  return Array.isArray(items) ? items.filter(isPlainRecord) : null;
}

/** Το αναγνωριστικό της πληρωμής μιας ειδοποίησης: κείμενο (`pmt_…`) ή αντικείμενο με `token`. */
export function notificationPaymentReference(notification: Record<string, unknown> | null): string | null {
  const payment = notification?.payment;
  if (isNonEmptyTrimmedString(payment)) return payment.trim();
  return textField(plainRecordOrNull(payment), 'token');
}

/** Οι καταστάσεις πληρωμής που σημαίνουν «τα χρήματα εισπράχθηκαν» (και ίσως επιστράφηκαν μετά). */
export const CAPTURED_PAYMENT_STATUSES: ReadonlySet<string> = new Set(['captured', 'refunded', 'partiallyrefunded', 'disputed']);

function occurredAtOf(record: Record<string, unknown>): string {
  return normalizeToISO(textField(record, 'date_created')) ?? nowISO();
}

/** Μία κίνηση από εγγραφή πληρωμής ή επιστροφής του παρόχου· `null` αν λείπει ταυτότητα ή ποσό. */
export function movementOf(record: Record<string, unknown>, kind: ProviderMovement['kind']): ProviderMovement | null {
  const reference = textField(record, 'token');
  const amountMinor = minorAmountField(record, 'amount');
  if (reference === null || amountMinor === null || amountMinor === 0) return null;
  const currency = (textField(record, 'currency') ?? 'EUR').toUpperCase();
  if (currency !== 'EUR') return null;
  return { kind, reference, amountMinor, currency: 'EUR', occurredAt: occurredAtOf(record) };
}
