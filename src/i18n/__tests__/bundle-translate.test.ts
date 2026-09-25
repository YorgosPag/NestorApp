/**
 * ADR-887 — ο σύγχρονος μεταφραστής πάνω σε locale JSON: ό,τι υπόσχεται, το κάνει· ό,τι λείπει, φαίνεται.
 */

import elShared from '@/i18n/locales/el/common-shared.json';
import enShared from '@/i18n/locales/en/common-shared.json';
import { createBundleTranslate, formatBundleText } from '../bundle-translate';

const BUNDLES = { app: { a: { b: 'Γεια {name}' }, n: '{count, plural, one {# αγγελία} other {# αγγελίες}}' } };
const t = createBundleTranslate(BUNDLES, 'app');

describe('createBundleTranslate', () => {
  it('ns:key και κλειδί χωρίς namespace ⇒ το ίδιο κείμενο', () => {
    expect(t('app:a.b', { name: 'Νίκο' })).toBe('Γεια Νίκο');
    expect(t('a.b', { name: 'Νίκο' })).toBe('Γεια Νίκο');
  });

  it('🔑 plural: `#` = ο ίδιος ο αριθμός, και για παράμετρο-κείμενο (όπως τα titleParams)', () => {
    expect(t('n', { count: 1 })).toBe('1 αγγελία');
    expect(t('n', { count: '3' })).toBe('3 αγγελίες');
  });

  it('🔴 κλειδί που λείπει / άγνωστο namespace / μη-φύλλο ⇒ το ωμό κλειδί (ορατή απουσία)', () => {
    expect(t('app:a.missing')).toBe('app:a.missing');
    expect(t('other:a.b')).toBe('other:a.b');
    expect(t('app:a')).toBe('app:a');
  });

  it('παράμετρος που δεν δόθηκε μένει ορατή', () => {
    expect(formatBundleText('Γεια {name}')).toBe('Γεια {name}');
  });
});

describe('🏆 τα πραγματικά κλειδιά ADR-887 αποδίδονται σε ΚΑΙ ΤΙΣ ΔΥΟ γλώσσες', () => {
  const el = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');
  const en = createBundleTranslate({ 'common-shared': enShared }, 'common-shared');
  const params = { demand: 'Αγορά · Κορδελιό', title: 'Δυάρι', others: '2' };

  it.each([
    'demandListingMatch.namedTitle',
    'demandListingMatch.namedTitleMany',
    'demandListingMatch.reducedNamedTitle',
    'demandListingMatch.reducedNamedTitleMany',
    'demandListingMatch.intoBudgetNamedTitle',
    'demandPriceDrop.namedTitle',
    'demandPriceDrop.namedTitleMany',
    'demandPriceDrop.intoBudgetNamedTitle',
  ])('%s — κανένα ωμό κλειδί, κανένα ανεπίλυτο `{…}`', (key) => {
    for (const rendered of [el(key, params), en(key, params)]) {
      expect(rendered).not.toBe(key);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).toContain('Αγορά · Κορδελιό');
    }
  });

  it('ο πληθυντικός «ακόμη» κλίνεται', () => {
    expect(el('demandListingMatch.namedTitleMany', { ...params, others: '1' })).toBe(
      'Νέα αγγελία για «Αγορά · Κορδελιό» και 1 ακόμη ζήτηση: «Δυάρι»',
    );
    expect(en('demandListingMatch.namedTitleMany', params)).toBe(
      'New listing for “Αγορά · Κορδελιό” and 2 other demands: “Δυάρι”',
    );
  });
});
