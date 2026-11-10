/**
 * @fileoverview **Τιμολόγιο → payload ΑΑΔΕ** (σχήμα `InvoicesDoc` v2.0.2).
 * @module subapps/accounting/services/mydata/mydata-payload-builder
 *
 * Καθαρή συνάρτηση, χωρίς δίκτυο και χωρίς αποθήκευση. Τρέχει **πρώτα** τον έλεγχο
 * (`preflightMyDataInvoice`): από άκυρο τιμολόγιο **δεν** βγαίνει payload — βγαίνει η λίστα προβλημάτων.
 *
 * Κανόνες που εφαρμόζει (myDATA ERP v2.0.2):
 * - Εκδότης GR: **μόνο** ΑΦΜ / χώρα / εγκατάσταση — επωνυμία και διεύθυνση **δεν γίνονται αποδεκτές** (§5.1 παρ. 3).
 * - Λήπτης GR: **χωρίς** επωνυμία (§5.1 παρ. 3)· διεύθυνση μόνο αν υπάρχουν ΤΚ και πόλη.
 * - Εγκατάσταση `0` = έδρα (§5.1 παρ. 2) — η εφαρμογή δεν κρατά υποκαταστήματα.
 * - Το άθροισμα των τρόπων πληρωμής = `totalGrossValue` (§4.2.4 παρ. 5) ⇒ η «συνολική αξία» είναι το
 *   **πληρωτέο**: καθαρό + ΦΠΑ − παρακράτηση. ⚠️ Προς επιβεβαίωση στο δοκιμαστικό περιβάλλον της ΑΑΔΕ
 *   στη φάση σύνδεσης (ADR-ACC-003 §20).
 */

import type { Invoice, InvoiceLineItem } from '../../types/invoice';
import type { MyDataIncomeType } from '../../types/common';
import { roundToTwo } from '../../utils/math';
import {
  MYDATA_COUNTERPART_REQUIRED,
  MYDATA_INVOICE_TYPE_CODES,
  MYDATA_SPEC_VERSION,
  myDataPaymentMethodOf,
  myDataVatCategoryOf,
  myDataWithholdingCategoryOf,
} from './mydata-codes';
import { preflightMyDataInvoice } from './mydata-preflight';
import { lineVatAmount } from '../../utils/invoice-amounts';
import type { MyDataPreflightIssue, MyDataTransmissionInput } from './mydata-preflight';
import type {
  MyDataIncomeClassification,
  MyDataInvoicePayload,
  MyDataInvoiceRow,
  MyDataParty,
} from './mydata-payload.types';

export type MyDataPayloadResult =
  | { ok: true; payload: MyDataInvoicePayload }
  | { ok: false; issues: readonly MyDataPreflightIssue[] };

const GREECE = 'GR';
const HEAD_OFFICE_BRANCH = 0;

function issuerParty(invoice: Invoice): MyDataParty {
  return { vatNumber: invoice.issuer.vatNumber.trim(), country: GREECE, branch: HEAD_OFFICE_BRANCH, name: null, address: null };
}

function counterpartParty(invoice: Invoice): MyDataParty | null {
  const { customer } = invoice;
  if (!MYDATA_COUNTERPART_REQUIRED.has(invoice.type) || !customer.vatNumber) return null;
  const isDomestic = customer.country === GREECE;
  const address = customer.postalCode && customer.city
    ? { street: customer.address, number: null, postalCode: customer.postalCode, city: customer.city }
    : null;
  return {
    vatNumber: customer.vatNumber.trim(),
    country: customer.country,
    branch: HEAD_OFFICE_BRANCH,
    name: isDomestic ? null : customer.name,
    address,
  };
}

/**
 * Κατανομή της παρακράτησης στις γραμμές (το XSD την ορίζει **ανά γραμμή**, η εφαρμογή ανά παραστατικό):
 * αναλογικά στο καθαρό, με την τελευταία γραμμή να απορροφά τη διαφορά στρογγύλευσης — ώστε το άθροισμα
 * να είναι **ακριβώς** το ποσό του τιμολογίου.
 */
export function distributeWithholding(lines: readonly InvoiceLineItem[], rate: number, total: number): number[] {
  const shares = lines.map((line) => roundToTwo(line.netAmount * (rate / 100)));
  const allocated = roundToTwo(shares.slice(0, -1).reduce((sum, share) => sum + share, 0));
  if (shares.length > 0) shares[shares.length - 1] = roundToTwo(total - allocated);
  return shares;
}

function withholdingTotal(invoice: Invoice, rate: number): number {
  return roundToTwo(invoice.withholdingAmount ?? invoice.totalNetAmount * (rate / 100));
}

function classificationOf(category: MyDataIncomeType, amount: number): MyDataIncomeClassification {
  return { classificationType: null, classificationCategory: category, amount: roundToTwo(amount) };
}

function buildRows(invoice: Invoice): MyDataInvoiceRow[] {
  const rate = invoice.withholdingRate ?? 0;
  const withheldCategory = rate > 0 ? myDataWithholdingCategoryOf(rate) : null;
  const withheld = rate > 0 ? distributeWithholding(invoice.lineItems, rate, withholdingTotal(invoice, rate)) : [];
  return invoice.lineItems.map((line, index) => ({
    lineNumber: line.lineNumber,
    netValue: roundToTwo(line.netAmount),
    // Ο έλεγχος έχει ήδη αποκλείσει άγνωστο συντελεστή.
    vatCategory: myDataVatCategoryOf(line.vatRate) ?? 0,
    vatAmount: lineVatAmount(line.netAmount, line.vatRate),
    vatExemptionCategory: line.vatRate === 0 ? line.vatExemptionCategory ?? null : null,
    withheldAmount: withheldCategory === null ? null : withheld[index] ?? null,
    withheldPercentCategory: withheldCategory,
    incomeClassification: [classificationOf(line.mydataCode, line.netAmount)],
  }));
}

function summarizeClassifications(rows: readonly MyDataInvoiceRow[]): MyDataIncomeClassification[] {
  const byCategory = new Map<MyDataIncomeType, number>();
  for (const row of rows) {
    for (const entry of row.incomeClassification) {
      byCategory.set(entry.classificationCategory, (byCategory.get(entry.classificationCategory) ?? 0) + entry.amount);
    }
  }
  return Array.from(byCategory, ([category, amount]) => classificationOf(category, amount));
}

function sumOf(rows: readonly MyDataInvoiceRow[], pick: (row: MyDataInvoiceRow) => number | null): number {
  return roundToTwo(rows.reduce((sum, row) => sum + (pick(row) ?? 0), 0));
}

function assemble(input: MyDataTransmissionInput, rows: MyDataInvoiceRow[]): MyDataInvoicePayload {
  const { invoice } = input;
  const totalNetValue = sumOf(rows, (row) => row.netValue);
  const totalVatAmount = sumOf(rows, (row) => row.vatAmount);
  const totalWithheldAmount = sumOf(rows, (row) => row.withheldAmount);
  const totalGrossValue = roundToTwo(totalNetValue + totalVatAmount - totalWithheldAmount);
  return {
    specVersion: MYDATA_SPEC_VERSION,
    issuer: issuerParty(invoice),
    counterpart: counterpartParty(invoice),
    invoiceHeader: {
      series: invoice.series,
      aa: String(invoice.number),
      issueDate: invoice.issueDate.slice(0, 10),
      invoiceType: MYDATA_INVOICE_TYPE_CODES[invoice.type],
      currency: 'EUR',
      correlatedInvoices: [...input.correlatedMarks],
    },
    paymentMethods: [{
      type: myDataPaymentMethodOf(invoice.paymentMethod) ?? 0,
      amount: totalGrossValue,
      paymentMethodInfo: invoice.paymentMethod === 'bank_transfer' ? invoice.issuer.bankAccounts[0]?.iban ?? null : null,
    }],
    invoiceDetails: rows,
    invoiceSummary: {
      totalNetValue, totalVatAmount, totalWithheldAmount,
      totalFeesAmount: 0, totalStampDutyAmount: 0, totalOtherTaxesAmount: 0, totalDeductionsAmount: 0,
      totalGrossValue,
      incomeClassification: summarizeClassifications(rows),
    },
  };
}

/** Τιμολόγιο → payload ΑΑΔΕ, ή τα προβλήματα που το εμποδίζουν. Ποτέ μισό payload. */
export function buildMyDataInvoicePayload(input: MyDataTransmissionInput): MyDataPayloadResult {
  const issues = preflightMyDataInvoice(input);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, payload: assemble(input, buildRows(input.invoice)) };
}
