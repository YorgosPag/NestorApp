import 'server-only';

/**
 * @fileoverview Η αποθήκη των **συνεδριών πληρωμής** (`accounting_payment_checkouts`) — ADR-ACC-030 §5
 * @description Μία συνεδρία = μία απόπειρα online πληρωμής από τον σύνδεσμο: τρόπος, ποσό (από τον διακομιστή),
 *   πάροχος και τα αναγνωριστικά του. Μόνο Admin SDK (κανόνες deny-all). Η ανάγνωση περνά από φρουρούς: ένα έγγραφο
 *   που δεν έχει τη σωστή μορφή είναι **ανύπαρκτο**, ποτέ «περίπου σωστό».
 *
 *   Οι αναζητήσεις με αναγνωριστικό παρόχου είναι **συστημικές** (webhook / συμφιλίωση): το αναγνωριστικό είναι
 *   μοναδικό σε όλη την πλατφόρμα και η εταιρεία βγαίνει **από** το έγγραφο, άρα δεν υπάρχει μισθωτής να φιλτραριστεί.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isOneOf, plainRecordOrNull, trimmedStringOrNull } from '@/lib/type-guards';
import { isOnlinePaymentMethod, type OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';

import { isPaymentProviderId, type CheckoutSubject, type PaymentProviderId } from './payment-provider';

export const PAYMENT_CHECKOUT_STATUSES = ['pending', 'paid', 'failed', 'expired', 'canceled'] as const;

export type PaymentCheckoutStatus = (typeof PAYMENT_CHECKOUT_STATUSES)[number];

export interface PaymentCheckoutRecord {
  readonly checkoutId: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly shareId: string;
  readonly provider: PaymentProviderId;
  readonly method: OnlinePaymentMethod;
  readonly amountMinor: number;
  readonly currency: 'EUR';
  readonly status: PaymentCheckoutStatus;
  /** Η συνεδρία στον πάροχο (π.χ. `pnt_…`), όταν υπάρχει. */
  readonly providerReference: string | null;
  /** Η πληρωμή στον πάροχο (π.χ. `pmt_…`), όταν εισπράχθηκε — δένει τις επιστροφές με τη συνεδρία. */
  readonly paymentReference: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly updatedAt: string;
}

export type PaymentCheckoutPatch = Partial<Pick<PaymentCheckoutRecord, 'status' | 'providerReference' | 'paymentReference'>>;

function checkoutsOf(db: Firestore) {
  return db.collection(COLLECTIONS.ACCOUNTING_PAYMENT_CHECKOUTS);
}

/** Έγγραφο ⇒ συνεδρία, ή `null` όταν λείπει κάποιο υποχρεωτικό πεδίο ή έχει άλλη μορφή. */
export function checkoutRecordOf(checkoutId: string, data: unknown): PaymentCheckoutRecord | null {
  const raw = plainRecordOrNull(data);
  const text = (key: string) => trimmedStringOrNull(raw?.[key]);
  const [companyId, invoiceId, shareId, createdAt, expiresAt] =
    ['companyId', 'invoiceId', 'shareId', 'createdAt', 'expiresAt'].map(text);
  const fields: Record<string, unknown> = raw ?? {};
  const { amountMinor, provider, method, status, currency } = fields;
  if (!companyId || !invoiceId || !shareId || !createdAt || !expiresAt) return null;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  if (!isPaymentProviderId(provider) || !isOnlinePaymentMethod(method)) return null;
  if (!isOneOf(PAYMENT_CHECKOUT_STATUSES, status) || currency !== 'EUR') return null;
  return {
    checkoutId, companyId, invoiceId, shareId, provider, method, amountMinor,
    currency: 'EUR', status, providerReference: text('providerReference'),
    paymentReference: text('paymentReference'), createdAt, expiresAt, updatedAt: text('updatedAt') ?? createdAt,
  };
}

/** Ό,τι χρειάζεται ο πάροχος από μια συνεδρία. */
export function checkoutSubjectOf(record: PaymentCheckoutRecord): CheckoutSubject {
  const { checkoutId, method, amountMinor, currency, providerReference } = record;
  return { checkoutId, method, amountMinor, currency, providerReference };
}

export async function createPaymentCheckout(db: Firestore, record: PaymentCheckoutRecord): Promise<void> {
  await checkoutsOf(db).doc(record.checkoutId).create(record);
}

export async function readPaymentCheckout(db: Firestore, checkoutId: string): Promise<PaymentCheckoutRecord | null> {
  if (!checkoutId) return null;
  const snap = await checkoutsOf(db).doc(checkoutId).get();
  return snap.exists ? checkoutRecordOf(snap.id, snap.data()) : null;
}

export async function updatePaymentCheckout(
  db: Firestore, checkoutId: string, patch: PaymentCheckoutPatch, nowIso: string,
): Promise<void> {
  await checkoutsOf(db).doc(checkoutId).update({ ...patch, updatedAt: nowIso });
}

/** Η συνεδρία με αυτό το αναγνωριστικό παρόχου (`providerReference` ή `paymentReference`). */
export async function findPaymentCheckoutBy(
  db: Firestore,
  provider: PaymentProviderId,
  field: 'providerReference' | 'paymentReference',
  reference: string,
): Promise<PaymentCheckoutRecord | null> {
  // tenant-scope-exempt: συστημική αναζήτηση από υπογεγραμμένο webhook παρόχου — το αναγνωριστικό είναι μοναδικό σε
  // όλη την πλατφόρμα και ο μισθωτής διαβάζεται ΑΠΟ το έγγραφο· δεν υπάρχει μισθωτής του καλούντος να φιλτραριστεί.
  const snap = await checkoutsOf(db).where(field, '==', reference).limit(2).get();
  const records = snap.docs
    .map((doc) => checkoutRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentCheckoutRecord => record !== null && record.provider === provider);
  return records.length === 1 ? records[0] : null;
}

/** Οι ανοιχτές συνεδρίες ενός συνδέσμου — για να κλείσουν όταν ξεκινά νέα (καμία διπλή πληρωμή από ξεχασμένη καρτέλα). */
export async function listPendingCheckoutsOfShare(db: Firestore, shareId: string): Promise<PaymentCheckoutRecord[]> {
  // tenant-scope-exempt: ο σύνδεσμος ΕΙΝΑΙ η εμβέλεια (ο ανώνυμος κάτοχός του δεν έχει μισθωτή)· ένα shareId ανήκει
  // σε έναν μισθωτή, και ο καλών έχει ήδη επαληθεύσει ότι ο σύνδεσμος είναι ενεργός (`findActiveShareOf`).
  const snap = await checkoutsOf(db).where('shareId', '==', shareId).get();
  return snap.docs
    .map((doc) => checkoutRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentCheckoutRecord => record !== null && record.status === 'pending');
}

/** Ανοιχτές συνεδρίες που δημιουργήθηκαν πριν από το `beforeIso` — για τη συμφιλίωση (cron). */
export async function listStalePendingCheckouts(db: Firestore, beforeIso: string, limit: number): Promise<PaymentCheckoutRecord[]> {
  // tenant-scope-exempt: εργασία συστήματος (cron συμφιλίωσης) που ελέγχει τις ανοιχτές συνεδρίες ΚΑΘΕ μισθωτή εκ
  // σχεδιασμού· ο μισθωτής κάθε συνεδρίας διαβάζεται από το έγγραφό της.
  const snap = await checkoutsOf(db)
    .where('status', '==', 'pending')
    .where('createdAt', '<', beforeIso)
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();
  return snap.docs
    .map((doc) => checkoutRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentCheckoutRecord => record !== null);
}
