/**
 * @fileoverview **Εφαρμογή της πρότασης ΦΠΑ του πελάτη στις γραμμές — ΜΙΑ συνάρτηση για προεπισκόπηση και πράξη**
 *   (ADR-ACC-003 §22.5).
 * @module subapps/accounting/components/invoices/forms/customer-vat-application
 *
 * 🔑 **Ό,τι δείχνει η προεπισκόπηση είναι ό,τι κάνει το κουμπί**: η φόρμα καλεί την ίδια συνάρτηση για να δείξει
 * «Γραμμές 1, 3: 24% → 0%» και για να εφαρμόσει. Δύο υπολογισμοί θα μπορούσαν να διαφωνήσουν· ένας δεν μπορεί.
 *
 * 🔑 Η μετάβαση περνά από τα **υπάρχοντα** `withVatRate` / `withVatExemption` (ίδιος κανόνας με επιλογέα, preset και
 * νέα γραμμή). Γραμμή ήδη 0% **με** αιτία μένει ως έχει: εκεί ο άνθρωπος (ή η υπηρεσία) έχει ήδη αποφασίσει.
 */

import { dequal } from 'dequal';

import { isVatExemptionCode } from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { requiresVatExemption } from '@/subapps/accounting/services/mydata/mydata-codes';
import type { CustomerVatSuggestion } from '@/subapps/accounting/services/tax/customer-vat-treatment';
import type { InvoiceLineItem } from '@/subapps/accounting/types';
import { withVatExemption, withVatRate } from '../../shared/vat-rate-transition';

export interface CustomerVatLineChange {
  readonly lineNumber: number;
  readonly fromRate: number;
  /** Η αιτία πριν την εφαρμογή — για την αναίρεση. */
  readonly fromExemption: number | null;
}

export interface CustomerVatApplication {
  readonly lines: InvoiceLineItem[];
  readonly changes: readonly CustomerVatLineChange[];
}

function hasDecidedExemption(line: InvoiceLineItem): boolean {
  return requiresVatExemption(line.vatRate) && isVatExemptionCode(line.vatExemptionCategory);
}

/** Γραμμές → γραμμές μετά την πρόταση + ποιες άλλαξαν (για την προεπισκόπηση). Καθαρή — καμία μετάλλαξη. */
export function planCustomerVatApplication(
  lines: readonly InvoiceLineItem[],
  suggestion: Pick<CustomerVatSuggestion, 'vatRate' | 'vatExemptionCategory'>,
): CustomerVatApplication {
  const changes: CustomerVatLineChange[] = [];
  const next = lines.map((line) => {
    if (hasDecidedExemption(line)) return line;
    const applied = withVatExemption(withVatRate(line, suggestion.vatRate), suggestion.vatExemptionCategory);
    if (dequal(applied, line)) return line;
    changes.push({ lineNumber: line.lineNumber, fromRate: line.vatRate, fromExemption: line.vatExemptionCategory ?? null });
    return applied;
  });
  return { lines: next, changes };
}

/**
 * **Αναίρεση χωρίς να χαθεί δουλειά**: επαναφέρει μόνο γραμμές που άλλαξε η εφαρμογή **και** κρατούν ακόμη ακριβώς
 * τον ΦΠΑ της πρότασης. Ό,τι άγγιξε ο άνθρωπος μετά (ΦΠΑ, περιγραφή, νέες γραμμές) μένει — όχι στιγμιότυπο της φόρμας.
 */
export function revertCustomerVatApplication(
  lines: readonly InvoiceLineItem[],
  suggestion: Pick<CustomerVatSuggestion, 'vatRate' | 'vatExemptionCategory'>,
  changes: readonly CustomerVatLineChange[],
): InvoiceLineItem[] {
  const prior = new Map(changes.map((change) => [change.lineNumber, change]));
  return lines.map((line) => {
    const change = prior.get(line.lineNumber);
    const untouched = line.vatRate === suggestion.vatRate && line.vatExemptionCategory === suggestion.vatExemptionCategory;
    if (!change || !untouched) return line;
    return { ...line, vatRate: change.fromRate, vatExemptionCategory: change.fromExemption };
  });
}
