/**
 * @fileoverview Η αφετηρία ΦΠΑ των νέων γραμμών από το **καθεστώς της επιχείρησης** (ADR-ACC-003 §22.4).
 * @module subapps/accounting/components/invoices/forms/use-company-line-vat-default
 *
 * Μετακόμισε αυτούσιο από το `InvoiceForm.tsx` (§22.5 — το αρχείο ήταν στο όριο των 500 γραμμών).
 *
 * Η φόρμα φτιάχνει την πρώτη γραμμή **πριν** φορτωθεί το προφίλ (κανονικός συντελεστής)· όταν φτάσει, **μόνο οι
 * ανέγγιχτες** γραμμές ξεκινούν από τη νέα αφετηρία (`reseedPristineInvoiceLines`) — ό,τι άγγιξε ο άνθρωπος δεν
 * αλλάζει, και η επεξεργασία τιμολογίου ποτέ.
 */

import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { dequal } from 'dequal';

import type { CompanyProfile, InvoiceLineItem } from '@/subapps/accounting/types';
import {
  companyLineVatDefault,
  type CompanyLineVatDefault,
} from '@/subapps/accounting/services/setup/company-vat-regime';
import { reseedPristineInvoiceLines } from './invoice-line-defaults';

export function useCompanyLineVatDefault<T extends { lineItems: InvoiceLineItem[] }>(
  profile: Pick<CompanyProfile, 'vatRegime' | 'vatExemptionCategory'> | null | undefined,
  editMode: boolean,
  setForm: Dispatch<SetStateAction<T>>,
): CompanyLineVatDefault {
  const vatRegime = profile?.vatRegime ?? 'normal';
  const exemptionCode = profile?.vatExemptionCategory ?? null;
  const lineVatDefault = useMemo(
    () => companyLineVatDefault({ vatRegime, vatExemptionCategory: exemptionCode }),
    [vatRegime, exemptionCode],
  );
  const seededFrom = useRef<CompanyLineVatDefault>(companyLineVatDefault(null));

  useEffect(() => {
    const from = seededFrom.current;
    seededFrom.current = lineVatDefault;
    if (editMode || dequal(from, lineVatDefault)) return;
    setForm((prev) => ({ ...prev, lineItems: reseedPristineInvoiceLines(prev.lineItems, from, lineVatDefault) }));
  }, [editMode, lineVatDefault, setForm]);

  return lineVatDefault;
}
