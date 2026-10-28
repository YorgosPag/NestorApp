/**
 * @fileoverview Η **νέα γραμμή τιμολογίου** — ΜΙΑ πηγή για τη φόρμα (`InvoiceForm`) και τον επεξεργαστή γραμμών
 *   (`LineItemsEditor`), που κρατούσαν δύο αντίγραφα του ίδιου αντικειμένου.
 * @module subapps/accounting/components/invoices/forms/invoice-line-defaults
 *
 * Η μονάδα είναι **κωδικός** του μητρώου (`DEFAULT_UOM`), ποτέ μεταφρασμένη ετικέτα: παλιότερα γραφόταν `t('units.pieces')`,
 * δηλαδή «τεμ» ή «pcs» ανάλογα με τη γλώσσα του χρήστη που το έφτιαξε (ADR-923 §5.11 «3γ» 4δ).
 */

import { DEFAULT_UOM } from '@/lib/uom/uom-registry';
import type { InvoiceLineItem, MyDataIncomeType } from '@/subapps/accounting/types';

/** Παροχή υπηρεσιών — η προεπιλεγμένη κατηγορία εσόδου myDATA μιας νέας γραμμής. */
const DEFAULT_LINE_MYDATA_CODE: MyDataIncomeType = 'category1_3';

export function newInvoiceLineItem(lineNumber: number): InvoiceLineItem {
  return {
    lineNumber,
    description: '',
    quantity: 1,
    unit: DEFAULT_UOM,
    unitPrice: 0,
    vatRate: 24,
    netAmount: 0,
    mydataCode: DEFAULT_LINE_MYDATA_CODE,
  };
}
