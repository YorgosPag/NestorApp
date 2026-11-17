/**
 * @fileoverview Αναγνώστες απαντήσεων **EveryPay Marketplace** — `unknown` ⇒ τύποι του port, χωρίς `as` (ADR-943 §5.7)
 * @description Πωλητής (`sel_…`), μεταφορά (`tra_…`) και το webhook `SELLER_KYC.STATUS`. Ό,τι λείπει ή έχει άλλη μορφή
 *   γίνεται `null`· ο adapter αποφασίζει (συνήθως: σφάλμα 502 — ποτέ «εξουσιοδοτημένος» / «αποδεσμευμένη» από ελλιπή
 *   δεδομένα). Τα πεδία είναι όσα δηλώνει το API reference (επαληθευμένο 2026-11-16).
 *
 * @see https://docs.everypay.gr/api-reference/ (Sellers · Transfers · Reversals) · https://docs.everypay.gr/marketplace-link/seller-kyc/
 */

import {
  PAYEE_KYC_REQUIREMENTS,
  type PayeeKycRequirement,
  type PayeeKycRequirements,
  type PayeeKycStatus,
  type PayeeRequirementState,
} from '@/lib/payments/payee-kyc';
import { isNonEmptyTrimmedString, plainRecordOrNull } from '@/lib/type-guards';
import { cleanIBAN } from '@/types/contacts/banking';

import type { PayeeAccount, PayeeDetails, PayeeStatus, PayeeTransfer } from '../../payment-marketplace';
import { minorAmountField, statusField, textField } from './everypay-readers';

/** Το event του webhook KYC (docs «Seller KYC», `event_type`). */
export const EVERYPAY_SELLER_KYC_EVENT = 'SELLER_KYC.STATUS';

const PAYEE_STATUS_OF: Readonly<Record<string, PayeeStatus>> = {
  authorized: 'authorized',
  suspended: 'suspended',
  closed: 'closed',
};

/**
 * Η κατάσταση KYC, κανονικοποιημένη. Η τεκμηρίωση γράφει την ίδια τιμή με τρεις μορφές (`In progress` · `in progress` ·
 * `in-progress`) — ο `statusField` αφαιρεί κενά/παύλες/κάτω παύλες, άρα όλες καταλήγουν στο ίδιο κλειδί.
 */
const PAYEE_KYC_STATUS_OF: Readonly<Record<string, PayeeKycStatus>> = {
  initial: 'initial',
  existing: 'existing',
  inprogress: 'in-progress',
  pending: 'pending',
  verified: 'verified',
  rejected: 'rejected',
};

/** Αναφορά σε αντικείμενο του παρόχου: κείμενο (`sel_…`) ή αντικείμενο με `token`. */
function referenceField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  if (isNonEmptyTrimmedString(value)) return value.trim();
  return textField(plainRecordOrNull(value), 'token');
}

/** Σημαία του παρόχου: `true`/`false` ή `1`/`0` (αριθμός ή κείμενο). Άλλη τιμή ⇒ `null`. */
function flagField(record: Record<string, unknown> | null, key: string): boolean | null {
  const value = record?.[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return null;
}

export function payeeKycStatusOf(raw: unknown): PayeeKycStatus {
  const status = statusField({ status: raw });
  return status === null ? 'unknown' : PAYEE_KYC_STATUS_OF[status] ?? 'unknown';
}

/** Κατάσταση δικαιολογητικού (`pending` · `in progress`/`in-progress` · `approved` · `rejected` · `bypass`). */
const REQUIREMENT_STATE_OF: Readonly<Record<string, PayeeRequirementState>> = {
  pending: 'pending',
  inprogress: 'in-progress',
  approved: 'approved',
  rejected: 'rejected',
  bypass: 'bypass',
};

/**
 * `category_status` του webhook KYC ⇒ δικαιολογητικά. `null` του παρόχου ⇒ «δεν εφαρμόζεται» (παραλείπεται)· άγνωστη
 * κατηγορία ⇒ αγνοείται· άγνωστη κατάσταση ⇒ `unknown` (ποτέ `approved`).
 */
export function payeeKycRequirementsOf(raw: unknown): PayeeKycRequirements {
  const categories = plainRecordOrNull(raw);
  const requirements: Partial<Record<PayeeKycRequirement, PayeeRequirementState>> = {};
  for (const requirement of PAYEE_KYC_REQUIREMENTS) {
    const value = categories?.[requirement];
    if (value === undefined || value === null) continue;
    const state = statusField({ status: value });
    requirements[requirement] = state === null ? 'unknown' : REQUIREMENT_STATE_OF[state] ?? 'unknown';
  }
  return requirements;
}

/** Επίπεδο (`business_name`) ή φωλιασμένο (`business.name`) — η τεκμηρίωση δείχνει και τα δύο. */
function businessField(seller: Record<string, unknown> | null, key: string): string | null {
  return textField(plainRecordOrNull(seller?.business), key) ?? textField(seller, `business_${key}`);
}

/** Ο προεπιλεγμένος λογαριασμός πίστωσης (`bank_accounts[].is_default`), αλλιώς ο μόνος. */
function defaultBankAccountOf(seller: Record<string, unknown> | null): Record<string, unknown> | null {
  const accounts = Array.isArray(seller?.bank_accounts) ? seller.bank_accounts.map(plainRecordOrNull) : [];
  const usable = accounts.filter((account): account is Record<string, unknown> => account !== null);
  return usable.find((account) => account.is_default === true) ?? (usable.length === 1 ? usable[0] : null);
}

/** Τα δηλωμένα στοιχεία· το IBAN φεύγει **μόνο** ως τελευταία 4 ψηφία (ελαχιστοποίηση — ADR-943 §6.4). */
function payeeDetailsOf(seller: Record<string, unknown> | null): PayeeDetails | null {
  const bank = defaultBankAccountOf(seller);
  const iban = textField(bank, 'iban');
  const details: PayeeDetails = {
    legalName: businessField(seller, 'name'),
    tradeName: businessField(seller, 'title'),
    address: businessField(seller, 'address'),
    taxNumber: businessField(seller, 'tax_number'),
    ibanLast4: iban === null ? null : cleanIBAN(iban).slice(-4),
    ibanBeneficiary: textField(bank, 'beneficiary_name') ?? textField(seller, 'bank_account_beneficiary'),
    bankName: textField(bank, 'bank_name'),
  };
  return Object.values(details).every((value) => value === null) ? null : details;
}

/** Πωλητής ⇒ δικαιούχος, ή `null` χωρίς αναγνωριστικό. Άγνωστη κατάσταση ⇒ `unknown` (ποτέ «εξουσιοδοτημένος»). */
export function payeeAccountOf(body: unknown): PayeeAccount | null {
  const seller = plainRecordOrNull(body);
  const reference = textField(seller, 'token');
  if (reference === null) return null;
  const status = statusField(seller);
  return {
    reference,
    status: status === null ? 'unknown' : PAYEE_STATUS_OF[status] ?? 'unknown',
    kycProcessUrl: textField(seller, 'kyc_process_url'),
    details: payeeDetailsOf(seller),
  };
}

/** Μεταφορά ⇒ τύπος του port, ή `null` όταν λείπει ταυτότητα, δικαιούχος, ποσό ή η σημαία κράτησης. */
export function payeeTransferOf(body: unknown): PayeeTransfer | null {
  const transfer = plainRecordOrNull(body);
  const reference = textField(transfer, 'token');
  const payeeReference = referenceField(transfer, 'seller');
  const amountMinor = minorAmountField(transfer, 'amount');
  const held = flagField(transfer, 'on_hold');
  if (reference === null || payeeReference === null || amountMinor === null || held === null) return null;
  return {
    reference,
    paymentReference: referenceField(transfer, 'payment'),
    payeeReference,
    amountMinor,
    commissionMinor: minorAmountField(transfer, 'commission_amount') ?? 0,
    held,
    paidOut: transfer?.payout !== undefined && transfer.payout !== null,
    reversedMinor: minorAmountField(transfer, 'reversed_amount') ?? 0,
  };
}

/** Το υπογεγραμμένο webhook KYC ⇒ τα πεδία του σήματος, ή `null` όταν δεν είναι αυτό το event / λείπει ο πωλητής. */
export function sellerKycEventOf(
  body: Record<string, unknown>,
): {
  readonly payeeReference: string; readonly kycStatus: PayeeKycStatus; readonly kycProcessUrl: string | null;
  readonly kycRequirements: PayeeKycRequirements;
} | null {
  if (textField(body, 'event_type') !== EVERYPAY_SELLER_KYC_EVENT) return null;
  const payload = plainRecordOrNull(body.payload);
  const payeeReference = textField(payload, 'seller_token');
  if (payeeReference === null) return null;
  return {
    payeeReference,
    kycStatus: payeeKycStatusOf(payload?.status),
    kycProcessUrl: textField(payload, 'kyc_process_url'),
    kycRequirements: payeeKycRequirementsOf(payload?.category_status),
  };
}
