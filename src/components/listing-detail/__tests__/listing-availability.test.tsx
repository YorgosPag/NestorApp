/**
 * ΑΓΚΥΡΕΣ — η υπόσχεση στην κάρτα και στη σελίδα της αγγελίας (ADR-919 §11 · §10 Δ3).
 *
 * ⚠️ Το `t` επιστρέφει το ΚΛΕΙΔΙ με τις παραμέτρους (ίδιο ιδίωμα με `price-reduction-badge.test.tsx`): η άγκυρα ρωτά
 * **ποιο** κείμενο ζητήθηκε, όχι τη διατύπωση.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingDeliveryBadge } from '@/components/search-results/ListingDeliveryBadge';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { AvailabilityTrack, ScheduledAvailability } from '@/types/availability-history';
import type { ListingAvailability as Availability } from '@/types/listing-availability';
import type { PublicListing } from '@/types/public-listing';

import { ListingAvailability } from '../ListingAvailability';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

const Q3_2027 = scheduledAvailability('quarter', '2027-07-01') as ScheduledAvailability;
const Q2_2027 = scheduledAvailability('quarter', '2027-04-01') as ScheduledAvailability;

function listing(availability: Availability, availabilityTrack: AvailabilityTrack | null = null): PublicListing {
  return { availability, availabilityTrack } as unknown as PublicListing;
}

const SLIPPED: AvailabilityTrack = { originally: Q2_2027, slips: 1, lastChange: null };

describe('Κ — κάρτα: μιλά μόνο η υπόσχεση', () => {
  it('Κ1 — `scheduled` ⇒ «Παράδοση …» με τη φράση του τριμήνου', () => {
    const { container } = render(<ListingDeliveryBadge availability={Q3_2027} />);
    expect(container.textContent).toContain('common:listingAvailability.deliveryOn');
    expect(container.textContent).toContain('common-shared:listingAvailability.quarter');
  });

  it('Κ2 — `ready` και `unknown` ⇒ σιωπή (θόρυβος σε κάθε κάρτα / τίμια άγνοια)', () => {
    expect(render(<ListingDeliveryBadge availability={{ kind: 'ready' }} />).container).toBeEmptyDOMElement();
    expect(render(<ListingDeliveryBadge availability={{ kind: 'unknown' }} />).container).toBeEmptyDOMElement();
  });
});

describe('Σ — σελίδα: έτοιμο, υπόσχεση, μεταθέσεις', () => {
  it('Σ1 — μετάθεση ⇒ «αρχικά Β΄ … · μετατέθηκε 1» ΜΟΝΟ μέσω του slipNoticeOf', () => {
    const { container } = render(<ListingAvailability listing={listing(Q3_2027, SLIPPED)} />);
    expect(container.textContent).toContain('listing-detail:availability.slipNotice');
    expect(container.textContent).toContain('"count":1');
  });

  it('Σ2 — παραδόθηκε (ready) με ιστορικό μεταθέσεων ⇒ «Άμεσα διαθέσιμο», ΚΑΜΙΑ σήμανση', () => {
    const { container } = render(<ListingAvailability listing={listing({ kind: 'ready' }, SLIPPED)} />);
    expect(container.textContent).toContain('common:listingAvailability.readyNow');
    expect(container.textContent).not.toContain('slipNotice');
  });

  it('Σ3 — υπόσχεση χωρίς μεταθέσεις ⇒ φράση + βάση δήλωσης, καμία σήμανση', () => {
    const { container } = render(<ListingAvailability listing={listing(Q3_2027, { originally: Q3_2027, slips: 0, lastChange: null })} />);
    expect(container.textContent).toContain('listing-detail:availability.basis');
    expect(container.textContent).not.toContain('slipNotice');
  });

  it('Σ4 — `unknown` ⇒ τίμια σιωπή', () => {
    expect(render(<ListingAvailability listing={listing({ kind: 'unknown' })} />).container).toBeEmptyDOMElement();
  });
});
