/**
 * @fileoverview Μήνυμα αποτυχίας υποβολής τιμολογίου — κωδικός πολιτικής ⇒ μεταφρασμένο κείμενο
 * @description Ο server απορρίπτει με σταθερό κωδικό (`POLICY_ERROR_CODES`, ADR-284) και δομημένα ποσά· το κείμενο
 *   το αποδίδει ο πελάτης στη γλώσσα του χρήστη (N.11). Ως 2026-10-15 η φόρμα έδειχνε το ωμό `error` του server —
 *   και το μήνυμα πιστωτικού ορίου ήταν σκληρογραμμένα ελληνικά μέσα στο `balance-service`.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 3) · lib/policy/policy-error-translator.ts
 */

import { translatePolicyError, type TranslatorFn } from '@/lib/policy/policy-error-translator';

import { formatAccountingCurrency } from '../../../utils/format';
import { postingPeriodDenialMessage, type PostingDenialBody } from '../../../utils/posting-period-denial';

/** Ο φάκελος σφάλματος του API, όσο τον χρειάζεται η φόρμα. */
export interface InvoiceSubmitErrorBody extends PostingDenialBody {
  readonly error?: string;
  readonly creditCheck?: { readonly projectedExposure: number };
  readonly creditLimit?: number | null;
}

/** Τα ποσά του πιστωτικού ορίου ως παράμετροι ICU — μόνο όταν ο server τα έστειλε. */
function creditParamsOf(body: InvoiceSubmitErrorBody): Record<string, string> | undefined {
  if (!body.creditCheck || typeof body.creditLimit !== 'number') return undefined;
  return {
    projected: formatAccountingCurrency(body.creditCheck.projectedExposure),
    limit: formatAccountingCurrency(body.creditLimit),
  };
}

/** Οι δύο μεταφραστές της φόρμας: μηνύματα πολιτικής (`POLICY_ERROR_NAMESPACES`) και λογιστικής (περίοδοι). */
export interface InvoiceSubmitTranslators {
  readonly policy: TranslatorFn;
  readonly accounting: TranslatorFn;
}

/** Άρνηση περιόδου ή γνωστή άρνηση πολιτικής ⇒ μεταφρασμένη· αλλιώς το μήνυμα του server (ή ο κωδικός HTTP). */
export function invoiceSubmitErrorMessage(body: InvoiceSubmitErrorBody | null, status: number, t: InvoiceSubmitTranslators): string {
  const fallback = body?.error ?? `HTTP ${status}`;
  if (!body) return fallback;
  return postingPeriodDenialMessage(body, t.accounting)
    ?? translatePolicyError(body.errorCode, t.policy, fallback, creditParamsOf(body));
}
