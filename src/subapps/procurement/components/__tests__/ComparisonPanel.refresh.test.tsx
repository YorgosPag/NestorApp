/**
 * @fileoverview Η σύγκριση ΔΕΝ εξαφανίζεται όταν ανανεώνεται (ADR-327, stale-while-revalidate).
 *
 * Μετρημένο ζωντανά 2026-10-28: η αποθήκευση κάλυψης κενού ξανατραβά τη σύγκριση, και το πάνελ
 * αντικαθιστούσε ΟΛΟ το περιεχόμενο με «Φόρτωση…» — χανόταν η θέση κύλισης και το πλαίσιο της ενέργειας.
 *
 * Α1 `refreshing` ⇒ ο πίνακας ΜΕΝΕΙ ορατός, με `aria-busy="true"` ·
 * Α2 χωρίς ανανέωση ⇒ `aria-busy="false"` ·
 * Α3 η πρώτη φόρτωση έχει ΔΙΚΟ της component (`ComparisonPanelLoading`), όχι flag του πάνελ.
 *
 * ⚠️ Μετάλλαξη που ΠΡΕΠΕΙ να κοκκινίζει: `if (refreshing) return <ComparisonPanelLoading />` ⇒ Α1.
 */

import { render, screen } from '@testing-library/react';
import { ComparisonPanel, ComparisonPanelLoading } from '../ComparisonPanel';
import type { QuoteComparisonResult } from '../../types/comparison';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

/** Σχήμα αντιγραμμένο από ζωντανή απάντηση του `/api/rfqs/[id]/comparison` (2026-10-28). */
const COMPARISON = {
  rfqId: 'rfq_1',
  adhocGroupKey: null,
  quoteCount: 1,
  quotes: [
    {
      quoteId: 'qt_1',
      displayNumber: 'QT-0001',
      vendorName: 'Δοκιμαστικός Προμηθευτής',
      vendorContactId: 'cont_1',
      total: 124,
      tco: {
        normalizedTotal: 124, vatDelta: 0, levelingDelta: 0, laborFlag: false, deliveryFlag: false,
        warrantyText: null, vatIncluded: null, laborIncluded: null,
      },
      score: 75,
      breakdown: { price: 100, supplier: 50, terms: 50, delivery: 50 },
      rank: 1,
      flags: [],
      supplierScore: null,
      hasRiskFlags: false,
    },
  ],
  recommendation: null,
  weights: { price: 0.5, supplier: 0.25, terms: 0.15, delivery: 0.1 },
  templateId: 'standard',
  computedAt: '2026-10-28T00:00:00.000Z',
  leveling: { rows: [], columns: [] },
} as unknown as QuoteComparisonResult;

function renderPanel(refreshing: boolean) {
  return render(
    <ComparisonPanel
      comparison={COMPARISON}
      cherryPick={null}
      refreshing={refreshing}
      rfqAwarded={false}
      awardMode="whole_package"
      onAwardIntent={() => undefined}
    />,
  );
}

describe('ComparisonPanel — ανανέωση χωρίς εξαφάνιση', () => {
  it('Α1: refreshing ⇒ ο πίνακας μένει, aria-busy=true, κανένα «Φόρτωση»', () => {
    const { container } = renderPanel(true);
    expect(screen.getByText('Δοκιμαστικός Προμηθευτής')).toBeInTheDocument();
    expect(screen.queryByText('quotes.loading')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('Α2: χωρίς ανανέωση ⇒ aria-busy=false', () => {
    const { container } = renderPanel(false);
    expect(container.querySelector('[aria-busy="false"]')).not.toBeNull();
  });

  it('Α3: η πρώτη φόρτωση = ComparisonPanelLoading', () => {
    render(<ComparisonPanelLoading />);
    expect(screen.getByText('quotes.loading')).toBeInTheDocument();
  });
});
