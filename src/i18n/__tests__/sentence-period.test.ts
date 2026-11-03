/**
 * ADR-279 · ADR-923 §5.14.1 — «η τελεία της συντομογραφίας κλείνει και την πρόταση», σε ΚΑΘΕ διαδρομή απόδοσης:
 * ο κανόνας μόνος του, ο server (`formatBundleText`) και ο client (i18next + ICU + postProcessor, όπως η παραγωγή).
 */

import { createRealI18n } from '@/test-utils/real-i18n';
import { formatBundleText } from '../bundle-translate';
import { absorbSentencePeriod } from '../sentence-period';

const PM = '03/11/2026, 09:15 μ.μ.';

describe('absorbSentencePeriod — ο κανόνας', () => {
  it('🔴 το περιστατικό: τιμή με τελεία συντομογραφίας στο τέλος πρότασης ⇒ ΜΙΑ τελεία', () => {
    expect(absorbSentencePeriod(`Ίσχυαν στις ${PM}.`, { date: PM })).toBe(`Ίσχυαν στις ${PM}`);
  });

  it('η ίδια τελεία κλείνει και πρόταση στη μέση κειμένου (επωνυμία «Α.Ε.»)', () => {
    expect(absorbSentencePeriod('Από ΝΕΣΤΩΡ Α.Ε.. Συνέχεια.', { name: 'ΝΕΣΤΩΡ Α.Ε.' })).toBe('Από ΝΕΣΤΩΡ Α.Ε. Συνέχεια.');
  });

  it('⛔ δεν αγγίζει: τιμή χωρίς τελεία (24ωρο, «PM»), ερωτηματικό μετά τη συντομογραφία, μόνη τελεία', () => {
    expect(absorbSentencePeriod('At 21:15.', { date: '21:15' })).toBe('At 21:15.');
    expect(absorbSentencePeriod('At 9:15 PM.', { date: '9:15 PM' })).toBe('At 9:15 PM.');
    expect(absorbSentencePeriod('Στις 9:15 μ.μ.;', { date: '9:15 μ.μ.' })).toBe('Στις 9:15 μ.μ.;');
    expect(absorbSentencePeriod('Τέλος..', { mark: '.' })).toBe('Τέλος..');
  });

  it('⛔ δεν αγγίζει επιλογές του t() που δεν αποδίδονται (defaultValue, lng …) ούτε χωρίς τιμές', () => {
    expect(absorbSentencePeriod('Κάτι α.α..', { defaultValue: 'α.α.' })).toBe('Κάτι α.α..');
    expect(absorbSentencePeriod('Κάτι μ.μ..', undefined)).toBe('Κάτι μ.μ..');
  });
});

describe('server — formatBundleText', () => {
  it('ο ίδιος κανόνας μετά την παρεμβολή', () => {
    expect(formatBundleText('Διαγράφεται στις {date}.', { date: PM })).toBe(`Διαγράφεται στις ${PM}`);
  });
});

describe('client — i18next της παραγωγής πάνω στα πραγματικά μηνύματα της αναφοράς xChange', () => {
  it('🔴 «…μ.μ..» ⇒ «…μ.μ.» · ICU plural σε ενικό και πληθυντικό (2026-11-03, ζωντανή οθόνη)', async () => {
    const i18n = await createRealI18n(['catalog'], 'el');
    const t = i18n.getFixedT('el', 'catalog');
    expect(t('xchangeExport.report.at', { date: PM })).toBe(`Τιμές και ορατότητα όπως ίσχυαν στις ${PM}`);
    expect(t('xchangeExport.report.hidden', { count: 1 })).toBe('1 προϊόν είναι κρυφό για το κοινό και δεν εξήχθη.');
    expect(t('xchangeExport.report.hidden', { count: 8 })).toBe('8 προϊόντα είναι κρυφά για το κοινό και δεν εξήχθησαν.');
    expect(t('xchangeExport.reason.visibleNoPrice', { count: 1 })).toBe('1 ορατό χωρίς τιμή');
    expect(t('xchangeExport.reason.visibleNoPrice', { count: 3 })).toBe('3 ορατά χωρίς τιμή');
    expect(t('issues.fenceConfirmationRequired', { count: 1 })).toMatch(/^1 γραμμή αλλάζει τιμή/);
  });

  it('αγγλικά: 24ωρο en-GB χωρίς τελεία ⇒ η τελεία του μηνύματος μένει· plural στο fence', async () => {
    const i18n = await createRealI18n(['catalog'], 'en');
    const t = i18n.getFixedT('en', 'catalog');
    expect(t('xchangeExport.report.at', { date: '03/11/2026, 21:15' })).toBe('Prices and visibility as of 03/11/2026, 21:15.');
    expect(t('issues.fenceConfirmationRequired', { count: 1 })).toMatch(/^1 line changes price/);
  });
});
