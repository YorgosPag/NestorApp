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
 *
 * 🔑 **Ένας κανόνας, δύο σημεία** (ADR-ACC-003 §22.8): ό,τι κρίνεται από το **περιεχόμενο** (`preflightMyDataDraft`)
 * το ρωτά η φόρμα ζωντανά, και το ξανατρέχει η διαβίβαση (`preflightMyDataInvoice`) μαζί με ό,τι εξαρτάται από τη
 * ζωή του παραστατικού (κατάσταση, νόμισμα, ΜΑΡΚ συσχέτισης). Η βαθμίδα κάθε κωδικού ζει στο `invoice-review.ts`.
 */

import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import { countryNameToCode, toStoredCountryCode } from '@/utils/address/country-codes';

import type { Invoice, InvoiceIssuer, InvoiceType } from '../../types/invoice';
import { isEuMemberState } from '../config/eu-member-states';
import type { InvoiceReviewSeverity } from '../invoices/review-severity';
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
  'COUNTERPART_COUNTRY_TYPE_MISMATCH',
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

/**
 * Η βαθμίδα κάθε κωδικού (ρίζα: `review-severity.ts`). Μόνο το `block` σταματά τον builder. Το
 * `COUNTERPART_COUNTRY_TYPE_MISMATCH` είναι `warn` γιατί ο κανόνας του βγαίνει από τον **τίτλο** του τύπου, όχι από
 * επίσημο πίνακα· με επίσημη πηγή γίνεται `block` εδώ, σε μία γραμμή.
 */
export const MYDATA_PREFLIGHT_SEVERITY = {
  STATUS_NOT_TRANSMITTABLE: 'block',
  UNSUPPORTED_CURRENCY: 'block',
  ISSUER_VAT_INVALID: 'block',
  COUNTERPART_VAT_MISSING: 'block',
  COUNTERPART_VAT_INVALID: 'block',
  COUNTERPART_ADDRESS_MISSING: 'block',
  COUNTERPART_COUNTRY_TYPE_MISMATCH: 'warn',
  CORRELATED_MARK_MISSING: 'block',
  PAYMENT_METHOD_NOT_TRANSMITTABLE: 'block',
  NO_LINES: 'block',
  VAT_RATE_UNKNOWN: 'block',
  VAT_EXEMPTION_MISSING: 'block',
  WITHHOLDING_CATEGORY_AMBIGUOUS: 'block',
  NET_TOTAL_MISMATCH: 'block',
  VAT_TOTAL_MISMATCH: 'block',
} as const satisfies Record<MyDataPreflightIssueCode, InvoiceReviewSeverity>;

/** Σταματά αυτό το εύρημα τη διαβίβαση; */
export function isBlockingPreflightIssue(issue: Pick<MyDataPreflightIssue, 'code'>): boolean {
  return MYDATA_PREFLIGHT_SEVERITY[issue.code] === 'block';
}

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

/**
 * Ό,τι κρίνεται από το **περιεχόμενο** του παραστατικού — από τη φόρμα ή από το αποθηκευμένο τιμολόγιο (ένα
 * `Invoice` το ικανοποιεί). Από τον εκδότη αρκεί ο ΑΦΜ.
 */
export type MyDataDraftFacts = Pick<
  Invoice,
  'type' | 'customer' | 'lineItems' | 'paymentMethod' | 'withholdingRate' | 'totalNetAmount' | 'totalVatAmount'
> & { readonly issuer: Pick<InvoiceIssuer, 'vatNumber'> };

const GREECE = 'GR';

/**
 * Πού πρέπει να είναι ο λήπτης, για τους τύπους που το λένε **στον τίτλο τους** (Παράρτημα 8.1: 2.2 «Ενδοκοινοτική
 * Παροχή Υπηρεσιών», 2.3 «Παροχή Υπηρεσιών σε λήπτη Τρίτης Χώρας») — σφάλματα ΑΑΔΕ 243 / 244 / 287.
 * ⚠️ Η ΑΑΔΕ **δεν** δημοσιεύει πίνακα «τύπος → χώρα» (ελέγχθηκαν v1.0.9 ERP, v1.0.12 ERP, v2.0.2 Providers): οι
 * υπόλοιποι τύποι **δεν** ελέγχονται — άγνωστο ≠ σφάλμα. Γι' αυτό η βαθμίδα του κωδικού είναι `warn`.
 */
const COUNTERPART_REGION_BY_TYPE: Partial<Record<InvoiceType, 'eu_not_gr' | 'non_eu'>> = {
  service_invoice_eu: 'eu_not_gr',
  service_invoice_3rd: 'non_eu',
};

function issue(code: MyDataPreflightIssueCode, lineNumber: number | null = null): MyDataPreflightIssue {
  return { code, lineNumber };
}

// ============================================================================
// ΖΩΗ ΤΟΥ ΠΑΡΑΣΤΑΤΙΚΟΥ — μόνο στη διαβίβαση
// ============================================================================

function checkStatusAndCurrency(invoice: Invoice): MyDataPreflightIssue[] {
  const issues: MyDataPreflightIssue[] = [];
  if (!isMyDataTransmittable(invoice.mydata.status)) issues.push(issue('STATUS_NOT_TRANSMITTABLE'));
  if (invoice.currency !== 'EUR') issues.push(issue('UNSUPPORTED_CURRENCY'));
  return issues;
}

function checkCorrelation({ invoice, correlatedMarks }: MyDataTransmissionInput): MyDataPreflightIssue[] {
  return MYDATA_CORRELATION_REQUIRED.has(invoice.type) && correlatedMarks.length === 0
    ? [issue('CORRELATED_MARK_MISSING')]
    : [];
}

// ============================================================================
// ΠΕΡΙΕΧΟΜΕΝΟ — φόρμα και διαβίβαση
// ============================================================================

function checkIssuer(draft: Pick<MyDataDraftFacts, 'issuer'>): MyDataPreflightIssue[] {
  return isValidGreekVat(draft.issuer.vatNumber) ? [] : [issue('ISSUER_VAT_INVALID')];
}

function checkPaymentMethod(draft: Pick<MyDataDraftFacts, 'paymentMethod'>): MyDataPreflightIssue[] {
  return myDataPaymentMethodOf(draft.paymentMethod) === null ? [issue('PAYMENT_METHOD_NOT_TRANSMITTABLE')] : [];
}

/** Ο λήπτης είναι εκεί που λέει ο τίτλος του τύπου; Άγνωστη χώρα ⇒ σιωπή (την κρίνει το `unknown_country`). */
function isCounterpartRegionMismatch(type: InvoiceType, country: string): boolean {
  const region = COUNTERPART_REGION_BY_TYPE[type];
  if (region === undefined) return false;
  const stored = toStoredCountryCode(country);
  if (stored === undefined || countryNameToCode(stored) === null) return false;
  const inEu = isEuMemberState(stored);
  return region === 'eu_not_gr' ? stored === GREECE || !inEu : stored === GREECE || inEu;
}

function checkCounterpart(draft: Pick<MyDataDraftFacts, 'type' | 'customer'>): MyDataPreflightIssue[] {
  if (!MYDATA_COUNTERPART_REQUIRED.has(draft.type)) return [];
  const { vatNumber, country, postalCode, city } = draft.customer;
  const issues: MyDataPreflightIssue[] = [];
  if (!vatNumber) {
    issues.push(issue('COUNTERPART_VAT_MISSING'));
  } else {
    if (country === GREECE && !isValidGreekVat(vatNumber)) issues.push(issue('COUNTERPART_VAT_INVALID'));
    // Αλλοδαπός λήπτης: η επωνυμία/διεύθυνση είναι ο μόνος τρόπος ταυτοποίησης (XSD AddressType: ΤΚ + πόλη).
    if (country !== GREECE && (!postalCode || !city)) issues.push(issue('COUNTERPART_ADDRESS_MISSING'));
  }
  if (isCounterpartRegionMismatch(draft.type, country)) issues.push(issue('COUNTERPART_COUNTRY_TYPE_MISMATCH'));
  return issues;
}

function checkLines(draft: Pick<MyDataDraftFacts, 'lineItems'>): MyDataPreflightIssue[] {
  if (draft.lineItems.length === 0) return [issue('NO_LINES')];
  const issues: MyDataPreflightIssue[] = [];
  for (const line of draft.lineItems) {
    if (myDataVatCategoryOf(line.vatRate) === null) issues.push(issue('VAT_RATE_UNKNOWN', line.lineNumber));
    if (isVatExemptionMissing(line)) issues.push(issue('VAT_EXEMPTION_MISSING', line.lineNumber));
  }
  return issues;
}

function checkWithholding(draft: Pick<MyDataDraftFacts, 'withholdingRate'>): MyDataPreflightIssue[] {
  const rate = draft.withholdingRate ?? 0;
  if (rate === 0) return [];
  return myDataWithholdingCategoryOf(rate) === null ? [issue('WITHHOLDING_CATEGORY_AMBIGUOUS')] : [];
}

function checkTotals(
  draft: Pick<MyDataDraftFacts, 'lineItems' | 'totalNetAmount' | 'totalVatAmount'>,
): MyDataPreflightIssue[] {
  const net = roundToTwo(draft.lineItems.reduce((sum, line) => sum + line.netAmount, 0));
  const vat = roundToTwo(draft.lineItems.reduce((sum, line) => sum + lineVatAmount(line.netAmount, line.vatRate), 0));
  const issues: MyDataPreflightIssue[] = [];
  if (net !== roundToTwo(draft.totalNetAmount)) issues.push(issue('NET_TOTAL_MISMATCH'));
  if (vat !== roundToTwo(draft.totalVatAmount)) issues.push(issue('VAT_TOTAL_MISMATCH'));
  return issues;
}

function checkBody(draft: MyDataDraftFacts): MyDataPreflightIssue[] {
  return [
    ...checkCounterpart(draft),
    ...checkLines(draft),
    ...checkWithholding(draft),
    ...(draft.lineItems.length > 0 ? checkTotals(draft) : []),
  ];
}

// ============================================================================
// ΕΙΣΟΔΟΙ
// ============================================================================

/**
 * Ό,τι κρίνεται από το **περιεχόμενο** — η φόρμα το ρωτά ζωντανά (ADR-ACC-003 §22.8). Δεν ξέρει κατάσταση, νόμισμα
 * ή ΜΑΡΚ συσχέτισης· αυτά τα κρίνει μόνο ο `preflightMyDataInvoice`.
 */
export function preflightMyDataDraft(draft: MyDataDraftFacts): MyDataPreflightIssue[] {
  return [...checkIssuer(draft), ...checkPaymentMethod(draft), ...checkBody(draft)];
}

/** Όλα τα προβλήματα που εμποδίζουν τη διαβίβαση — κενό = διαβιβάσιμο. */
export function preflightMyDataInvoice(input: MyDataTransmissionInput): MyDataPreflightIssue[] {
  const { invoice } = input;
  return [
    ...checkStatusAndCurrency(invoice),
    ...checkIssuer(invoice),
    ...checkCorrelation(input),
    ...checkPaymentMethod(invoice),
    ...checkBody(invoice),
  ];
}
