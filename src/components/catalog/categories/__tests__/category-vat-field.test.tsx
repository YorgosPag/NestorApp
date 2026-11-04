/**
 * @jest-environment jsdom
 */

/**
 * Το πεδίο ΦΠΑ της κατηγορίας (ADR-923 §5.13 Ε3): ρητό «κληρονομείται», μόνο οι συντελεστές του πίνακα της λογιστικής, και η
 * ένδειξη του συντελεστή που ισχύει, με την πηγή του.
 */

import { render, screen } from '@testing-library/react';

import type { CategoryRecord } from '@/services/catalog/catalog-api.client';
import { GREEK_VAT_RATE_PERCENTS } from '@/subapps/accounting/services/config/vat-rates';

import { CategoryVatField, VAT_INHERIT, vatRateOfSelectValue } from '../CategoryVatField';

let mockPricingAccess: 'granted' | 'denied' = 'granted';
jest.mock('../../shared/catalog-ui-hooks', () => ({
  useCatalogAccess: () => mockPricingAccess,
  useCatalogText: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
    text: (labels: { readonly el?: string } | undefined) => labels?.el ?? '',
  }),
}));

const category = (id: string, vatRate: 24 | 13 | null, ancestorIds: readonly string[] = []) =>
  ({ id, code: id, labels: { el: `Κατηγορία ${id}` }, parentId: ancestorIds.at(-1) ?? null, ancestorIds, orderKey: 'a', mappings: { atoeCode: null }, vatRate }) as unknown as CategoryRecord;

const CATEGORIES = [category('root', 24), category('mid', null, ['root']), category('leaf', null, ['root', 'mid'])];

const field = (value: 24 | 13 | 6 | 0 | null, ancestorIds: readonly string[], categories = CATEGORIES) =>
  render(<CategoryVatField value={value} ancestorIds={ancestorIds} categories={categories} disabled={false} onChange={() => undefined} />);

describe('vatRateOfSelectValue — μόνο συντελεστές του πίνακα, ποτέ μαντεψιά', () => {
  it('«κληρονομείται» ⇒ null · κάθε συντελεστής του πίνακα ⇒ ο ίδιος · άγνωστο ⇒ null', () => {
    expect(vatRateOfSelectValue(VAT_INHERIT)).toBeNull();
    for (const rate of GREEK_VAT_RATE_PERCENTS) expect(vatRateOfSelectValue(String(rate))).toBe(rate);
    expect(vatRateOfSelectValue('17')).toBeNull();
    expect(vatRateOfSelectValue('')).toBeNull();
  });

  it('το «κληρονομείται» δεν είναι κενό (CHECK 3.48) και δεν συγκρούεται με συντελεστή', () => {
    expect(VAT_INHERIT).not.toBe('');
    expect(GREEK_VAT_RATE_PERCENTS.map(String)).not.toContain(VAT_INHERIT);
  });
});

describe('Χ4: δικαίωμα τιμολόγησης', () => {
  afterEach(() => {
    mockPricingAccess = 'granted';
  });

  it('χωρίς αυτό το πεδίο κλειδώνει και το λέει · η ένδειξη «ισχύει» μένει', () => {
    mockPricingAccess = 'denied';
    field(null, ['root']);
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('categories.vatRateNeedsPricing')).toBeTruthy();
    expect(screen.getByText(/categories\.vatEffectiveInherited/)).toBeTruthy();
  });

  it('με αυτό το πεδίο είναι ανοιχτό', () => {
    field(null, ['root']);
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(false);
  });
});

describe('η ένδειξη «ισχύει»', () => {
  it('κληρονομείται ⇒ ο συντελεστής του πλησιέστερου προγόνου, με το όνομά του', () => {
    field(null, ['root', 'mid']);
    expect(screen.getByText('categories.vatEffectiveInherited:{"rate":24,"category":"Κατηγορία root"}')).toBeTruthy();
  });

  it('δικός της ⇒ αυτός, όχι του προγόνου', () => {
    field(13, ['root', 'mid']);
    expect(screen.getByText('categories.vatEffectiveOwn:{"rate":13}')).toBeTruthy();
  });

  it('κανένας στη διαδρομή ⇒ η προειδοποίηση για τη βιτρίνα', () => {
    field(null, [], [category('alone', null)]);
    expect(screen.getByText('categories.vatEffectiveNone')).toBeTruthy();
  });
});
