/**
 * ΑΓΚΥΡΕΣ — «η νωρίτερη παραδίδεται …» δίπλα στο εμπόδιο χρόνου, και μόνο εκεί (ADR-919 §11).
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ScheduledAvailability } from '@/types/availability-history';

import { DemandBlockerList } from '../DemandBlockerList';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

const Q4_2027 = scheduledAvailability('quarter', '2027-10-01') as ScheduledAvailability;

describe('Ο — ο ορίζοντας σχολιάζει ΜΟΝΟ τη γραμμή του χρόνου', () => {
  it('Ο1 — με εμπόδιο χρόνου ⇒ η φράση κάτω από τη γραμμή `not-available-then`', () => {
    render(<DemandBlockerList blockedBy={new Map([['not-available-then', 2], ['price-above', 3]])} timingHorizon={Q4_2027} />);
    const timing = screen.getByText(/property-market:demand\.blocker\.not-available-then/);
    expect(timing).toHaveTextContent('property-market:demand.blocker.earliestDelivery');
    expect(screen.getByText(/property-market:demand\.blocker\.price-above/)).not.toHaveTextContent('earliestDelivery');
  });

  it('Ο2 — χωρίς ορίζοντα ⇒ καμία φράση (ποτέ ψεύτικη ημερομηνία)', () => {
    const { container } = render(<DemandBlockerList blockedBy={new Map([['not-available-then', 1]])} />);
    expect(container.textContent).not.toContain('earliestDelivery');
  });
});
