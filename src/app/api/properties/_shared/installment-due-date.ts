/**
 * «Πότε λήγει η δόση;» στα σύνορα του πλάνου πληρωμών (ADR-234) — **ένας** κριτής για τη δημιουργία πλάνου
 * (`payment-plan/route.ts`) και για την προσθήκη/διόρθωση δόσης (`payment-plan/installments/route.ts`).
 *
 * 🔑 **Στιγμή, όχι ημερολογιακή ημέρα.** Οι δύο πελάτες στέλνουν `toISOString()` (wizard:
 * `payment-plan-wizard-model.ts` · επεξεργασία: `edit-installment-model.ts`), και το `Installment.dueDate`
 * αποθηκεύεται έτσι. Το παλιό `regex(/^\d{4}-\d{2}-\d{2}/)` (πρόθεμα, χωρίς `$`) δεχόταν `2027-02-30T…` **και**
 * `2027-02-30xyz`· η διόρθωση δόσης δεν έλεγχε καθόλου μορφή. Κριτής: το `z.string().datetime()` του zod — κρίνει
 * και την ύπαρξη της ημέρας (δίσεκτα), όπως το `isCalendarDay` για τις σκέτες ημέρες (ADR-919).
 *
 * ⚠️ **Μόνο UTC (`Z`)**, χωρίς μετατόπιση: οι αναγνώστες ταξινομούν/συγκρίνουν τις λήξεις ως συμβολοσειρές, και
 * ανάμεικτες μετατοπίσεις (`+02:00` δίπλα σε `Z`) θα έδιναν λάθος σειρά χωρίς σφάλμα.
 *
 * @module api/properties/_shared/installment-due-date
 */

import { z } from 'zod';

export const INSTALLMENT_DUE_DATE_ERROR = 'dueDate must be an ISO 8601 UTC instant (YYYY-MM-DDTHH:mm:ss.sssZ) on an existing day';

export const installmentDueDateSchema = z.string().datetime({ message: INSTALLMENT_DUE_DATE_ERROR });

/** Ο ίδιος κριτής για τα σύνορα που δεν περνούν από σχήμα zod. */
export function isInstallmentDueDate(value: unknown): value is string {
  return installmentDueDateSchema.safeParse(value).success;
}
