/**
 * @fileoverview **Αντίστροφη επιβάρυνση — ποιες γραμμές την έχουν** (ADR-ACC-003 §22.9).
 * @module subapps/accounting/services/tax/reverse-charge
 *
 * ⚖️ ν. 4308/2014 άρθρο 9 §1 περ. ιγ: «Όταν ο λήπτης είναι υπόχρεος καταβολής του Φ.Π.Α., η αναφορά «Αντίστροφη
 * επιβάρυνση»» (Οδηγία 2006/112/ΕΚ άρθρο 226 §11α· άρθρο 219α §2 — ισχύουν οι κανόνες του κράτους του προμηθευτή).
 * ΔΕΕ C-247/21: η ένδειξη είναι υποχρεωτική **κατά λέξη** — άλλη διατύπωση δεν την αντικαθιστά.
 *
 * 🔑 **Κανένα νέο δεδομένο**: «ο λήπτης είναι υπόχρεος» είναι ακριβώς η κατηγορία EN 16931 **`AE`** (UNCL5305 «VAT
 * reverse charge»), που ο ΕΝΑΣ κατάλογος ήδη δηλώνει (αιτία 16 πάντα· αιτία 4 μόνο για επιχείρηση ΕΕ) και ο ΕΝΑΣ
 * επιλυτής ήδη κρίνει. Εδώ ζει μόνο η ερώτηση.
 * 🔑 Αιτία 4 με αντίφαση πελάτη (`needs_review`) **δεν** παίρνει ένδειξη — δεν μαντεύουμε· το πιάνει ο έλεγχος §22.8.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import { isVatExemptionCode } from '../config/vat-exemption-reasons';
import { requiresVatExemption } from '../mydata/mydata-codes';
import { resolveEn16931VatTreatment, type En16931LineFacts } from './en16931-vat-treatment';
import type { InvoiceVatReviewInput } from './invoice-vat-review';

/** Η κατηγορία EN 16931 της αντίστροφης επιβάρυνσης (UNTDID 5305). */
const REVERSE_CHARGE_CATEGORY = 'AE';

/** Ο λήπτης είναι υπόχρεος καταβολής του ΦΠΑ γι' αυτή τη γραμμή; */
export function isReverseChargeLine(facts: En16931LineFacts): boolean {
  const resolution = resolveEn16931VatTreatment(facts, 'en16931');
  return resolution.kind === 'resolved' && resolution.category === REVERSE_CHARGE_CATEGORY;
}

/** Οι αριθμοί των γραμμών με αντίστροφη επιβάρυνση, κατά σειρά γραμμής. Καθαρή συνάρτηση. */
export function reverseChargeLineNumbers(input: InvoiceVatReviewInput): number[] {
  return input.lineItems.flatMap((line) => {
    const code = line.vatExemptionCategory;
    if (!requiresVatExemption(line.vatRate) || !isVatExemptionCode(code)) return [];
    const facts: En16931LineFacts = { vatExemptionCategory: code, customer: input.customer, invoiceType: input.type };
    return isReverseChargeLine(facts) ? [line.lineNumber] : [];
  });
}
