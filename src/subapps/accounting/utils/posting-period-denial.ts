/**
 * @fileoverview Άρνηση καταχώρησης σε περίοδο — κωδικός του server ⇒ κείμενο στη γλώσσα του χρήστη (πελάτης)
 * @description Ο server αρνείται με ΕΝΑΝ κωδικό από τα `POSTING_PERIOD_DENIALS` και δομημένα στοιχεία (χρήση,
 *   αριθμός περιόδου, ημερομηνία). Εδώ γίνονται κείμενο — ΜΙΑ φορά για Ε-Ε, τιμολόγια και τράπεζα (N.11).
 *   Ως 2026-10-16 ο server έστελνε έτοιμη ελληνική πρόταση με την ετικέτα μήνα που είχε ΑΠΟΘΗΚΕΥΣΕΙ η περίοδος.
 *
 *   Ο μήνας ΔΕΝ γράφεται με κλειδιά i18n: είναι δεδομένα CLDR που έχει ήδη ο browser (`formatCalendarMonth`, ονομαστική
 *   «Ιανουάριος 2026»). Μόνο η 13η περίοδος (κλεισίματος) δεν είναι μήνας και έχει δικό της κλειδί.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 7) · types/fiscal-period.ts
 */

import { formatCalendarMonth, formatDateKey } from '@/lib/intl-formatting';
import type { TranslatorFn } from '@/lib/policy/policy-error-translator';

import { ADJUSTMENT_PERIOD_NUMBER, fiscalPeriodKey } from '../services/fiscal-period-keys';
import { POSTING_PERIOD_DENIALS, type PostingPeriodDenial } from '../types/fiscal-period';

/** Τα στοιχεία της άρνησης όπως τα στέλνει ο server (`postingDenialDetailsOf`), όσο τα χρειάζεται το κείμενο. */
export interface PostingDenialBody {
  readonly errorCode?: string;
  readonly postingDate?: string | null;
  readonly fiscalYear?: number | null;
  readonly periodNumber?: number | null;
}

export function isPostingPeriodDenial(code: unknown): code is PostingPeriodDenial {
  return typeof code === 'string' && (POSTING_PERIOD_DENIALS as readonly string[]).includes(code);
}

/** «Ιανουάριος 2026» / «January 2026» — ή «Περίοδος κλεισίματος 2026» για την 13η. */
export function fiscalPeriodLabel(fiscalYear: number, periodNumber: number, t: TranslatorFn): string {
  if (periodNumber === ADJUSTMENT_PERIOD_NUMBER) {
    return t('accounting:fiscalPeriods.adjustmentPeriod', { year: String(fiscalYear) });
  }
  return formatCalendarMonth(fiscalPeriodKey(fiscalYear, periodNumber));
}

/** Το μήνυμα μιας άρνησης καταχώρησης — `null` όταν το σώμα δεν είναι τέτοια άρνηση (ο καλών δείχνει το δικό του). */
export function postingPeriodDenialMessage(body: PostingDenialBody | null, t: TranslatorFn): string | null {
  if (!body || !isPostingPeriodDenial(body.errorCode)) return null;
  const params: Record<string, string> = { date: body.postingDate ? formatDateKey(body.postingDate) : '' };
  if (typeof body.fiscalYear === 'number' && typeof body.periodNumber === 'number') {
    params.period = fiscalPeriodLabel(body.fiscalYear, body.periodNumber, t);
  }
  return t(`accounting:fiscalPeriods.postingDenials.${body.errorCode}`, params);
}
