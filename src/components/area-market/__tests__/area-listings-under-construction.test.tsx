/**
 * ΑΓΚΥΡΕΣ — «χτίζονται N» στη σελίδα περιοχής (ADR-919 §12): μία γραμμή με τη ΜΙΑ φράση υπόσχεσης, σιωπή στο `null`.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ScheduledAvailability } from '@/types/availability-history';

import { AreaListingsSection } from '../AreaListingsSection';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));
jest.mock('@/components/listings/SavedListingsProvider', () => ({
  SavedListingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/search-results/ListingCard', () => ({ ListingCard: () => null }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const Q4_2027 = scheduledAvailability('quarter', '2027-10-01') as ScheduledAvailability;
const KEY = 'area-market:listings.underConstruction';

describe('Π — «χτίζονται N» στην περιοχή', () => {
  it('Π1 — πλήθος και η νωρίτερη υπόσχεση με τη ΜΙΑ φράση (`availabilityPromisePhrase`)', () => {
    render(<AreaListingsSection areaId="municipality:0701" items={[]} total={0} underConstruction={{ count: 3, next: Q4_2027 }} />);
    const line = screen.getByText(new RegExp(KEY.replace('.', '\\.')));
    expect(line).toHaveTextContent('"count":3');
    expect(line).toHaveTextContent('common-shared:listingAvailability.quarter');
  });

  it('Π2 — `null` ⇒ καμία γραμμή (σιωπή, ποτέ «0»)', () => {
    const { container } = render(<AreaListingsSection areaId="municipality:0701" items={[]} total={0} underConstruction={null} />);
    expect(container.textContent).not.toContain('underConstruction');
  });
});
