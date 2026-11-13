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

import type { ProviderClockEcho, ProviderMovement } from '../../payment-provider';

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
export function listPageOrNull(body: unknown): EverypayListPage | null {
  const record = plainRecordOrNull(body);
  const items = record?.items;
  const totalCount = record?.total_count;
  if (!Array.isArray(items) || typeof totalCount !== 'number' || !Number.isSafeInteger(totalCount) || totalCount < 0) {
    return null;
  }
  return { items: items.filter(isPlainRecord), totalCount };
}

/** Μία σελίδα λίστας: οι εγγραφές της και το **σύνολο** των εγγραφών του ερωτήματος (`total_count`). */
export interface EverypayListPage {
  readonly items: Record<string, unknown>[];
  readonly totalCount: number;
}

/** Το αναγνωριστικό της πληρωμής μιας ειδοποίησης: κείμενο (`pmt_…`) ή αντικείμενο με `token`. */
export function notificationPaymentReference(notification: Record<string, unknown> | null): string | null {
  const payment = notification?.payment;
  if (isNonEmptyTrimmedString(payment)) return payment.trim();
  return textField(plainRecordOrNull(payment), 'token');
}

/** Οι καταστάσεις πληρωμής που σημαίνουν «τα χρήματα εισπράχθηκαν» (και ίσως επιστράφηκαν μετά). */
export const CAPTURED_PAYMENT_STATUSES: ReadonlySet<string> = new Set(['captured', 'refunded', 'partiallyrefunded', 'disputed']);

/**
 * Στιγμή του παρόχου ως ISO 8601, ή `null`. Η Everypay γράφει με μετατόπιση χωρίς άνω-κάτω τελεία
 * (`2025-10-02T16:20:32+0200`).
 */
export function instantField(record: Record<string, unknown> | null, key: string): string | null {
  return normalizeToISO(textField(record, key));
}

/** Οι χρόνοι μιας συνεδρίας (ειδοποίηση · IRIS) **όπως ήρθαν**, για τη διάγνωση της έναρξης (ADR-ACC-030 §5.8 #6). */
export function providerClockOf(record: Record<string, unknown> | null): ProviderClockEcho {
  return { createdAt: textField(record, 'date_created'), expiresAt: textField(record, 'expiration_date') };
}

function occurredAtOf(record: Record<string, unknown>): string {
  return instantField(record, 'date_created') ?? nowISO();
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
