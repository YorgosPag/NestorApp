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

import type { Firestore, QuerySnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isOneOf, plainRecordOrNull, trimmedStringOrNull } from '@/lib/type-guards';
import { isOnlinePaymentMethod, type OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';

import { payableSubjectOf, sameAttemptScope, storedPayableSubjectOf, type PayableSubject } from './payable-subject';
import { isPaymentProviderId, type CheckoutSubject, type PaymentProviderId } from './payment-provider';

export const PAYMENT_CHECKOUT_STATUSES = ['pending', 'paid', 'failed', 'expired', 'canceled'] as const;

export type PaymentCheckoutStatus = (typeof PAYMENT_CHECKOUT_STATUSES)[number];

/**
 * Η τελευταία **αρνημένη απόπειρα** μιας ανοιχτής συνεδρίας (πρότυπο Stripe `last_payment_error`) — ADR-ACC-030 §5.3.
 * Δεν είναι κατάσταση: η συνεδρία μένει `pending`, ώστε συμφιλίωση και κλείσιμο (που κοιτούν **μόνο** `pending`)
 * να μη χάσουν ποτέ πληρωμή που ήρθε αργότερα. Το `failed` του `PAYMENT_CHECKOUT_STATUSES` είναι άλλο πράγμα: ο
 * πάροχος αρνήθηκε την **έναρξη**.
 */
export interface PaymentCheckoutFailure {
  readonly code: 'authorization-failed';
  /** Ο κωδικός του παρόχου (π.χ. `41001`), όταν τον υπέγραψε. Ποτέ μήνυμα — δεν μεταφράζεται και δεν δείχνεται. */
  readonly providerCode: string | null;
  readonly at: string;
}

/**
 * ADR-943 §5.9 — η **κράτηση marketplace** μιας συνεδρίας: τα χρήματα είναι τρίτου (`split=1`) και περνούν στον δικαιούχο
 * με **μία** κρατημένη μεταφορά μετά την είσπραξη. Ζει στη **συνεδρία** — η μεταφορά είναι «αυτής της πληρωμής», και το
 * έγγραφο είναι ήδη αυτό που βρίσκουν webhook, συμφιλίωση και επιστροφή browser (καμία νέα συλλογή, κανένας νέος κανόνας).
 */
export interface CheckoutMarketplace {
  /** Ο δικαιούχος στον πάροχο (EveryPay `sel_…`), κριμένος `authorized` στην έναρξη. */
  readonly payeeReference: string;
  /** Η μεταφορά, όταν δημιουργήθηκε (EveryPay `trn_…`). */
  readonly transferReference: string | null;
  /** Η είσπραξη καταγράφηκε και η μεταφορά **οφείλεται** — το πεδίο του διχτυού ασφαλείας (cron). */
  readonly transferDue: boolean;
  /**
   * Η **μίσθωση** της δημιουργίας μεταφοράς: οι δηλωτικές πράξεις του παρόχου είναι ιδεμποτικές **διαδοχικά**, όχι
   * ταυτόχρονα (webhook + cron + επιστροφή browser). Μόνο ο κάτοχος ζωντανής μίσθωσης μιλά στον πάροχο.
   */
  readonly lease: { readonly holder: string; readonly until: string } | null;
  /**
   * ADR-943 Φ5 (Ζ-6) — η **εντολή διακανονισμού** που οφείλεται: πόσα επιστρέφονται στον πληρωτή, πόσα αποδεσμεύονται
   * στον δικαιούχο, γιατί, και από πότε. Γράφεται **πριν** από κάθε κίνηση χρημάτων και σβήνει μόνο όταν ολοκληρωθεί·
   * τη βλέπει το cron (`listCheckoutsWithDueSettlement`). `null` ⇒ καμία εκκρεμής κίνηση.
   */
  readonly settlement: CheckoutSettlementOrder | null;
}

/**
 * Γιατί κινούνται τα κρατημένα χρήματα — ο ίδιος λόγος γράφεται και στο γεγονός της αποδέσμευσης. Κάθε λόγος μπαίνει
 * **μαζί** με τον παραγωγό του (απόφαση Giorgio Α1): Φ5α η αυτόματη αποδέσμευση (`window-elapsed`)· Φ5γ η ακύρωση
 * (`cancellation`), η απόφαση γραφείου σε διαφορά (`office-resolution`) — οι τρεις του τομέα,
 * `ADVANCE_RELEASE_BASES` — και η άρνηση είσπραξης (`refused-payment`: χρήματα που ο τομέας δεν δέχτηκε, πάντα όλα πίσω).
 */
export const SETTLEMENT_BASES = ['window-elapsed', 'cancellation', 'office-resolution', 'refused-payment'] as const;

export type SettlementBasis = (typeof SETTLEMENT_BASES)[number];

/** Η εντολή διακανονισμού — **δηλωτική**: τελικά ποσά, ποτέ «κάνε άλλη μία επιστροφή». */
export interface CheckoutSettlementOrder {
  /** Συνολικά επιστραμμένα στον πληρωτή (λεπτά). */
  readonly refundMinor: number;
  /** Συνολικά αποδεσμευμένα στον δικαιούχο (λεπτά). Μαζί με το `refundMinor` = όλο το ποσό της συνεδρίας. */
  readonly releaseMinor: number;
  readonly basis: SettlementBasis;
  /** Από πότε εκτελείται (ISO)· η αυτόματη αποδέσμευση = το τέλος του παραθύρου αντίρρησης. */
  readonly dueAt: string;
}

/** Ίδια εντολή; — ίδια ποσά, ίδιος λόγος, ίδια στιγμή. Η ΜΙΑ σύγκριση (εκτελεστής · κρίση του είδους). */
export function sameSettlementOrder(a: CheckoutSettlementOrder, b: CheckoutSettlementOrder): boolean {
  return a.refundMinor === b.refundMinor && a.releaseMinor === b.releaseMinor && a.basis === b.basis && a.dueAt === b.dueAt;
}

export interface PaymentCheckoutRecord {
  readonly checkoutId: string;
  readonly companyId: string;
  /** Τι πληρώνεται (ADR-943 §5.6) — στη βάση: πεδία στο πάνω επίπεδο + `subjectKind` (`payable-subject.ts`). */
  readonly subject: PayableSubject;
  readonly provider: PaymentProviderId;
  readonly method: OnlinePaymentMethod;
  readonly amountMinor: number;
  readonly currency: 'EUR';
  readonly status: PaymentCheckoutStatus;
  /** Η συνεδρία στον πάροχο (π.χ. `pnt_…`), όταν υπάρχει. */
  readonly providerReference: string | null;
  /** Η πληρωμή στον πάροχο (π.χ. `pmt_…`), όταν εισπράχθηκε — δένει τις επιστροφές με τη συνεδρία. */
  readonly paymentReference: string | null;
  readonly lastFailure: PaymentCheckoutFailure | null;
  /** ADR-943 — `null` ⇒ πληρωμή στον λογαριασμό εμπόρου (τιμολόγιο)· αλλιώς `split=1` και κρατημένη μεταφορά. */
  readonly marketplace: CheckoutMarketplace | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly updatedAt: string;
}

export type PaymentCheckoutPatch = Partial<
  Pick<PaymentCheckoutRecord, 'status' | 'providerReference' | 'paymentReference' | 'expiresAt'>
>;

function checkoutsOf(db: Firestore) {
  return db.collection(COLLECTIONS.ACCOUNTING_PAYMENT_CHECKOUTS);
}

/** Η αποθηκευμένη αποτυχία, ή `null` όταν λείπει / έχει άλλη μορφή (ποτέ «περίπου σωστή»). */
function checkoutFailureOf(data: unknown): PaymentCheckoutFailure | null {
  const raw = plainRecordOrNull(data);
  const at = trimmedStringOrNull(raw?.at);
  const providerCode = raw?.providerCode;
  if (raw?.code !== 'authorization-failed' || at === null) return null;
  if (providerCode !== null && typeof providerCode !== 'string') return null;
  return { code: 'authorization-failed', providerCode, at };
}

function leaseOf(data: unknown): CheckoutMarketplace['lease'] {
  const raw = plainRecordOrNull(data);
  const holder = trimmedStringOrNull(raw?.holder);
  const until = trimmedStringOrNull(raw?.until);
  return holder === null || until === null ? null : { holder, until };
}

function isNonNegativeMinor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Η εντολή διακανονισμού, ή `null` όταν λείπει· ⚠️ υπάρχει αλλά δεν διαβάζεται ⇒ `'unreadable'` (ποτέ «καμία εντολή»). */
function settlementOrderOf(data: unknown): CheckoutSettlementOrder | null | 'unreadable' {
  if (data === undefined || data === null) return null;
  const raw = plainRecordOrNull(data);
  const dueAt = trimmedStringOrNull(raw?.dueAt);
  const { refundMinor, releaseMinor, basis } = raw ?? {};
  if (dueAt === null || !isOneOf(SETTLEMENT_BASES, basis)) return 'unreadable';
  if (!isNonNegativeMinor(refundMinor) || !isNonNegativeMinor(releaseMinor)) return 'unreadable';
  return { refundMinor, releaseMinor, basis, dueAt };
}

/**
 * Η κράτηση marketplace, ή `null` όταν λείπει (τιμολόγιο). ⚠️ Υπάρχει αλλά δεν διαβάζεται ⇒ `'unreadable'`: η συνεδρία
 * είναι τότε **ανύπαρκτη** — ποτέ «χωρίς κράτηση», που θα έστελνε χρήματα τρίτου στον λογαριασμό εμπόρου.
 */
function checkoutMarketplaceOf(data: unknown): CheckoutMarketplace | null | 'unreadable' {
  if (data === undefined || data === null) return null;
  const raw = plainRecordOrNull(data);
  const payeeReference = trimmedStringOrNull(raw?.payeeReference);
  const transferReference = raw?.transferReference;
  if (payeeReference === null || typeof raw?.transferDue !== 'boolean') return 'unreadable';
  if (transferReference !== null && typeof transferReference !== 'string') return 'unreadable';
  const settlement = settlementOrderOf(raw?.settlement);
  if (settlement === 'unreadable') return 'unreadable';
  return { payeeReference, transferReference, transferDue: raw?.transferDue === true, lease: leaseOf(raw?.lease), settlement };
}

/** Έγγραφο ⇒ συνεδρία, ή `null` όταν λείπει κάποιο υποχρεωτικό πεδίο ή έχει άλλη μορφή (και άγνωστο είδος αντικειμένου). */
export function checkoutRecordOf(checkoutId: string, data: unknown): PaymentCheckoutRecord | null {
  const raw = plainRecordOrNull(data);
  const text = (key: string) => trimmedStringOrNull(raw?.[key]);
  const [companyId, createdAt, expiresAt] = ['companyId', 'createdAt', 'expiresAt'].map(text);
  const subject = payableSubjectOf(raw);
  const fields: Record<string, unknown> = raw ?? {};
  const { amountMinor, provider, method, status, currency } = fields;
  if (!companyId || subject === null || !createdAt || !expiresAt) return null;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  if (!isPaymentProviderId(provider) || !isOnlinePaymentMethod(method)) return null;
  if (!isOneOf(PAYMENT_CHECKOUT_STATUSES, status) || currency !== 'EUR') return null;
  const marketplace = checkoutMarketplaceOf(raw?.marketplace);
  // Χρήματα τρίτου (προκαταβολή) χωρίς αναγνώσιμη κράτηση ⇒ ανύπαρκτη συνεδρία, ποτέ πληρωμή εμπόρου.
  if (marketplace === 'unreadable' || (subject.kind === 'issuance-advance') !== (marketplace !== null)) return null;
  return {
    checkoutId, companyId, subject, provider, method, amountMinor,
    currency: 'EUR', status, providerReference: text('providerReference'),
    paymentReference: text('paymentReference'), lastFailure: checkoutFailureOf(raw?.lastFailure), marketplace,
    createdAt, expiresAt, updatedAt: text('updatedAt') ?? createdAt,
  };
}

/** Ό,τι χρειάζεται ο πάροχος από μια συνεδρία. */
export function checkoutSubjectOf(record: PaymentCheckoutRecord): CheckoutSubject {
  const { checkoutId, method, amountMinor, currency, providerReference } = record;
  return { checkoutId, method, amountMinor, currency, providerReference, split: record.marketplace !== null };
}

/** Συνεδρία ⇒ έγγραφο. Το αντικείμενο γράφεται με τον **έναν** κωδικοποιητή του (`storedPayableSubjectOf`). */
export function storedCheckoutOf(record: PaymentCheckoutRecord): Record<string, unknown> {
  const { subject, ...rest } = record;
  return { ...rest, ...storedPayableSubjectOf(subject) };
}

export async function createPaymentCheckout(db: Firestore, record: PaymentCheckoutRecord): Promise<void> {
  await checkoutsOf(db).doc(record.checkoutId).create(storedCheckoutOf(record));
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

export type CheckoutFailureOutcome = 'failure-noted' | 'unchanged' | 'unknown';

/**
 * Σημειώνει αρνημένη απόπειρα (webhook **και** επιστροφή browser — ίδια υπογραφή παρόχου, ADR-ACC-030 §5.3–5.4).
 * Σε συναλλαγή: γράφει **μόνο** σε `pending` συνεδρία του ίδιου παρόχου και δεν αγγίζει κατάσταση ή χρήματα.
 * Ιδεμποτικό: η ίδια αποτυχία ξανά ⇒ `unchanged`. Πληρωμένη / κλειστή ⇒ `unchanged` (η αλήθεια έχει προχωρήσει).
 */
export async function recordCheckoutFailure(
  db: Firestore,
  provider: PaymentProviderId,
  checkoutId: string,
  failure: Omit<PaymentCheckoutFailure, 'at'>,
  nowIso: string,
): Promise<CheckoutFailureOutcome> {
  const ref = checkoutsOf(db).doc(checkoutId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const record = snap.exists ? checkoutRecordOf(snap.id, snap.data()) : null;
    if (record === null || record.provider !== provider) return 'unknown';
    if (record.status !== 'pending') return 'unchanged';
    const known = record.lastFailure;
    if (known !== null && known.code === failure.code && known.providerCode === failure.providerCode) return 'unchanged';
    const lastFailure: PaymentCheckoutFailure = { ...failure, at: nowIso };
    tx.update(ref, { lastFailure, updatedAt: nowIso });
    return 'failure-noted';
  });
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

/** Τα έγγραφα της εμβέλειας απόπειρας ενός αντικειμένου — ένα ρητό ερώτημα ανά είδος (ορατό στις πύλες δεικτών). */
async function attemptScopeDocsOf(db: Firestore, subject: PayableSubject) {
  switch (subject.kind) {
    case 'invoice':
      // tenant-scope-exempt: ο σύνδεσμος ΕΙΝΑΙ η εμβέλεια (ο ανώνυμος κάτοχός του δεν έχει μισθωτή)· ένα shareId ανήκει
      // σε έναν μισθωτή, και ο καλών έχει ήδη επαληθεύσει ότι ο σύνδεσμος είναι ενεργός (`findActiveShareOf`).
      return (await checkoutsOf(db).where('shareId', '==', subject.shareId).get()).docs;
    case 'issuance-advance':
      return advanceScopeDocsOf(db, subject.companyId, subject.assignmentId);
  }
}

/** Οι συνεδρίες προκαταβολής μιας ανάθεσης — δύο ισότητες ⇒ μονο-πεδιακοί δείκτες· ο μισθωτής ρητά (CHECK 3.10 · 3.35). */
async function advanceScopeDocsOf(db: Firestore, companyId: string, assignmentId: string) {
  return (await checkoutsOf(db)
    .where('companyId', '==', companyId)
    .where('assignmentId', '==', assignmentId)
    .get()).docs;
}

/** Οι συνεδρίες marketplace των οποίων η μεταφορά **οφείλεται** — το δίχτυ ασφαλείας του cron (ADR-943 §5.9). */
export async function listCheckoutsAwaitingTransfer(db: Firestore, limit: number): Promise<PaymentCheckoutRecord[]> {
  // tenant-scope-exempt: εργασία συστήματος (cron) πάνω σε ΚΑΘΕ μισθωτή εκ σχεδιασμού· ο μισθωτής κάθε συνεδρίας
  // διαβάζεται από το έγγραφό της. Μία ισότητα ⇒ αυτόματος δείκτης.
  return readableCheckoutsOf(await checkoutsOf(db).where('marketplace.transferDue', '==', true).limit(limit).get());
}

/**
 * ADR-943 Φ5 — οι συνεδρίες με εντολή διακανονισμού που **οφείλεται τώρα** (cron). Μία ανισότητα σε ένα πεδίο, χωρίς
 * ταξινόμηση ⇒ αυτόματος μονο-πεδιακός δείκτης.
 */
export async function listCheckoutsWithDueSettlement(db: Firestore, nowIso: string, limit: number): Promise<PaymentCheckoutRecord[]> {
  // tenant-scope-exempt: εργασία συστήματος (cron) πάνω σε ΚΑΘΕ μισθωτή εκ σχεδιασμού· ο μισθωτής κάθε συνεδρίας
  // διαβάζεται από το έγγραφό της.
  return readableCheckoutsOf(await checkoutsOf(db).where('marketplace.settlement.dueAt', '<=', nowIso).limit(limit).get());
}

/**
 * ADR-943 Φ5 — **η πληρωμένη συνεδρία** μιας προκαταβολής: της ίδιας ανάθεσης, με την πληρωμή του γεγονότος `funded`.
 * Το ίδιο ρητό ερώτημα εμβέλειας με την έναρξη (μισθωτής + ανάθεση)· `null` ⇒ καμία ή αμφίσημη (ποτέ «η πρώτη»).
 */
export async function findFundedAdvanceCheckout(
  db: Firestore, companyId: string, assignmentId: string, paymentReference: string,
): Promise<PaymentCheckoutRecord | null> {
  const docs = await advanceScopeDocsOf(db, companyId, assignmentId);
  const found = docs
    .map((doc) => checkoutRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentCheckoutRecord => record !== null && record.paymentReference === paymentReference);
  return found.length === 1 ? found[0] : null;
}

/**
 * Οι ανοιχτές συνεδρίες της **ίδιας εμβέλειας απόπειρας** (`sameAttemptScope` — τιμολόγιο: ίδιος σύνδεσμος) — για να
 * κλείσουν όταν ξεκινά νέα (καμία διπλή πληρωμή από ξεχασμένη καρτέλα).
 */
export async function listPendingCheckoutsOf(db: Firestore, subject: PayableSubject): Promise<PaymentCheckoutRecord[]> {
  const docs = await attemptScopeDocsOf(db, subject);
  return docs
    .map((doc) => checkoutRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentCheckoutRecord => (
      record !== null && record.status === 'pending' && sameAttemptScope(record.subject, subject)
    ));
}

/** Στιγμιότυπο ερωτήματος ⇒ οι **αναγνώσιμες** συνεδρίες (η μη αναγνώσιμη είναι ανύπαρκτη). */
function readableCheckoutsOf(snap: QuerySnapshot): PaymentCheckoutRecord[] {
  return snap.docs
    .map((doc) => checkoutRecordOf(doc.id, doc.data()))
    .filter((record): record is PaymentCheckoutRecord => record !== null);
}

/** Ανοιχτές συνεδρίες που δημιουργήθηκαν πριν από το `beforeIso` — για τη συμφιλίωση (cron). */
export async function listStalePendingCheckouts(db: Firestore, beforeIso: string, limit: number): Promise<PaymentCheckoutRecord[]> {
  // tenant-scope-exempt: εργασία συστήματος (cron συμφιλίωσης) που ελέγχει τις ανοιχτές συνεδρίες ΚΑΘΕ μισθωτή εκ
  // σχεδιασμού· ο μισθωτής κάθε συνεδρίας διαβάζεται από το έγγραφό της.
  return readableCheckoutsOf(await checkoutsOf(db)
    .where('status', '==', 'pending')
    .where('createdAt', '<', beforeIso)
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get());
}
