/**
 * ΑΓΚΥΡΕΣ — «χτίζονται N» στην ενότητα «Πόσο λείπει» (ADR-919 §12): σκάλα, μεταθέσεις, σιωπή στο `null`.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { AwaitingDelivery } from '@/lib/demand/demand-awaiting-delivery';
import type { DemandConcessionReport } from '@/lib/demand/demand-concession-report';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ScheduledAvailability } from '@/types/availability-history';

import { DemandConcessionList } from '../DemandConcessionList';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

const Q4_2027 = scheduledAvailability('quarter', '2027-10-01') as ScheduledAvailability;
const Q2_2028 = scheduledAvailability('quarter', '2028-04-01') as ScheduledAvailability;
const K = 'property-market:demand.concession';

const EMPTY_REPORT: DemandConcessionReport = {
  ladders: [],
  census: { ladderedCount: 0, multiAxis: 0, unquantified: 0, awaitingDelivery: 0, considered: 0 },
};

function awaiting(slipped: number): AwaitingDelivery {
  return { count: 3, steps: [{ promise: Q4_2027, unlocks: 1 }, { promise: Q2_2028, unlocks: 3 }], slipped };
}

describe('Χ — η σκάλα της αναμονής', () => {
  it('Χ1 — ένα σκαλί ανά υπόσχεση, με τη ΜΙΑ φράση υπόσχεσης, και καμία «δεν σου προτείνουμε»', () => {
    render(<DemandConcessionList report={EMPTY_REPORT} awaitingDelivery={awaiting(1)} />);
    expect(screen.getByText(new RegExp(`${K}\\.awaitingDelivery\\.lead`))).toHaveTextContent('"count":3');
    const steps = screen.getAllByText(new RegExp(`${K}\\.awaitingDelivery\\.step`));
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent('common-shared:listingAvailability.quarter');
    expect(steps[1]).toHaveTextContent('"count":3');
    expect(screen.getByText(new RegExp(`${K}\\.awaitingDelivery\\.slipped`))).toHaveTextContent('"count":1');
    expect(screen.queryByText(`${K}.unreachable`)).toBeNull();
  });

  it('Χ2 — καμία μετάθεση ⇒ καμία γραμμή μεταθέσεων (ποτέ «0»)', () => {
    const { container } = render(<DemandConcessionList report={EMPTY_REPORT} awaitingDelivery={awaiting(0)} />);
    expect(container.textContent).not.toContain('awaitingDelivery.slipped');
  });

  it('Χ3 — `null` και άδεια απογραφή ⇒ τίποτα', () => {
    const { container } = render(<DemandConcessionList report={EMPTY_REPORT} awaitingDelivery={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
