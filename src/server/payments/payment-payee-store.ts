import 'server-only';

/**
 * @fileoverview Η αποθήκη των **δικαιούχων marketplace** (`payment_payees`) — ADR-943 §5.7
 * @description Ένας δικαιούχος = ένας χρήστης (ο μηχανικός) ως πωλητής σε **έναν** πάροχο. Ταυτότητα ντετερμινιστική
 *   από `πάροχος:uid` ⇒ ΕΝΑ έγγραφο ανά ζεύγος, και δεύτερη `create` συγκρούεται. Μόνο Admin SDK (κανόνες deny-all).
 *
 *   Κρατά **μόνο** την αναφορά του παρόχου και την κατάσταση — **ποτέ** IBAN, ΑΦΜ ή έγγραφα ταυτοποίησης (ζουν στον PSP,
 *   ADR-943 §6.4). Η ανάγνωση περνά από φρουρούς: έγγραφο με άλλη μορφή είναι **ανύπαρκτο**, ποτέ «περίπου σωστό».
 *
 *   **Κράτηση θέσης** (`registering`): η εγγραφή στον πάροχο δεν έχει κλειδί ιδεμποτίας. Πριν από την κλήση γράφεται το
 *   έγγραφο **χωρίς** αναφορά, σε συναλλαγή· δεύτερος ταυτόχρονος καλών βρίσκει την κράτηση και **δεν** καλεί τον πάροχο.
 *   Κράτηση παλαιότερη από `REGISTRATION_LEASE_MS` (ο πρώτος κατέρρευσε) αναλαμβάνεται ξανά.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isOneOf, plainRecordOrNull, trimmedStringOrNull } from '@/lib/type-guards';
import { generateDeterministicPaymentPayeeId } from '@/services/enterprise-id.service';

import {
  PAYEE_KYC_STATUSES,
  PAYEE_STATUSES,
  type PayeeAccount,
  type PayeeKycStatus,
  type PayeeStatus,
} from './payment-marketplace';
import { isPaymentProviderId, type PaymentProviderId } from './payment-provider';

/** Πόσο ζει μια κράτηση θέσης εγγραφής πριν αναληφθεί ξανά (ο πάροχος απαντά σε ≤ 15″· περιθώριο για κατάρρευση). */
export const REGISTRATION_LEASE_MS = 10 * 60 * 1000;

export interface PaymentPayeeRecord {
  readonly payeeId: string;
  readonly userId: string;
  readonly provider: PaymentProviderId;
  /** Ο πωλητής στον πάροχο (`sel_…`)· `null` όσο η εγγραφή είναι σε κράτηση θέσης. */
  readonly providerReference: string | null;
  /** Από το API (`readPayee`) — το **μόνο** κριτήριο για μεταφορά χρημάτων. */
  readonly status: PayeeStatus;
  /** Από το webhook KYC — πληροφορία για τον άνθρωπο. */
  readonly kycStatus: PayeeKycStatus;
  readonly kycProcessUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Ό,τι μαθαίνουμε από τον πάροχο για έναν δικαιούχο (API και/ή webhook). */
export type PayeeObservation = Partial<Pick<PaymentPayeeRecord, 'status' | 'kycStatus' | 'kycProcessUrl'>>;

function payeesOf(db: Firestore) {
  return db.collection(COLLECTIONS.PAYMENT_PAYEES);
}

export function paymentPayeeIdOf(provider: PaymentProviderId, userId: string): string {
  return generateDeterministicPaymentPayeeId(`${provider}:${userId}`);
}

/** Έγγραφο ⇒ δικαιούχος, ή `null` όταν λείπει υποχρεωτικό πεδίο ή έχει άλλη μορφή. */
export function payeeRecordOf(payeeId: string, data: unknown): PaymentPayeeRecord | null {
  const raw = plainRecordOrNull(data);
  const text = (key: string) => trimmedStringOrNull(raw?.[key]);
  const [userId, createdAt] = [text('userId'), text('createdAt')];
  const { provider, status, kycStatus } = raw ?? {};
  if (userId === null || createdAt === null || !isPaymentProviderId(provider)) return null;
  if (!isOneOf(PAYEE_STATUSES, status) || !isOneOf(PAYEE_KYC_STATUSES, kycStatus)) return null;
  return {
    payeeId, userId, provider, providerReference: text('providerReference'), status, kycStatus,
    kycProcessUrl: text('kycProcessUrl'), createdAt, updatedAt: text('updatedAt') ?? createdAt,
  };
}

export async function readPaymentPayee(db: Firestore, provider: PaymentProviderId, userId: string): Promise<PaymentPayeeRecord | null> {
  const payeeId = paymentPayeeIdOf(provider, userId);
  const snap = await payeesOf(db).doc(payeeId).get();
  const record = snap.exists ? payeeRecordOf(snap.id, snap.data()) : null;
  return record !== null && record.userId === userId && record.provider === provider ? record : null;
}

/** Ο δικαιούχος με αυτόν τον πωλητή του παρόχου — για το webhook KYC. Δύο ⇒ κανένας (θέλει άνθρωπο). */
export async function findPaymentPayeeByReference(
  db: Firestore, provider: PaymentProviderId, providerReference: string,
): Promise<PaymentPayeeRecord | null> {
  // tenant-scope-exempt: συστημική αναζήτηση από υπογεγραμμένο webhook παρόχου — ο δικαιούχος είναι ΧΡΗΣΤΗΣ, όχι
  // μισθωτής, και η αναφορά πωλητή είναι μοναδική στον πάροχο· δεν υπάρχει μισθωτής του καλούντος να φιλτραριστεί.
  const snap = await payeesOf(db).where('providerReference', '==', providerReference).limit(2).get();
  const records = snap.docs
    .map((doc) => payeeRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentPayeeRecord => record !== null && record.provider === provider);
  return records.length === 1 ? records[0] : null;
}

export type PayeeReservation =
  /** Η θέση είναι δική μας — ο καλών καλεί τον πάροχο. */
  | { readonly kind: 'reserved' }
  /** Υπάρχει ήδη πωλητής — καμία κλήση στον πάροχο. */
  | { readonly kind: 'existing'; readonly record: PaymentPayeeRecord }
  /** Άλλος καλών εγγράφει αυτή τη στιγμή — καμία κλήση στον πάροχο. */
  | { readonly kind: 'in-progress' };

function reservationOf(userId: string, provider: PaymentProviderId, nowIso: string): Omit<PaymentPayeeRecord, 'payeeId'> {
  return {
    userId, provider, providerReference: null, status: 'unknown', kycStatus: 'unknown',
    kycProcessUrl: null, createdAt: nowIso, updatedAt: nowIso,
  };
}

/** Κράτηση θέσης εγγραφής, σε συναλλαγή (βλ. @description). */
export async function reservePaymentPayee(
  db: Firestore, provider: PaymentProviderId, userId: string, nowIso: string,
): Promise<PayeeReservation> {
  const ref = payeesOf(db).doc(paymentPayeeIdOf(provider, userId));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const record = snap.exists ? payeeRecordOf(snap.id, snap.data()) : null;
    if (record?.providerReference) return { kind: 'existing', record };
    const leaseAlive = record !== null && Date.parse(nowIso) - Date.parse(record.updatedAt) < REGISTRATION_LEASE_MS;
    if (leaseAlive) return { kind: 'in-progress' };
    tx.set(ref, { payeeId: ref.id, ...reservationOf(userId, provider, record?.createdAt ?? nowIso), updatedAt: nowIso });
    return { kind: 'reserved' };
  });
}

/** Ο πάροχος απάντησε στην εγγραφή ⇒ η κράτηση γίνεται δικαιούχος. */
export async function completePaymentPayee(
  db: Firestore, provider: PaymentProviderId, userId: string, account: PayeeAccount, nowIso: string,
): Promise<PaymentPayeeRecord> {
  const payeeId = paymentPayeeIdOf(provider, userId);
  const patch = { providerReference: account.reference, status: account.status, kycProcessUrl: account.kycProcessUrl, updatedAt: nowIso };
  await payeesOf(db).doc(payeeId).update(patch);
  const snap = await payeesOf(db).doc(payeeId).get();
  const record = payeeRecordOf(snap.id, snap.data());
  if (record === null) throw new Error(`Payee ${payeeId} unreadable after completion`);
  return record;
}

export type PayeeObservationOutcome = 'payee-updated' | 'unchanged' | 'unknown';

/** Τα πεδία που αλλάζει μια παρατήρηση — κλειστή λίστα (κανένα άλλο πεδίο δεν γράφεται από webhook). */
const OBSERVED_FIELDS = ['status', 'kycStatus', 'kycProcessUrl'] as const;

/** Εφαρμόζει ό,τι παρατηρήθηκε στον πάροχο, σε συναλλαγή. Ίδιες τιμές ⇒ `unchanged` (ιδεμποτικό). */
export async function observePaymentPayee(
  db: Firestore, payeeId: string, observation: PayeeObservation, nowIso: string,
): Promise<PayeeObservationOutcome> {
  const ref = payeesOf(db).doc(payeeId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const record = snap.exists ? payeeRecordOf(snap.id, snap.data()) : null;
    if (record === null) return 'unknown';
    const patch: Record<string, string | null> = {};
    for (const key of OBSERVED_FIELDS) {
      const value = observation[key];
      if (value !== undefined && value !== record[key]) patch[key] = value;
    }
    if (Object.keys(patch).length === 0) return 'unchanged';
    tx.update(ref, { ...patch, updatedAt: nowIso });
    return 'payee-updated';
  });
}
