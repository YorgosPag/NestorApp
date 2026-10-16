/**
 * Άγκυρα — **η άρνηση καταχώρησης γίνεται κείμενο ΜΟΝΟ στον πελάτη** (ADR-ACC-010 §2.1.1 Φάση 7).
 *
 * Ο server στέλνει κωδικό + χρήση/αριθμό περιόδου· εδώ κλειδώνεται ότι (α) κάθε κωδικός του λεξιλογίου έχει κλειδί,
 * (β) ο μήνας βγαίνει από CLDR στη γλώσσα του χρήστη, η 13η από δικό της κλειδί, (γ) ό,τι δεν είναι άρνηση περιόδου
 * επιστρέφει `null` για να το χειριστεί ο καλών (π.χ. πιστωτικό όριο).
 */

import el from '@/i18n/locales/el/accounting.json';
import en from '@/i18n/locales/en/accounting.json';
import { POSTING_PERIOD_DENIALS } from '../../types/fiscal-period';
import { fiscalPeriodLabel, isPostingPeriodDenial, postingPeriodDenialMessage } from '../posting-period-denial';

jest.mock('@/lib/intl-utils', () => ({ getCurrentLocale: () => 'el' }));

/** Μεταφραστής που επιστρέφει «κλειδί|παράμετροι» — δείχνει ΤΙ ζητήθηκε, όχι ένα κείμενο. */
const t = (key: string, params?: Record<string, string>) => `${key}|${JSON.stringify(params ?? {})}`;

describe('λεξιλόγιο ↔ locales', () => {
  it.each(POSTING_PERIOD_DENIALS)('%s έχει κείμενο σε el ΚΑΙ en', (code) => {
    expect(el.fiscalPeriods.postingDenials[code]).toBeTruthy();
    expect(en.fiscalPeriods.postingDenials[code]).toBeTruthy();
  });

  it('οι αποσβέσεις μιλούν το ΙΔΙΟ λεξιλόγιο — κανένα `PERIOD_NOT_OPEN`', () => {
    for (const code of POSTING_PERIOD_DENIALS) {
      expect(el.assets.depreciationRun.errors[code]).toBeTruthy();
      expect(en.assets.depreciationRun.errors[code]).toBeTruthy();
    }
    expect(el.assets.depreciationRun.errors).not.toHaveProperty('PERIOD_NOT_OPEN');
  });
});

describe('fiscalPeriodLabel', () => {
  it('μήνας ⇒ CLDR ονομαστική («Μάρτιος 2026», όχι «Μαρτίου»)', () => {
    expect(fiscalPeriodLabel(2026, 3, t)).toBe('Μάρτιος 2026');
  });

  it('13η περίοδος ⇒ δικό της κλειδί, ποτέ «Δεκέμβριος»', () => {
    expect(fiscalPeriodLabel(2026, 13, t)).toBe('accounting:fiscalPeriods.adjustmentPeriod|{"year":"2026"}');
  });
});

describe('postingPeriodDenialMessage', () => {
  it.each(['PERIOD_CLOSED', 'PERIOD_LOCKED'] as const)('%s ⇒ κλειδί του κωδικού + ετικέτα περιόδου από `periodNumber`', (code) => {
    const message = postingPeriodDenialMessage({ errorCode: code, postingDate: '2026-03-10', fiscalYear: 2026, periodNumber: 3 }, t);
    expect(message).toBe(`accounting:fiscalPeriods.postingDenials.${code}|${JSON.stringify({ date: '10/03/2026', period: 'Μάρτιος 2026' })}`);
  });

  it('PERIOD_NOT_FOUND ⇒ μόνο η ημερομηνία (δεν υπάρχει περίοδος να ονομαστεί)', () => {
    const message = postingPeriodDenialMessage({ errorCode: 'PERIOD_NOT_FOUND', postingDate: '2027-01-10', fiscalYear: null, periodNumber: null }, t);
    expect(message).toMatch(/^accounting:fiscalPeriods\.postingDenials\.PERIOD_NOT_FOUND\|/);
    expect(message).not.toContain('"period"');
  });

  it.each([null, {}, { errorCode: 'POLICY_CREDIT_LIMIT_EXCEEDED' }, { errorCode: 'PERIOD_NOT_OPEN' }])('%o ⇒ null (δεν είναι άρνηση περιόδου)', (body) => {
    expect(postingPeriodDenialMessage(body, t)).toBeNull();
  });

  it('isPostingPeriodDenial δέχεται μόνο το λεξιλόγιο', () => {
    expect(POSTING_PERIOD_DENIALS.every(isPostingPeriodDenial)).toBe(true);
    expect(isPostingPeriodDenial('FISCAL_YEAR_NOT_ENDED')).toBe(false);
    expect(isPostingPeriodDenial(null)).toBe(false);
  });
});
