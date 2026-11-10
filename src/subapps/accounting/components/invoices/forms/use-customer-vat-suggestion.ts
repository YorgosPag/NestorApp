/**
 * @fileoverview **Η πρόταση ΦΠΑ του πελάτη στη φόρμα τιμολογίου** — κρίση, προεπισκόπηση, εφαρμογή, απόρριψη,
 *   αναίρεση (ADR-ACC-003 §22.5).
 * @module subapps/accounting/components/invoices/forms/use-customer-vat-suggestion
 *
 * 🔑 **Ποτέ σιωπηλή εφαρμογή**: ο τόπος παροχής είναι νομική κρίση. Το hook μόνο **κρίνει** και **δείχνει**· οι
 * γραμμές και ο τύπος αλλάζουν μόνο με `apply()` (πάτημα ανθρώπου), με προεπισκόπηση από την ίδια συνάρτηση.
 *
 * 🔑 **Προτεραιότητα**: γραμμή > υπηρεσία (§22.3) > πελάτης (εδώ) > εταιρεία (§22.4). Η εφαρμογή δεν αγγίζει γραμμή
 * που έχει ήδη 0% με αιτία· η αποδεκτή πρόταση γίνεται αφετηρία μόνο των **νέων** γραμμών, όσο ισχύει για τον ίδιο
 * πελάτη (`customerVatSuggestionKey`).
 */

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import type { InvoiceCustomer, InvoiceLineItem, InvoiceType } from '@/subapps/accounting/types';
import type { CompanyLineVatDefault } from '@/subapps/accounting/services/setup/company-vat-regime';
import {
  assessCustomerVatTreatment,
  customerVatSuggestionKey,
  lineVatDefaultOf,
  type CustomerVatAssessment,
  type CustomerVatSuggestion,
} from '@/subapps/accounting/services/tax/customer-vat-treatment';
import {
  planCustomerVatApplication,
  revertCustomerVatApplication,
  type CustomerVatLineChange,
} from './customer-vat-application';

/** Ό,τι της φόρμας διαβάζει και αλλάζει η πρόταση. */
export interface CustomerVatFormSlice {
  readonly type: InvoiceType;
  readonly customer: InvoiceCustomer;
  readonly lineItems: InvoiceLineItem[];
}

interface AppliedRecord {
  readonly key: string;
  readonly suggestion: CustomerVatSuggestion;
  readonly changes: readonly CustomerVatLineChange[];
  readonly fromType: InvoiceType;
}

export type CustomerVatSuggestionView =
  | { readonly status: 'hidden' }
  | { readonly status: 'unknown_country'; readonly country: string }
  | {
      readonly status: 'pending';
      readonly suggestion: CustomerVatSuggestion;
      readonly changes: readonly CustomerVatLineChange[];
      readonly fromType: InvoiceType;
    }
  | { readonly status: 'applied'; readonly suggestion: CustomerVatSuggestion };

export interface CustomerVatSuggestionControls {
  readonly view: CustomerVatSuggestionView;
  readonly apply: () => void;
  readonly dismiss: () => void;
  readonly undo: () => void;
  /** Αφετηρία νέων γραμμών από την αποδεκτή πρόταση, ή `null` (ισχύει η αφετηρία της εταιρείας). */
  readonly acceptedLineVatDefault: CompanyLineVatDefault | null;
}

function viewOf(
  assessment: CustomerVatAssessment,
  key: string | null,
  form: CustomerVatFormSlice,
  dismissedKey: string | null,
  applied: AppliedRecord | null,
): CustomerVatSuggestionView {
  if (assessment.kind === 'unknown_country') return { status: 'unknown_country', country: assessment.country };
  if (assessment.kind !== 'suggestion' || key === null || key === dismissedKey) return { status: 'hidden' };
  if (applied?.key === key) return { status: 'applied', suggestion: assessment };
  const { changes } = planCustomerVatApplication(form.lineItems, assessment);
  return { status: 'pending', suggestion: assessment, changes, fromType: form.type };
}

export function useCustomerVatSuggestion<T extends CustomerVatFormSlice>(
  form: T,
  setForm: Dispatch<SetStateAction<T>>,
): CustomerVatSuggestionControls {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedRecord | null>(null);

  const assessment = useMemo(
    () => assessCustomerVatTreatment(form.customer, form.type),
    [form.customer, form.type],
  );
  const key = assessment.kind === 'suggestion' ? customerVatSuggestionKey(form.customer, assessment) : null;
  const view = viewOf(assessment, key, form, dismissedKey, applied);

  const apply = useCallback(() => {
    if (view.status !== 'pending' || key === null) return;
    const { suggestion, fromType } = view;
    const { lines, changes } = planCustomerVatApplication(form.lineItems, suggestion);
    setApplied({ key, suggestion, changes, fromType });
    setForm((prev) => ({ ...prev, type: suggestion.invoiceType, lineItems: lines }));
  }, [view, key, form.lineItems, setForm]);

  const dismiss = useCallback(() => setDismissedKey(key), [key]);

  const undo = useCallback(() => {
    if (!applied) return;
    const { suggestion, changes, fromType } = applied;
    setApplied(null);
    setForm((prev) => ({
      ...prev,
      // Ο τύπος γυρίζει μόνο αν είναι ακόμη αυτός που έβαλε η εφαρμογή — μια αλλαγή του ανθρώπου μένει.
      type: prev.type === suggestion.invoiceType ? fromType : prev.type,
      lineItems: revertCustomerVatApplication(prev.lineItems, suggestion, changes),
    }));
  }, [applied, setForm]);

  const acceptedLineVatDefault = view.status === 'applied' ? lineVatDefaultOf(view.suggestion) : null;

  return { view, apply, dismiss, undo, acceptedLineVatDefault };
}
