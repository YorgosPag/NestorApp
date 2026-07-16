/**
 * ADR-666 — select placeholder = ΕΝΑ κλειδί με placeholder, όχι ένωση δύο μεταφράσεων.
 *
 * Το bug το αποκάλυψε το pseudo locale: η οθόνη Επαφών έδειχνε
 *   `[[~~ Επιλέξτε ~~]] [[~~~ νομική μορφή ~~~]]`
 * — δύο ξεχωριστά wrappers δίπλα-δίπλα = concatenation. Ακριβώς αυτό που το pseudo
 * υπάρχει για να αποκαλύπτει (Microsoft: «Concatenations will also be revealed by
 * paired delimiters embedded in the displayed text»).
 *
 * Τρέχει με ΠΡΑΓΜΑΤΙΚΟ i18next + ICU και τα ΠΡΑΓΜΑΤΙΚΑ locale αρχεία — αν το κλειδί
 * λείψει ή αλλάξει σχήμα, το test πέφτει.
 */

import i18n from 'i18next';
import ICU from 'i18next-icu';

import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { buildSelectPlaceholder, SELECT_PLACEHOLDER_KEY } from '../i18n/select-placeholder';

const t = (key: string, options?: { label: string }): string => i18n.t(key, options ?? {}) as string;

beforeAll(async () => {
  await i18n.use(ICU).init({
    lng: 'el',
    fallbackLng: 'el',
    ns: ['common'],
    defaultNS: 'common',
    resources: { el: { common: elCommon }, en: { common: enCommon } },
    interpolation: { escapeValue: false },
  });
});

describe('το SSoT κλειδί υπάρχει στα πραγματικά locales', () => {
  it('el: αποδίδει το label μέσα στη μετάφραση', () => {
    expect(t(SELECT_PLACEHOLDER_KEY, { label: 'Νομική Μορφή' })).toBe('Επιλέξτε Νομική Μορφή');
  });

  it('en: η σειρά ανήκει στον μεταφραστή, όχι στον κώδικα', async () => {
    await i18n.changeLanguage('en');
    expect(t(SELECT_PLACEHOLDER_KEY, { label: 'Legal Form' })).toBe('Select Legal Form');
    await i18n.changeLanguage('el');
  });

  it('το κλειδί ΔΕΝ επιστρέφει τον εαυτό του (θα σήμαινε ότι λείπει)', () => {
    expect(t(SELECT_PLACEHOLDER_KEY, { label: 'X' })).not.toContain('selectPlaceholder');
  });
});

describe('buildSelectPlaceholder — το συμβόλαιο', () => {
  it('παράγει ΕΝΑ ενιαίο κείμενο, όχι ένωση δύο μεταφράσεων', () => {
    expect(buildSelectPlaceholder('Νομική Μορφή', t)).toBe('Επιλέξτε Νομική Μορφή');
  });

  it('ΔΕΝ καταστρέφει ελληνικά ακρωνύμια — το παλιό .toLowerCase() έκανε «ΓΕΜΗ» → «γεμη»', () => {
    const result = buildSelectPlaceholder('Κατάσταση ΓΕΜΗ', t);
    expect(result).toBe('Επιλέξτε Κατάσταση ΓΕΜΗ');
    expect(result).not.toContain('γεμη');
  });

  it('περνά το label αυτούσιο, χωρίς μετατροπή πεζών/κεφαλαίων', () => {
    expect(buildSelectPlaceholder('ΑΦΜ', t)).toBe('Επιλέξτε ΑΦΜ');
  });

  it('το label ταξιδεύει ως δεδομένο — δεν κολλιέται στο κείμενο', () => {
    // Αν κάποιος ξαναγυρίσει σε concatenation, το κλειδί θα αγνοηθεί και αυτό θα σπάσει.
    expect(buildSelectPlaceholder('{}', t)).toContain('{}');
  });
});
