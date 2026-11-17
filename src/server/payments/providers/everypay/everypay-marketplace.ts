import 'server-only';

/**
 * @fileoverview Ο adapter **EveryPay Marketplace** — υλοποίηση του `MarketplaceCapability` (ADR-943 §5.7)
 * @description
 *   - **Δικαιούχος** = πωλητής (`POST /sellers` · `GET /sellers/{id}` · `PUT /sellers/{id}`). Τα στοιχεία (IBAN, ΑΦΜ)
 *     περνούν διαμέσου και **δεν** αποθηκεύονται από εμάς· η ταυτοποίηση γίνεται στη hosted σελίδα KYC του παρόχου, της
 *     οποίας ο σύνδεσμος φτάνει **μόνο** με το webhook KYC (το αντικείμενο πωλητή δεν έχει πεδία KYC — ADR-943 §5.14).
 *   - **Κράτηση** = μεταφορά πληρωμής με `on_hold=1` (`POST /payments/{id}/transfers`) · **αποδέσμευση** =
 *     `PUT /transfers/{id}` με `on_hold=0`.
 *   - **Αντιλογισμός** = `POST /reversals` (μετά την εκκαθάριση η επιστροφή στον πελάτη δεν γίνεται απευθείας) ·
 *     **επιστροφή** = `POST /refunds` (μόνο για ανεκκαθάριστη split πληρωμή — docs «Basic concepts»).
 *
 *   🔑 Ο πάροχος δεν τεκμηριώνει κλειδί ιδεμποτίας ⇒ κάθε πράξη χρημάτων **διαβάζει πρώτα** και στέλνει μόνο τη
 *   διαφορά από την επιθυμητή κατάσταση (`payment-marketplace.ts`). Δεύτερη εκτέλεση ⇒ καμία κίνηση.
 *
 *   ⚠️ **Ανεπαλήθευτα ζωντανά** (ADR-943 §8, κλείνουν στη Φ6 στο sandbox): η μορφή του `is_c2c` / `on_hold` σε φόρμα
 *   (`1`/`0`) · αν το `kyc_process_url` επιστρέφεται στη δημιουργία του πωλητή · αν το webhook KYC υπογράφεται με την
 *   ίδια κεφαλίδα με τα υπόλοιπα · επιστροφή πληρωμής με κρατημένη μεταφορά.
 *
 * @see https://docs.everypay.gr/api-reference/ · https://docs.everypay.gr/marketplace-link/basic-concepts/
 */

import { plainRecordOrNull } from '@/lib/type-guards';

import type {
  MarketplaceCapability,
  PayeeAccount,
  PayeeRegistration,
  PayeeTransfer,
  PayeeTransferTarget,
  PayeeUpdate,
  PaymentRefundTarget,
  ReconcileOutcome,
  TransferReversalTarget,
} from '../../payment-marketplace';
import { EverypayApiError, everypayRequest } from './everypay-client';
import type { EverypayCredentials } from './everypay-config';
import { everypayListAll } from './everypay-list';
import { payeeAccountOf, payeeTransferOf } from './everypay-marketplace-readers';
import { minorAmountField, textField } from './everypay-readers';

const NO_CHANGE: ReconcileOutcome = { applied: false };

function malformed(what: string): EverypayApiError {
  return new EverypayApiError(502, null, `Marketplace response without a readable ${what}`);
}

function flag(value: boolean): string {
  return value ? '1' : '0';
}

function path(prefix: string, reference: string, suffix = ''): string {
  return `${prefix}/${encodeURIComponent(reference)}${suffix}`;
}

// ─── ΔΙΚΑΙΟΥΧΟΣ ──────────────────────────────────────────────────────────────

function payeeOrThrow(body: unknown): PayeeAccount {
  const account = payeeAccountOf(body);
  if (account === null) throw malformed('seller');
  return account;
}

async function registerPayee(credentials: EverypayCredentials, registration: PayeeRegistration): Promise<PayeeAccount> {
  return payeeOrThrow(await everypayRequest(credentials, {
    method: 'POST',
    path: '/sellers',
    form: {
      email: registration.email,
      contact_phone: registration.phone,
      description: registration.description,
      business_name: registration.legalName,
      business_title: registration.tradeName,
      business_tax_number: registration.taxNumber,
      business_address: registration.address,
      bank_account_iban: registration.iban,
      bank_account_beneficiary: registration.ibanBeneficiary,
      is_c2c: flag(registration.consumerToConsumer),
    },
  }));
}

async function readPayee(credentials: EverypayCredentials, payeeReference: string): Promise<PayeeAccount> {
  return payeeOrThrow(await everypayRequest(credentials, { method: 'GET', path: path('/sellers', payeeReference) }));
}

/** `PayeeUpdate` ⇒ πεδία φόρμας `PUT /sellers/{id}`. Μόνο ό,τι δόθηκε· IBAN **πάντα** μαζί με δικαιούχο (docs). */
function payeeUpdateForm(update: PayeeUpdate): Record<string, string> {
  const form: Record<string, string> = {};
  if (update.legalName !== undefined) form.business_name = update.legalName;
  if (update.tradeName !== undefined) form.business_title = update.tradeName;
  if (update.address !== undefined) form.business_address = update.address;
  if (update.description !== undefined) form.description = update.description;
  if (update.bankAccount !== undefined) {
    form.bank_account_iban = update.bankAccount.iban;
    form.bank_account_beneficiary = update.bankAccount.beneficiary;
  }
  return form;
}

/**
 * Αλλαγή στοιχείων πωλητή. Δηλωτική εκ φύσεως (PUT): ίδια στοιχεία ⇒ ίδια κατάσταση. Κενή αλλαγή ⇒ απλή ανάγνωση
 * (καμία κλήση εγγραφής). Νέο IBAN **δεν** ισχύει αμέσως — ο πάροχος το ξαναελέγχει με KYC (docs «Update a seller»).
 */
async function updatePayee(credentials: EverypayCredentials, payeeReference: string, update: PayeeUpdate): Promise<PayeeAccount> {
  const form = payeeUpdateForm(update);
  if (Object.keys(form).length === 0) return readPayee(credentials, payeeReference);
  return payeeOrThrow(await everypayRequest(credentials, { method: 'PUT', path: path('/sellers', payeeReference), form }));
}

// ─── ΜΕΤΑΦΟΡΑ (ΚΡΑΤΗΣΗ / ΑΠΟΔΕΣΜΕΥΣΗ) ────────────────────────────────────────

function transferOrThrow(body: unknown): PayeeTransfer {
  const transfer = payeeTransferOf(body);
  if (transfer === null) throw malformed('transfer');
  return transfer;
}

async function readTransfer(credentials: EverypayCredentials, transferReference: string): Promise<PayeeTransfer> {
  return transferOrThrow(await everypayRequest(credentials, { method: 'GET', path: path('/transfers', transferReference) }));
}

/** Η υπάρχουσα μεταφορά της πληρωμής προς τον δικαιούχο, αν υπάρχει. Δύο ⇒ σφάλμα: θέλει άνθρωπο, όχι τρίτη. */
async function existingTransferOf(credentials: EverypayCredentials, target: PayeeTransferTarget): Promise<PayeeTransfer | null> {
  const records = await everypayListAll(credentials, '/transfers', {
    payment: target.paymentReference, seller: target.payeeReference,
  });
  const transfers = records.map(payeeTransferOf).filter((transfer): transfer is PayeeTransfer => (
    transfer !== null && transfer.payeeReference === target.payeeReference
  ));
  if (transfers.length > 1) throw new EverypayApiError(409, null, 'More than one transfer for this payment and seller');
  return transfers[0] ?? null;
}

/**
 * **Η** μεταφορά της πληρωμής προς τον δικαιούχο. Υπάρχει ήδη ⇒ επιστρέφεται (με άλλο ποσό ⇒ σφάλμα· ποτέ δεύτερη).
 * Περιορισμοί του παρόχου (docs): η πληρωμή πρέπει να είναι captured, `split=1`, χωρίς δόσεις, χωρίς πλήρη επιστροφή·
 * `commission_amount` < `amount`.
 */
async function ensureTransfer(credentials: EverypayCredentials, target: PayeeTransferTarget): Promise<PayeeTransfer> {
  if (!Number.isSafeInteger(target.amountMinor) || target.amountMinor <= 0) throw new RangeError('Transfer amount must be positive');
  if (target.commissionMinor < 0 || target.commissionMinor >= target.amountMinor) throw new RangeError('Commission out of range');
  const existing = await existingTransferOf(credentials, target);
  if (existing !== null) {
    if (existing.amountMinor !== target.amountMinor) throw new EverypayApiError(409, null, 'Existing transfer has a different amount');
    return existing;
  }
  return transferOrThrow(await everypayRequest(credentials, {
    method: 'POST',
    path: path('/payments', target.paymentReference, '/transfers'),
    form: {
      seller: target.payeeReference,
      amount: String(target.amountMinor),
      commission_amount: String(target.commissionMinor),
      description: target.description,
      on_hold: flag(target.hold),
    },
  }));
}

async function releaseTransfer(credentials: EverypayCredentials, transferReference: string): Promise<PayeeTransfer> {
  const current = await readTransfer(credentials, transferReference);
  if (!current.held) return current;
  return transferOrThrow(await everypayRequest(credentials, {
    method: 'PUT', path: path('/transfers', transferReference), form: { on_hold: '0' },
  }));
}

// ─── ΑΝΤΙΛΟΓΙΣΜΟΣ / ΕΠΙΣΤΡΟΦΗ (ΔΗΛΩΤΙΚΑ) ─────────────────────────────────────

/** Η διαφορά «στόχος − ήδη». Στόχος πάνω από το σύνολο ⇒ σφάλμα του καλούντα (ποτέ περικοπή σιωπηλά). */
function deltaTowards(targetMinor: number, doneMinor: number, ceilingMinor: number): number {
  if (!Number.isSafeInteger(targetMinor) || targetMinor < 0 || targetMinor > ceilingMinor) {
    throw new RangeError('Target total outside 0…original amount');
  }
  return Math.max(0, targetMinor - doneMinor);
}

function appliedOf(body: unknown, amountMinor: number, what: string): ReconcileOutcome {
  const reference = textField(plainRecordOrNull(body), 'token');
  if (reference === null) throw malformed(what);
  return { applied: true, reference, amountMinor };
}

async function reconcileTransferReversal(
  credentials: EverypayCredentials, target: TransferReversalTarget,
): Promise<ReconcileOutcome> {
  const transfer = await readTransfer(credentials, target.transferReference);
  const delta = deltaTowards(target.reversedTotalMinor, transfer.reversedMinor, transfer.amountMinor);
  if (delta === 0) return NO_CHANGE;
  const body = await everypayRequest(credentials, {
    method: 'POST',
    path: '/reversals',
    form: { transfer: target.transferReference, amount: String(delta), description: target.description },
  });
  return appliedOf(body, delta, 'reversal');
}

async function reconcilePaymentRefund(credentials: EverypayCredentials, target: PaymentRefundTarget): Promise<ReconcileOutcome> {
  const payment = plainRecordOrNull(await everypayRequest(credentials, {
    method: 'GET', path: path('/payments', target.paymentReference),
  }));
  const amountMinor = minorAmountField(payment, 'amount');
  if (amountMinor === null) throw malformed('payment');
  const delta = deltaTowards(target.refundedTotalMinor, minorAmountField(payment, 'refund_amount') ?? 0, amountMinor);
  if (delta === 0) return NO_CHANGE;
  const body = await everypayRequest(credentials, {
    method: 'POST', path: '/refunds', form: { payment: target.paymentReference, amount: String(delta) },
  });
  return appliedOf(body, delta, 'refund');
}

// ─── Η ΙΚΑΝΟΤΗΤΑ ─────────────────────────────────────────────────────────────

/** `null` όταν ο λογαριασμός δεν έχει ενεργό Marketplace (`EVERYPAY_MARKETPLACE`) — καμία κλήση σε endpoint που λείπει. */
export function createEverypayMarketplace(credentials: EverypayCredentials): MarketplaceCapability | null {
  if (!credentials.marketplace) return null;
  return {
    registerPayee: (registration) => registerPayee(credentials, registration),
    readPayee: (payeeReference) => readPayee(credentials, payeeReference),
    updatePayee: (payeeReference, update) => updatePayee(credentials, payeeReference, update),
    ensureTransfer: (target) => ensureTransfer(credentials, target),
    readTransfer: (transferReference) => readTransfer(credentials, transferReference),
    releaseTransfer: (transferReference) => releaseTransfer(credentials, transferReference),
    reconcileTransferReversal: (target) => reconcileTransferReversal(credentials, target),
    reconcilePaymentRefund: (target) => reconcilePaymentRefund(credentials, target),
  };
}
