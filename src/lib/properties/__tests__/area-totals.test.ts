/**
 * ⚓ Σύνολα εμβαδού ΑΝΑ ΕΙΔΟΣ — ποτέ ένας αριθμός από μικτά και καθαρά (ADR-777 §8.101).
 *
 * Ο `t` είναι **καταγραφέας** (`κλειδί|παράμετροι`): κρίνεται ΠΟΙΟ κλειδί ζητήθηκε, όχι η μορφή του locale. Η ύπαρξη
 * των κλειδιών στα πραγματικά locales κρίνεται χωριστά (Σ5).
 */

import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { totalAreaByKind } from '../area-totals';
import { areaTotalsView } from '../display-area-label';
import { EMPTY_STAT_VALUE } from '@/types/stat-breakdown';

const t = (key: string, options?: Record<string, unknown>): string =>
  options && Object.keys(options).length > 0 ? `${key}|${JSON.stringify(options)}` : key;

const gross = (value: number, net?: number) => ({ areas: { gross: value, net }, area: value });
const netOnly = (value: number) => ({ areas: { gross: 0, net: value }, area: null });
const legacyOnly = (value: number) => ({ area: value });
const none = () => ({ areas: { gross: 0, net: 0 }, area: 0 });

describe('Σ1 — δύο στήλες, όχι αλυσίδα (ArchiCAD: Gross + Net, το καθένα με το σύνολό του)', () => {
  it('μονάδα με μικτό ΚΑΙ καθαρό μετρά και στα δύο· το παλιό `area` (καθρέφτης) δεν διπλομετρά', () => {
    const totals = totalAreaByKind([gross(120, 108), gross(80, 70)]);
    expect(totals.byKind.gross).toEqual({ total: 200, measuredCount: 2 });
    expect(totals.byKind.net).toEqual({ total: 178, measuredCount: 2 });
    expect(totals.byKind.unspecified).toEqual({ total: 0, measuredCount: 0 });
    expect(totals.unmeasuredCount).toBe(0);
  });

  it('🔴 το ζωντανό σφάλμα: μικτό 0 + καθαρό ΔΕΝ μπαίνει στα «μικτά»', () => {
    const totals = totalAreaByKind([gross(120), netOnly(108)]);
    expect(totals.byKind.gross).toEqual({ total: 120, measuredCount: 1 });
    expect(totals.byKind.net).toEqual({ total: 108, measuredCount: 1 });
  });
});

describe('Σ2 — η άγνωστη βάση μένει ΧΩΡΙΣΤΗ, η απουσία ΟΝΟΜΑΣΜΕΝΗ', () => {
  it('μόνο παλιό `area` ⇒ `unspecified`, ποτέ «μικτά»', () => {
    const totals = totalAreaByKind([legacyOnly(95)]);
    expect(totals.byKind.unspecified).toEqual({ total: 95, measuredCount: 1 });
    expect(totals.byKind.gross.measuredCount).toBe(0);
  });

  it('χωρίς κανένα μετρημένο ⇒ μετρά στις απουσίες, όχι ως 0 m²', () => {
    const totals = totalAreaByKind([none(), gross(50)]);
    expect(totals.unmeasuredCount).toBe(1);
    expect(totals.byKind.gross).toEqual({ total: 50, measuredCount: 1 });
  });

  it('ωμό έγγραφο: συμβολοσειρά/αρνητικό ΔΕΝ είναι μέτρηση', () => {
    const totals = totalAreaByKind([{ areas: { gross: '95', net: -3 }, area: 'x' }]);
    expect(totals.unmeasuredCount).toBe(1);
  });
});

describe('Σ3 — μία κλάση ⇒ ένα μέγεθος ΜΕ το είδος του (§8.100)', () => {
  it('μόνο μικτά ⇒ «… m² μικτά», χωρίς υποσύνολα', () => {
    const view = areaTotalsView(t, totalAreaByKind([{ areas: { gross: 120 } }]));
    expect(view.breakdown).toEqual([]);
    expect(view.value).toContain('common:displayArea.qualified');
    expect(view.value).toContain('common:displayArea.basis.gross');
  });

  it('τίποτα μετρημένο ⇒ «—», ποτέ «0 m²»', () => {
    expect(areaTotalsView(t, totalAreaByKind([none()])).value).toBe(EMPTY_STAT_VALUE);
    expect(areaTotalsView(t, totalAreaByKind([])).value).toBe(EMPTY_STAT_VALUE);
  });
});

describe('Σ4 — πολλές κλάσεις ⇒ υποσύνολα με το πλήθος τους, η απουσία τελευταία', () => {
  it('σειρά: μικτά · καθαρά · άγνωστη βάση · χωρίς εμβαδόν', () => {
    const view = areaTotalsView(t, totalAreaByKind([gross(120, 108), legacyOnly(95), none()]));
    expect(view.value).toBe('');
    expect(view.breakdown.map((row) => row.key)).toEqual(['gross', 'net', 'unspecified', 'unmeasured']);
    expect(view.breakdown[0].label).toBe('common:areaSection.gross|{"count":1}');
    expect(view.breakdown[3]).toEqual({
      key: 'unmeasured',
      label: 'common:areaSection.unmeasured|{"count":1}',
      value: null,
    });
  });

  it('μία κλάση ΜΕ απουσίες ⇒ υποσύνολα (η απουσία δεν κρύβεται πίσω από έναν αριθμό)', () => {
    const view = areaTotalsView(t, totalAreaByKind([{ areas: { gross: 120 } }, none()]));
    expect(view.breakdown.map((row) => row.key)).toEqual(['gross', 'unmeasured']);
  });
});

describe('Σ5 — τα κλειδιά υπάρχουν και στις δύο γλώσσες, με πληθυντικό ICU', () => {
  it.each(['gross', 'net', 'unspecified', 'unmeasured'] as const)('areaSection.%s', (kind) => {
    for (const locale of [elCommon, enCommon]) {
      expect(locale.areaSection[kind]).toMatch(/\{count, plural, one \{# [^}]+\} other \{# [^}]+\}\}/);
    }
  });
});
