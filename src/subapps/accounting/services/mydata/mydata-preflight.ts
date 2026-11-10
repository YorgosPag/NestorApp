/**
 * @fileoverview **Έλεγχος πριν τη διαβίβαση** — «μπορεί αυτό το παραστατικό να δηλωθεί στην ΑΑΔΕ;»
 * @module subapps/accounting/services/mydata/mydata-preflight
 *
 * Καθαρή συνάρτηση: τιμολόγιο → λίστα προβλημάτων. Κενή λίστα = διαβιβάσιμο.
 * Ο builder (`mydata-payload-builder.ts`) **δεν** χτίζει payload αν η λίστα δεν είναι κενή.
 *
 * 🔑 **Γιατί εδώ και όχι στην ΑΑΔΕ**: μια απόρριψη από την ΑΑΔΕ είναι ήδη *γεγονός* (στάλθηκε, κατεγράφη)·
 * ό,τι μπορεί να κριθεί τοπικά κρίνεται πριν φύγει. Οι κωδικοί είναι **σταθερά αναγνωριστικά**, όχι
 * κείμενο — το UI τα μεταφράζει (i18n), ο έλεγχος δεν μιλά ποτέ σε άνθρωπο.
 */

import { isValidGreekVat } from '@/lib/validation/greek-vat-number';

import type { Invoice } from '../../types/invoice';
import { roundToTwo } from '../../utils/math';
// Ποσό ΦΠΑ γραμμής: ο ΕΝΑΣ υπολογισμός της φόρμας και του διακομιστή (ADR-ACC-003 §22.2).
import { lineVatAmount } from '../../utils/invoice-amounts';
import {
  MYDATA_CORRELATION_REQUIRED,
  MYDATA_COUNTERPART_REQUIRED,
  isVatExemptionMissing,
  myDataPaymentMethodOf,
  myDataVatCategoryOf,
  myDataWithholdingCategoryOf,
} from './mydata-codes';
import { isMyDataTransmittable } from './mydata-status-transitions';

export const MYDATA_PREFLIGHT_ISSUE_CODES = [
  'STATUS_NOT_TRANSMITTABLE',
  'UNSUPPORTED_CURRENCY',
  'ISSUER_VAT_INVALID',
  'COUNTERPART_VAT_MISSING',
  'COUNTERPART_VAT_INVALID',
  'COUNTERPART_ADDRESS_MISSING',
  'CORRELATED_MARK_MISSING',
  'PAYMENT_METHOD_NOT_TRANSMITTABLE',
  'NO_LINES',
  'VAT_RATE_UNKNOWN',
  'VAT_EXEMPTION_MISSING',
  'WITHHOLDING_CATEGORY_AMBIGUOUS',
  'NET_TOTAL_MISMATCH',
  'VAT_TOTAL_MISMATCH',
] as const;

export type MyDataPreflightIssueCode = (typeof MYDATA_PREFLIGHT_ISSUE_CODES)[number];

export interface MyDataPreflightIssue {
  code: MyDataPreflightIssueCode;
  /** Γραμμή τιμολογίου (1-based) — `null` για προβλήματα επιπέδου παραστατικού. */
  lineNumber: number | null;
}

/** Ό,τι χρειάζεται η διαβίβαση πέρα από το ίδιο το τιμολόγιο. */
export interface MyDataTransmissionInput {
  invoice: Invoice;
  /** ΜΑΡΚ των συσχετιζόμενων (για πιστωτικό: του αρχικού). Τα λύνει ο καλών από το `relatedInvoiceId`. */
  correlatedMarks: readonly string[];
}

const GREECE = 'GR';

function issue(code: MyDataPreflightIssueCode, lineNumber: number | null = null): MyDataPreflightIssue {
  return { code, lineNumber };
}

function checkHeader({ invoice, correlatedMarks }: MyDataTransmissionInput): MyDataPreflightIssue[] {
  const issues: MyDataPreflightIssue[] = [];
  if (!isMyDataTransmittable(invoice.mydata.status)) issues.push(issue('STATUS_NOT_TRANSMITTABLE'));
  if (invoice.currency !== 'EUR') issues.push(issue('UNSUPPORTED_CURRENCY'));
  if (!isValidGreekVat(invoice.issuer.vatNumber)) issues.push(issue('ISSUER_VAT_INVALID'));
  if (MYDATA_CORRELATION_REQUIRED.has(invoice.type) && correlatedMarks.length === 0) {
    issues.push(issue('CORRELATED_MARK_MISSING'));
  }
  if (myDataPaymentMethodOf(invoice.paymentMethod) === null) issues.push(issue('PAYMENT_METHOD_NOT_TRANSMITTABLE'));
  return issues;
}

function checkCounterpart(invoice: Invoice): MyDataPreflightIssue[] {
  if (!MYDATA_COUNTERPART_REQUIRED.has(invoice.type)) return [];
  const { vatNumber, country, postalCode, city } = invoice.customer;
  if (!vatNumber) return [issue('COUNTERPART_VAT_MISSING')];
  const issues: MyDataPreflightIssue[] = [];
  if (country === GREECE && !isValidGreekVat(vatNumber)) issues.push(issue('COUNTERPART_VAT_INVALID'));
  // Αλλοδαπός λήπτης: η επωνυμία/διεύθυνση είναι ο μόνος τρόπος ταυτοποίησης (XSD AddressType: ΤΚ + πόλη).
  if (country !== GREECE && (!postalCode || !city)) issues.push(issue('COUNTERPART_ADDRESS_MISSING'));
  return issues;
}

function checkLines(invoice: Invoice): MyDataPreflightIssue[] {
  if (invoice.lineItems.length === 0) return [issue('NO_LINES')];
  const issues: MyDataPreflightIssue[] = [];
  for (const line of invoice.lineItems) {
    if (myDataVatCategoryOf(line.vatRate) === null) issues.push(issue('VAT_RATE_UNKNOWN', line.lineNumber));
    if (isVatExemptionMissing(line)) issues.push(issue('VAT_EXEMPTION_MISSING', line.lineNumber));
  }
  return issues;
}

function checkWithholding(invoice: Invoice): MyDataPreflightIssue[] {
  const rate = invoice.withholdingRate ?? 0;
  if (rate === 0) return [];
  return myDataWithholdingCategoryOf(rate) === null ? [issue('WITHHOLDING_CATEGORY_AMBIGUOUS')] : [];
}

function checkTotals(invoice: Invoice): MyDataPreflightIssue[] {
  const net = roundToTwo(invoice.lineItems.reduce((sum, line) => sum + line.netAmount, 0));
  const vat = roundToTwo(invoice.lineItems.reduce((sum, line) => sum + lineVatAmount(line.netAmount, line.vatRate), 0));
  const issues: MyDataPreflightIssue[] = [];
  if (net !== roundToTwo(invoice.totalNetAmount)) issues.push(issue('NET_TOTAL_MISMATCH'));
  if (vat !== roundToTwo(invoice.totalVatAmount)) issues.push(issue('VAT_TOTAL_MISMATCH'));
  return issues;
}

/** Όλα τα προβλήματα που εμποδίζουν τη διαβίβαση — κενό = διαβιβάσιμο. */
export function preflightMyDataInvoice(input: MyDataTransmissionInput): MyDataPreflightIssue[] {
  const { invoice } = input;
  return [
    ...checkHeader(input),
    ...checkCounterpart(invoice),
    ...checkLines(invoice),
    ...checkWithholding(invoice),
    ...(invoice.lineItems.length > 0 ? checkTotals(invoice) : []),
  ];
}
