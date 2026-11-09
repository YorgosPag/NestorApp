/**
 * @fileoverview **Ο συντελεστής ΦΠΑ μιας γραμμής και η αιτία εξαίρεσής του — ΜΙΑ μετάβαση** (ADR-ACC-003 §7 · §22).
 * @module subapps/accounting/components/invoices/forms/invoice-line-vat
 *
 * 🔑 Η αιτία εξαίρεσης έχει νόημα **μόνο** στην κατηγορία «Άνευ ΦΠΑ» (0%). Όταν ο συντελεστής φεύγει από εκεί —
 * από τον επιλογέα **ή** από έτοιμη υπηρεσία (`ServicePreset`) — η αιτία **καθαρίζει**: αλλιώς μένει
 * αποθηκευμένος κωδικός που λέει «απαλλαγή» σε γραμμή με 24%. Καθαρή συνάρτηση, μία για τις δύο διαδρομές.
 */

import type { InvoiceLineItem } from '@/subapps/accounting/types';
import type { VatExemptionCode } from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { requiresVatExemption } from '@/subapps/accounting/services/mydata/mydata-codes';

/** Νέος συντελεστής· εκτός «Άνευ ΦΠΑ» η αιτία γίνεται `null`. Στο 0% η υπάρχουσα αιτία **μένει**. */
export function withLineVatRate(item: InvoiceLineItem, vatRate: number): InvoiceLineItem {
  return requiresVatExemption(vatRate)
    ? { ...item, vatRate }
    : { ...item, vatRate, vatExemptionCategory: null };
}

/** Αιτία εξαίρεσης — μόνο αν ο συντελεστής τη δέχεται· αλλιώς η γραμμή μένει ως έχει. */
export function withLineVatExemption(item: InvoiceLineItem, code: VatExemptionCode): InvoiceLineItem {
  return requiresVatExemption(item.vatRate) ? { ...item, vatExemptionCategory: code } : item;
}
