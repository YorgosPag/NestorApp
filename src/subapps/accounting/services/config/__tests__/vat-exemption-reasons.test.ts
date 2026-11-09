/**
 * Αιτίες εξαίρεσης ΦΠΑ — άγκυρα απέναντι στον πίνακα §8.3 του myDATA ERP v2.0.2 (ΑΑΔΕ, Σεπτ. 2026).
 * Αν αλλάξει ο πίνακας ή χαθεί κείμενο από ένα locale, κοκκινίζει **πριν** τυπωθεί λάθος παραπομπή.
 */

import elVatExemptions from '@/i18n/locales/el/accounting-vat-exemptions.json';
import enVatExemptions from '@/i18n/locales/en/accounting-vat-exemptions.json';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import {
  VAT_CODE_5144_IN_FORCE_FROM,
  VAT_EXEMPTION_GROUPS,
  VAT_EXEMPTION_NAMESPACE,
  VAT_EXEMPTION_REASONS,
  isVatExemptionCode,
  vatCodeEditionAt,
  vatExemptionCitation,
  vatExemptionReasonsIn,
} from '../vat-exemption-reasons';

const tEl = createBundleTranslate({ [VAT_EXEMPTION_NAMESPACE]: elVatExemptions }, VAT_EXEMPTION_NAMESPACE, 'el');

describe('VAT_EXEMPTION_REASONS (ΑΑΔΕ v2.0.2 §8.3)', () => {
  it('31 κωδικοί, συνεχόμενοι 1–31, χωρίς διπλότυπο', () => {
    expect(VAT_EXEMPTION_REASONS.map((reason) => reason.code)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('κάθε αιτία ανήκει σε ομάδα που εμφανίζεται στον επιλογέα — καμία δεν χάνεται', () => {
    const shown = VAT_EXEMPTION_GROUPS.flatMap((group) => vatExemptionReasonsIn(group).map((reason) => reason.code));
    expect([...shown].sort((a, b) => a - b)).toEqual(VAT_EXEMPTION_REASONS.map((reason) => reason.code));
  });

  it('στενευτής: μόνο ακέραιοι του καταλόγου', () => {
    expect(isVatExemptionCode(1)).toBe(true);
    expect(isVatExemptionCode(31)).toBe(true);
    for (const value of [0, 32, 2.5, '15', null, undefined]) expect(isVatExemptionCode(value)).toBe(false);
  });
});

describe('έκδοση του Κώδικα ΦΠΑ ανά ημερομηνία έκδοσης', () => {
  it('ν. 5144/2024 από 11/10/2024 (ΦΕΚ Α\' 162)', () => {
    expect(VAT_CODE_5144_IN_FORCE_FROM).toBe('2024-10-11');
    expect(vatCodeEditionAt('2024-10-10')).toBe('legacy');
    expect(vatCodeEditionAt('2024-10-11')).toBe('current');
    expect(vatCodeEditionAt('2024-10-10T23:59:59.000Z')).toBe('legacy');
    expect(vatCodeEditionAt('2026-11-09')).toBe('current');
  });

  it('ίδιος κωδικός, άλλο άρθρο: 15 = άρθρο 39 → άρθρο 44 · 16 = 39α → 45 · 14 = 28 → 33', () => {
    expect(vatExemptionCitation(tEl, 15, '2024-01-15')).toEqual({
      provision: 'Χωρίς ΦΠΑ - άρθρο 39 του Κώδικα ΦΠΑ',
      law: 'ν. 2859/2000',
    });
    expect(vatExemptionCitation(tEl, 15, '2026-11-09')).toEqual({
      provision: 'Χωρίς ΦΠΑ - άρθρο 44 του Κώδικα ΦΠΑ',
      law: 'ν. 5144/2024',
    });
    expect(vatExemptionCitation(tEl, 16, '2024-01-15').provision).toBe('Χωρίς ΦΠΑ - άρθρο 39α του Κώδικα ΦΠΑ');
    expect(vatExemptionCitation(tEl, 16, '2026-11-09').provision).toBe('Χωρίς ΦΠΑ - άρθρο 45 του Κώδικα ΦΠΑ');
    expect(vatExemptionCitation(tEl, 14, '2026-11-09').provision).toBe('Χωρίς ΦΠΑ - άρθρο 33 του Κώδικα ΦΠΑ');
  });
});

describe('locale accounting-vat-exemptions', () => {
  it.each([
    ['el', elVatExemptions],
    ['en', enVatExemptions],
  ])('%s: τίτλος + δύο διατάξεις για ΚΑΘΕ κωδικό, ετικέτα για ΚΑΘΕ ομάδα', (_language, bundle) => {
    for (const { code } of VAT_EXEMPTION_REASONS) {
      const reason = bundle.reasons[`c${code}` as keyof typeof bundle.reasons];
      expect(reason).toBeDefined();
      expect(reason.title.length).toBeGreaterThan(0);
      expect(reason.legacy.length).toBeGreaterThan(0);
      expect(reason.current.length).toBeGreaterThan(0);
    }
    expect(Object.keys(bundle.reasons)).toHaveLength(VAT_EXEMPTION_REASONS.length);
    for (const group of VAT_EXEMPTION_GROUPS) expect(bundle.groups[group].length).toBeGreaterThan(0);
  });
});
