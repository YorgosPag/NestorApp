/**
 * @fileoverview Άγκυρες — **οι συντομεύσεις «Πότε το θέλεις;» στην πόρτα «Ζητώ»** (ADR-777 §8.99).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Σ1 | μία συντόμευση ανά «πότε», με τη σειρά του SSoT, προς `?when=` | λείπει / λάθος σειρά / λάθος διεύθυνση |
 * | Σ2 | η κάρτα μένει σύνδεσμος προς τον **κατάλογο** (Α8), και οι συντομεύσεις **δεν** είναι μέσα της | σύνδεσμος μέσα σε σύνδεσμο |
 * | Σ3 | η πόρτα «Προσφέρω» **δεν** παίρνει συντομεύσεις | το footer μπήκε σε κάθε κάρτα |
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/demand/interest-check/OwnerInterestEntry', () => ({
  OwnerInterestEntry: () => null,
}));

import { LandingDoors } from '../LandingDoors';
import { MY_DEMANDS_ROUTE, newDemandWithTimingHref } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { DEMAND_TIMING_KINDS } from '@/types/property-demand';

const shortcuts = () => within(screen.getByRole('list', { name: 'property-market:demand.form.timing.legend' }));

describe('Σ — συντομεύσεις του πρώτου βήματος στην αρχική', () => {
  it('Σ1: μία συντόμευση ανά «πότε», με τη σειρά του SSoT, προς `?when=`', () => {
    render(<LandingDoors />);
    const links = shortcuts().getAllByRole('link');

    expect(links.map((a) => a.textContent)).toEqual(
      DEMAND_TIMING_KINDS.map((kind) => `property-market:demand.form.timing.${kind}`),
    );
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      DEMAND_TIMING_KINDS.map((kind) => String(newDemandWithTimingHref(kind, ''))),
    );
  });

  it('Σ2: η κάρτα μένει σύνδεσμος προς τον κατάλογο και δεν περιέχει τις συντομεύσεις', () => {
    render(<LandingDoors />);
    const card = screen.getByText('property-market:demand.door.label').closest('a');

    expect(card).toHaveAttribute('href', MY_DEMANDS_ROUTE);
    expect(card?.querySelector('a')).toBeNull();
    expect(card).not.toContainElement(shortcuts().getAllByRole('link')[0]);
  });

  it('Σ3: η πόρτα «Προσφέρω» δεν παίρνει συντομεύσεις', () => {
    render(<LandingDoors />);
    const offerCard = screen.getByText('property-market:offer.door.label').closest('li');

    expect(offerCard?.querySelector('a')).toHaveAttribute('href', MY_OFFERS_ROUTE);
    expect(offerCard?.querySelectorAll('a')).toHaveLength(1);
  });
});
