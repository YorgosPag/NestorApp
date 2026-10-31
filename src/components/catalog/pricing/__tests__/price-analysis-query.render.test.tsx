/**
 * **Το Enter της «Ανάλυσης τιμής» κάνει ό,τι υπόσχεται η οδηγία** (ADR-923 §5.11 «3ζ»). Το jsdom εκτελεί το HTML implicit
 * submission: φόρμα με δύο πεδία κειμένου και χωρίς submit αγνοεί το Enter, όπως ακριβώς μετρήθηκε ζωντανά.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AnalysisQuery } from '../PriceAnalysisPanel';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/useUomLabel', () => ({ useUomLabel: () => (code: string) => code }));
jest.mock('../PriceQuoteCard', () => ({ PriceQuoteCard: () => null }));
jest.mock('../PriceHistoryList', () => ({ PriceHistoryList: () => null }));
jest.mock('@/hooks/catalog/useCatalogCollection', () => ({ useCatalogCollection: () => ({ items: [] }) }));
jest.mock('@/hooks/catalog/usePriceListViews', () => ({ usePriceListsView: () => ({ current: { state: 'loading' } }) }));
jest.mock('../use-price-analysis', () => ({ usePriceAnalysis: () => null }));
jest.mock('../use-price-analysis-names', () => ({ useAnalysisNames: () => null }));
jest.mock('@/components/ui/date-picker-field', () => ({ DatePickerField: () => null }));

function renderQuery() {
  const lookUp = jest.fn().mockResolvedValue(undefined);
  render(<AnalysisQuery analysis={{ sku: { state: 'empty' }, lookUp, quantity: 1, setQuantity: jest.fn(), day: undefined, setDay: jest.fn() }} />);
  return { lookUp, code: screen.getByLabelText('pricing.analysis.code') };
}

describe('AnalysisQuery', () => {
  it('🔴 το Enter στον κωδικό ρωτά, χωρίς να φύγει η εστίαση', async () => {
    const { lookUp, code } = renderQuery();
    await userEvent.type(code, '099-01-001{Enter}');
    expect(lookUp).toHaveBeenCalledWith('099-01-001');
    expect(code).toHaveFocus();
  });

  it('το φεύγα από το πεδίο ρωτά επίσης', () => {
    const { lookUp, code } = renderQuery();
    fireEvent.change(code, { target: { value: 'ABC' } });
    fireEvent.blur(code);
    expect(lookUp).toHaveBeenCalledWith('ABC');
  });
});
