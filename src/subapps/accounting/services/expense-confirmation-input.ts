/**
 * Expense confirmation — WHAT the human confirmed, and the journal entry it posts (pure)
 *
 * - **A missing figure is not 0 €** (ADR-917 Φ4.0 · SPEC-242C §3.1): when the AI read no net amount, no VAT or
 *   no date and the human typed none either, the confirmation is REFUSED with the missing fields — the old
 *   flow wrote `0` / «today» and an expense of 0 € reached the ledger and the VAT return as a fact.
 * - The posted journal entry is composed here ONCE (it used to live in `AccountingService`, called only by
 *   the confirm route).
 *
 * @module subapps/accounting/services/expense-confirmation-input
 * @see ADR-917 Φ4.0 · ADR-ACC-005
 */

import type { CreateJournalEntryInput } from '../types/journal';
import type { AccountCategory, ExpenseCategory, PaymentMethod } from '../types/common';
import type { ReceivedExpenseDocument } from '../types/documents';
import { getQuarterFromDate } from './repository/firestore-helpers';

/** What the confirm request may carry — every field optional (the AI extraction fills the gaps) */
interface ExpenseConfirmationRequest {
  readonly confirmedCategory?: string;
  readonly confirmedNetAmount?: number;
  readonly confirmedVatAmount?: number;
  readonly confirmedDate?: string;
  readonly confirmedIssuerName?: string;
  readonly notes?: string;
}

/** The figures that, absent, would have been guessed */
type ExpenseConfirmationField = 'netAmount' | 'vatAmount' | 'date';

export interface ExpenseConfirmation {
  readonly category: ExpenseCategory;
  readonly netAmount: number;
  readonly vatAmount: number;
  readonly date: string;
  readonly issuerName: string | null;
  readonly notes: string | null;
}

type ExpenseConfirmationResolution =
  | { readonly ok: true; readonly confirmation: ExpenseConfirmation }
  | { readonly ok: false; readonly missing: readonly ExpenseConfirmationField[] };

const DEFAULT_EXPENSE_CATEGORY: ExpenseCategory = 'other_expense';

const firstDefined = <T>(...values: ReadonlyArray<T | null | undefined>): T | null => {
  for (const value of values) if (value !== null && value !== undefined) return value;
  return null;
};

/** Request ⊕ earlier confirmation ⊕ AI extraction — never a made-up figure */
export function resolveExpenseConfirmation(
  document: Pick<ReceivedExpenseDocument, 'extractedData' | 'confirmedCategory' | 'confirmedIssuerName' | 'notes'>,
  request: ExpenseConfirmationRequest,
): ExpenseConfirmationResolution {
  const extracted = document.extractedData;
  const netAmount = firstDefined(request.confirmedNetAmount, extracted.netAmount);
  const vatAmount = firstDefined(request.confirmedVatAmount, extracted.vatAmount);
  const date = firstDefined(request.confirmedDate?.trim() || null, extracted.issueDate);
  const missing: ExpenseConfirmationField[] = [];
  if (netAmount === null) missing.push('netAmount');
  if (vatAmount === null) missing.push('vatAmount');
  if (date === null) missing.push('date');
  if (netAmount === null || vatAmount === null || date === null) return { ok: false, missing };
  return {
    ok: true,
    confirmation: {
      category: (request.confirmedCategory ?? document.confirmedCategory ?? DEFAULT_EXPENSE_CATEGORY) as ExpenseCategory,
      netAmount,
      vatAmount,
      date,
      issuerName: firstDefined(request.confirmedIssuerName, document.confirmedIssuerName, extracted.issuerName),
      notes: firstDefined(request.notes, document.notes),
    },
  };
}

/** VAT rate in whole percent; a zero net amount has no rate (never a division by zero) */
function vatRateOf(netAmount: number, vatAmount: number): number {
  return netAmount > 0 && vatAmount > 0 ? Math.round((vatAmount / netAmount) * 100) : 0;
}

/** The journal entry a confirmed expense document posts */
export function buildExpenseJournalInput(
  document: Pick<ReceivedExpenseDocument, 'documentId' | 'fileName' | 'fiscalYear' | 'extractedData'>,
  confirmation: ExpenseConfirmation,
): CreateJournalEntryInput {
  const paymentMethod: PaymentMethod = document.extractedData.paymentMethod ?? 'bank_transfer';
  const description = confirmation.issuerName
    ? `Παραστατικό: ${document.fileName} — ${confirmation.issuerName}`
    : `Παραστατικό: ${document.fileName}`;
  return {
    date: confirmation.date,
    type: 'expense',
    category: confirmation.category as AccountCategory,
    description,
    netAmount: confirmation.netAmount,
    vatRate: vatRateOf(confirmation.netAmount, confirmation.vatAmount),
    vatAmount: confirmation.vatAmount,
    grossAmount: confirmation.netAmount + confirmation.vatAmount,
    vatDeductible: true,
    paymentMethod,
    contactId: null,
    contactName: confirmation.issuerName,
    invoiceId: null,
    mydataCode: 'category2_4',
    e3Code: '585_001',
    fiscalYear: document.fiscalYear,
    quarter: getQuarterFromDate(confirmation.date),
    notes: `AI Document: ${document.documentId}`,
  };
}
