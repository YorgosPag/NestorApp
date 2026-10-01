/**
 * ADR-898 Φ3β — **η ενότητα της αντικειμενικής στην αγγελία**: κρυμμένη ⇒ τίποτα (ούτε ποσό, ούτε σύνδεσμος — πρότυπο
 * NAR IDX) · ό,τι μπήκε από δήλωση ⇒ «δήλωση του αγγελιοδότη», με ονομασμένα πεδία, ποτέ ωμούς κωδικούς.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { listingObjectiveValue } from '@/lib/objective-value/listing-objective-value';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

import { ListingObjectiveValue } from '../ListingObjectiveValue';

// Κλειδί + παράμετροι, ώστε να φαίνεται ΤΙ ονομάστηκε μέσα στην πρόταση (ίδιο μοτίβο με το `ListingDetailContent`).
jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 'z1', name: 'Β', price: 1200, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

const home = listing({
  floor: 3,
  areaSqm: 85,
  heatingType: 'central',
  amenities: ['elevator'],
  frontage: 'single',
  constructionYear: { provenance: 'declared', value: 2000, at: '2026-09-02T00:00:00.000Z' },
});

describe('ListingObjectiveValue — ADR-898 Φ3β', () => {
  it('🔴 κρυμμένη ⇒ η ενότητα ΔΕΝ υπάρχει: ούτε τίτλος, ούτε ποσό, ούτε σύνδεσμος στον υπολογιστή', () => {
    const { container } = render(<ListingObjectiveValue value={{ kind: 'hidden' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ό,τι δηλώθηκε ονομάζεται «δήλωση του αγγελιοδότη», με ονόματα πεδίων — όχι κωδικούς', () => {
    render(<ListingObjectiveValue value={listingObjectiveValue(home, READY, '2026-10-01')} />);
    expect(
      screen.getByText('objective-value:listing.assumptions.declaredByLister::{"fields":"objective-value:listing.declaredFields.frontage"}'),
    ).toBeInTheDocument();
  });
});
