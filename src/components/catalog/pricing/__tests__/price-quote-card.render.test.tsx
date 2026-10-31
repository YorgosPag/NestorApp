/**
 * **Η κάρτα τιμής αποδίδει ό,τι είπε ο διακομιστής** (ADR-923 §5.11 «3δ» Τμήμα 3): κάθε κατάσταση λέγεται με το όνομά της,
 * και κανένα ωμό id δεν φτάνει στην οθόνη — το ίχνος δίνει id, η οθόνη ονόματα.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import type { PriceQuoteResult } from '@/subapps/catalog/types/price-list-requests';
import type { AnalysisCell } from '../price-analysis';
import { PriceQuoteCard } from '../PriceQuoteCard';
import type { AnalysisNames } from '../use-price-analysis-names';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/useUomLabel', () => ({ useUomLabel: () => (code: string) => code }));
jest.mock('../AudienceField', () => ({ AudienceField: () => null }));

const CONTEXT = {
  viewer: { kind: 'signedIn', customerGroupId: 'group-1', party: null },
  at: '2026-10-30T00:00:00.000Z',
  listTrace: [{ id: 'list-1', verdict: 'selected' }, { id: 'list-2', verdict: 'audienceMismatch' }],
} as const;

const PRICED: PriceQuoteResult = {
  kind: 'priced',
  priceListAudience: null,
  cascade: [{ step: 5000, net: 5000 }, { step: 1000, net: 4500 }],
  quote: {
    priceListId: 'list-1',
    priceListVersionId: 'version-1',
    lineId: 'line-1',
    subjectKey: 'variant:x',
    quantity: 1,
    netPrice: 10_000,
    priceQuantity: 1,
    unitCode: 'pcs',
    listAmount: 10_000,
    conditionId: 'cond-1',
    discountSteps: [5000, 1000],
    discountAmount: 5500,
    netAmount: 4500,
    trace: [{ id: 'cond-1', verdict: 'selected' }, { id: 'cond-2', verdict: 'outranked' }, { id: 'cond-3', verdict: 'groupMismatch' }],
  },
  ...CONTEXT,
};

const NAMES: AnalysisNames = {
  words: { formatPercent: String, rule: () => '', period: () => '', audience: () => 'Χονδρέμπορος' },
  list: (id) => `name-of-${id}`,
  version: (id) => `name-of-${id}`,
  condition: (id) => `name-of-${id}`,
};

function renderCard(cell: AnalysisCell | null, saving: number | null = null) {
  return render(
    <PriceQuoteCard viewer={{ key: 'v', audience: { kind: 'anonymous' } }} cell={cell} saving={saving} busy={false} names={NAMES}
      customerGroups={[]} removable={false} onChange={jest.fn()} onRemove={jest.fn()} />,
  );
}

describe('PriceQuoteCard', () => {
  it('τιμή: τελικό ποσό, λίστα + έκδοση με ονόματα, ομάδα του θεατή, διαφορά από το πρώτο κοινό', () => {
    const { container } = renderCard({ state: 'ready', result: PRICED }, 5500);
    expect(screen.getByText('name-of-list-1')).toBeTruthy();
    expect(screen.getByText('name-of-version-1')).toBeTruthy();
    expect(screen.getByText('Χονδρέμπορος')).toBeTruthy();
    expect(screen.getByText('pricing.analysis.saving')).toBeTruthy();
    expect(container.textContent).toContain('45');
  });

  it('το «γιατί»: νικητής και ηττημένη με ονόματα· οι άσχετες μόνο μετρούνται', () => {
    renderCard({ state: 'ready', result: PRICED });
    fireEvent.click(screen.getByText('pricing.analysis.trace.title'));
    expect(screen.getByText('name-of-cond-1')).toBeTruthy();
    expect(screen.getByText('name-of-cond-2')).toBeTruthy();
    expect(screen.queryByText('name-of-cond-3')).toBeNull();
    expect(screen.getAllByText('pricing.analysis.trace.unrelated')).toHaveLength(2);
  });

  it('χωρίς τιμή: η αιτία με το όνομά της, ποτέ ποσό', () => {
    const result: PriceQuoteResult = { kind: 'noLine', priceListId: 'list-1', priceListVersionId: 'version-1', ...CONTEXT };
    const { container } = renderCard({ state: 'ready', result });
    expect(screen.getByText('pricing.analysis.outcome.noLine')).toBeTruthy();
    expect(container.textContent).not.toContain('€');
  });

  it('ασάφεια συνθηκών: φαίνονται και οι δύο πλευρές', () => {
    const result: PriceQuoteResult = {
      kind: 'ambiguousDiscount',
      priceListId: 'list-1',
      priceListVersionId: 'version-1',
      tiedConditionIds: ['cond-1', 'cond-2'],
      trace: [{ id: 'cond-1', verdict: 'tied' }, { id: 'cond-2', verdict: 'tied' }],
      ...CONTEXT,
    };
    renderCard({ state: 'ready', result });
    fireEvent.click(screen.getByText('pricing.analysis.trace.title'));
    expect(screen.getByText('name-of-cond-1')).toBeTruthy();
    expect(screen.getByText('name-of-cond-2')).toBeTruthy();
  });

  it.each([
    [{ state: 'incomplete' } as const, 'pricing.analysis.pickViewer'],
    [{ state: 'loading' } as const, 'pricing.analysis.loading'],
    [{ state: 'failed' } as const, 'pricing.analysis.failed'],
  ])('κατάσταση %j: λέγεται με λέξεις', (cell, key) => {
    renderCard(cell);
    expect(screen.getByText(key)).toBeTruthy();
  });

  it('χωρίς SKU ακόμη: μόνο το κοινό, κανένα μήνυμα', () => {
    const { container } = renderCard(null);
    expect(container.querySelector('p')).toBeNull();
  });
});
