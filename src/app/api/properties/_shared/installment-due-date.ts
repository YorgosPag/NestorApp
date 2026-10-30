/**
 * «Πότε λήγει η δόση;» στα σύνορα του πλάνου πληρωμών (ADR-234) — **ένας** κριτής για τη δημιουργία πλάνου
 * (`payment-plan/route.ts`) και για την προσθήκη/διόρθωση δόσης (`payment-plan/installments/route.ts`).
 *
 * 🔑 **Ημέρα, όχι στιγμή** (απόφαση 2026-10-29 — πρακτική QuickBooks/Xero · ΑΚ 241· `lib/payment-plan/installment-due-day`).
 * Αποθηκεύεται **πάντα** `YYYY-MM-DD`. Οι πελάτες στέλνουν ημέρα (wizard: `payment-plan-wizard-model.ts` · επεξεργασία:
 * `edit-installment-model.ts`).
 *
 * ⚠️ **Μεταβατική ανοχή**: γίνεται δεκτή και η παλιά μορφή — στιγμή UTC (`…Z`, ό,τι έστελνε το `toISOString()`) — από
 * ανοιχτή καρτέλα με παλιό bundle. Κανονικοποιείται **εδώ** στην ημέρα της στην Αθήνα, άρα στη βάση γράφεται μόνο ημέρα.
 * Ανύπαρκτη ημέρα (`2027-02-30`), ουρά (`2027-02-30xyz`) ή μετατόπιση αντί για `Z` ⇒ 400, όπως πριν.
 *
 * @module api/properties/_shared/installment-due-date
 */

import { z } from 'zod';
import { operatorDayOf, type CalendarDay } from '@/constants/platform-operator';
import { isCalendarDay } from '@/lib/date/calendar-day';

export const INSTALLMENT_DUE_DATE_ERROR = 'dueDate must be an existing calendar day (YYYY-MM-DD)';

/** Η παλιά μορφή των πελατών — μόνο UTC (`Z`), ό,τι βγάζει το `toISOString()`. Κρίνει και την ύπαρξη της ημέρας. */
const legacyInstantSchema = z.string().datetime();

/** Η τιμή του σώματος ⇒ η **κανονική** ημέρα λήξης που γράφεται — ή `null` (⇒ 400). */
export function toInstallmentDueDay(value: unknown): CalendarDay | null {
  if (isCalendarDay(value)) return value;
  return legacyInstantSchema.safeParse(value).success ? operatorDayOf(value as string) : null;
}

/** Το ίδιο, ως σχήμα zod: επικυρώνει **και** κανονικοποιεί (η έξοδος είναι πάντα `YYYY-MM-DD`). */
export const installmentDueDateSchema = z
  .string()
  .refine((value) => toInstallmentDueDay(value) !== null, { message: INSTALLMENT_DUE_DATE_ERROR })
  .transform((value) => toInstallmentDueDay(value) as CalendarDay);
