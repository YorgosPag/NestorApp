/**
 * @fileoverview Η **νέα γραμμή τιμολογίου** — ΜΙΑ πηγή για τη φόρμα (`InvoiceForm`) και τον επεξεργαστή γραμμών
 *   (`LineItemsEditor`), που κρατούσαν δύο αντίγραφα του ίδιου αντικειμένου.
 * @module subapps/accounting/components/invoices/forms/invoice-line-defaults
 *
 * Η μονάδα είναι **κωδικός** του μητρώου (`DEFAULT_UOM`), ποτέ μεταφρασμένη ετικέτα: παλιότερα γραφόταν `t('units.pieces')`,
 * δηλαδή «τεμ» ή «pcs» ανάλογα με τη γλώσσα του χρήστη που το έφτιαξε (ADR-923 §5.11 «3γ» 4δ).
 *
 * 🔑 ADR-ACC-003 §22.4: ο ΦΠΑ της νέας γραμμής έρχεται από το **καθεστώς της επιχείρησης**
 * (`companyLineVatDefault`) — απαλλασσόμενη ⇒ 0% + η δηλωμένη αιτία. Χωρίς προφίλ ⇒ κανονικός συντελεστής.
 */

import { dequal } from 'dequal';

import { DEFAULT_UOM } from '@/lib/uom/uom-registry';
import {
  companyLineVatDefault,
  type CompanyLineVatDefault,
} from '@/subapps/accounting/services/setup/company-vat-regime';
import type { InvoiceLineItem, MyDataIncomeType } from '@/subapps/accounting/types';
import { withVatExemption, withVatRate } from '../../shared/vat-rate-transition';

/** Παροχή υπηρεσιών — η προεπιλεγμένη κατηγορία εσόδου myDATA μιας νέας γραμμής. */
const DEFAULT_LINE_MYDATA_CODE: MyDataIncomeType = 'category1_3';

/** Η αφετηρία όταν το προφίλ δεν έχει φορτωθεί (ή δεν υπάρχει): κανονικός συντελεστής. */
const STANDARD_LINE_VAT: CompanyLineVatDefault = companyLineVatDefault(null);

export function newInvoiceLineItem(lineNumber: number, vat: CompanyLineVatDefault = STANDARD_LINE_VAT): InvoiceLineItem {
  const line: InvoiceLineItem = {
    lineNumber,
    description: '',
    quantity: 1,
    unit: DEFAULT_UOM,
    unitPrice: 0,
    vatRate: vat.vatRate,
    netAmount: 0,
    mydataCode: DEFAULT_LINE_MYDATA_CODE,
  };
  // Η ΙΔΙΑ μετάβαση με τον επιλογέα και το preset: αιτία μόνο εκεί όπου ο συντελεστής τη δέχεται.
  const rated = withVatRate(line, vat.vatRate);
  return vat.vatExemptionCategory === null ? rated : withVatExemption(rated, vat.vatExemptionCategory);
}

/**
 * Γραμμή που ο άνθρωπος **δεν άγγιξε**: ίδια με τη νέα γραμμή της αφετηρίας `from`. Μόνο αυτές επαναφέρονται
 * στην προεπιλογή της επιχείρησης όταν το προφίλ φτάσει **μετά** τη δημιουργία της φόρμας — ό,τι άγγιξε ο
 * χρήστης δεν αλλάζει ποτέ.
 */
export function isPristineInvoiceLine(line: InvoiceLineItem, from: CompanyLineVatDefault = STANDARD_LINE_VAT): boolean {
  return dequal(line, newInvoiceLineItem(line.lineNumber, from));
}

/** Οι ανέγγιχτες γραμμές ξεκινούν από τη νέα αφετηρία· οι υπόλοιπες μένουν ακριβώς ως έχουν. */
export function reseedPristineInvoiceLines(
  lines: readonly InvoiceLineItem[],
  from: CompanyLineVatDefault,
  to: CompanyLineVatDefault,
): InvoiceLineItem[] {
  return lines.map((line) => (isPristineInvoiceLine(line, from) ? newInvoiceLineItem(line.lineNumber, to) : line));
}
