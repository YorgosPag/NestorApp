/**
 * Άγκυρες της ρίζας **νομικής μορφής** (ADR-948 §8 · CHECK 3.73).
 *
 * Ομάδες: **Κ** ανεκτική ανάγνωση (`canonicalLegalForm`) · **Δ** κάθε απαρίθμηση δεμένη στη ρίζα (ετικέτες φόρμας,
 * επιλογές φόρμας, report-builder, locales el/en).
 */

import { canonicalLegalForm, isLegalForm, LEGAL_FORMS } from '@/lib/contact/legal-form-vocabulary';
import { VOCAB_LEGAL_FORMS } from '@/config/vocabulary/options/company';
import { LEGAL_FORM_OPTIONS } from '@/config/company-gemi/options/legal-forms';
import elReportDomains from '@/i18n/locales/el/report-builder-domains.json';
import enReportDomains from '@/i18n/locales/en/report-builder-domains.json';

describe('Κ — ανεκτική ανάγνωση: κάθε εποχή ⇒ ένας κωδικός', () => {
  it.each([
    ['ae', 'ae'],
    ['AE', 'ae'],
    ['  Epe ', 'epe'],
    ['SOLE_PROPRIETORSHIP', 'sole_proprietorship'],
    ['ΑΕ', 'ae'],
    ['ΕΠΕ', 'epe'],
    ['ΟΕ', 'oe'],
    ['ΕΕ', 'ee'],
    ['ΙΚΕ', 'ike'],
    ['ΚΟΙΝΣΕΠ', 'other'],
    ['OTHER', 'other'],
  ])('Κ1 — %p ⇒ %p', (raw, code) => {
    expect(canonicalLegalForm(raw)).toBe(code);
  });

  it.each([[''], ['   '], ['ΑΒΓ'], ['llc'], [null], [undefined], [42]])('Κ2 — 🔴 %p ⇒ null, ποτέ μαντεψιά', (raw) => {
    expect(canonicalLegalForm(raw)).toBeNull();
  });

  it('Κ3 — κάθε κωδικός της ρίζας είναι σταθερό σημείο', () => {
    for (const code of LEGAL_FORMS) expect(canonicalLegalForm(code)).toBe(code);
  });
});

describe('Δ — κάθε απαρίθμηση δεμένη στη ρίζα', () => {
  const sorted = (values: readonly string[]) => [...values].sort();

  it('Δ1 — οι ετικέτες της φόρμας (`VOCAB_LEGAL_FORMS`) = η ρίζα', () => {
    expect(sorted(VOCAB_LEGAL_FORMS.map((form) => form.value))).toEqual(sorted(LEGAL_FORMS));
  });

  it('Δ2 — 🔴 το select της φόρμας γράφει κωδικούς της ρίζας (όχι `AE`)', () => {
    expect(LEGAL_FORM_OPTIONS.every((option) => isLegalForm(option.value))).toBe(true);
    expect(sorted(LEGAL_FORM_OPTIONS.map((option) => option.value))).toEqual(sorted(LEGAL_FORMS));
  });

  it.each([
    ['el', elReportDomains],
    ['en', enReportDomains],
  ])('Δ3 — report-builder %s: ετικέτα για ΚΑΘΕ κωδικό, κανένα κλειδί εκτός ρίζας', (_lang, locale) => {
    const labels = (locale as { domains: { companies: { enums: { legalForm: Record<string, string> } } } })
      .domains.companies.enums.legalForm;
    expect(sorted(Object.keys(labels))).toEqual(sorted(LEGAL_FORMS));
  });
});
