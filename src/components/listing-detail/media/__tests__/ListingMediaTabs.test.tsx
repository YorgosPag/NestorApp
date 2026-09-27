/**
 * @jest-environment jsdom
 *
 * @fileoverview Άγκυρες της **καρτέλας μέσων** — «Φωτογραφίες · Κάτοψη · 3D» (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related components/listing-detail/media/ListingMediaTabs
 *
 * 🔑 Δύο ερωτήματα: (α) μια καρτέλα που δεν είναι διαθέσιμη **και δεν είναι η τρέχουσα** δεν εμφανίζεται·
 * (β) η τρέχουσα καρτέλα φέρει `aria-current="page"` — και **μόνο** αυτή.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingMediaTabs } from '../ListingMediaTabs';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Το `Link` (`@/lib/workspace/navigation`) ρωτά την τρέχουσα διαδρομή για τον ενεργό χώρο.
jest.mock('next/navigation', () => ({
  usePathname: () => '/listing/prop_a0000001/photos',
}));

const LISTING_ID = 'prop_a0000001';

describe('ADR-884 Φ2στ · §4.12 Μέρος Δ — ΟΙ ΤΡΕΙΣ ΚΑΡΤΕΛΕΣ', () => {
  it('🔑 και οι τρεις διαθέσιμες ⇒ και οι τρεις εμφανίζονται', () => {
    render(
      <ListingMediaTabs
        listingId={LISTING_ID}
        current="photos"
        available={{ photos: true, floorplan: true, tour: true }}
      />,
    );
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.photos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.floorplan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.tour' })).toBeInTheDocument();
  });

  it('🔴 καρτέλα ΜΗ διαθέσιμη και ΟΧΙ τρέχουσα ⇒ ΔΕΝ εμφανίζεται', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε τον όρο `available.tour` από τη συνθήκη ⇒ κοκκινίζει
    //    (η καρτέλα «3D» θα εμφανιζόταν παρότι η αγγελία δεν έχει περιήγηση).
    render(
      <ListingMediaTabs
        listingId={LISTING_ID}
        current="photos"
        available={{ photos: true, floorplan: true, tour: false }}
      />,
    );
    expect(screen.queryByRole('link', { name: 'listing-detail:media.tabs.tour' })).not.toBeInTheDocument();
  });

  it('🏆 η τρέχουσα καρτέλα εμφανίζεται ΠΑΝΤΑ, ακόμη κι όταν το `available` λέει όχι', () => {
    // Ο επισκέπτης που ήδη βρίσκεται στη σελίδα δεν πρέπει να δει το δικό του κουμπί
    // να εξαφανίζεται επειδή η ερώτηση διαθεσιμότητας δεν έχει ακόμη απαντηθεί.
    render(
      <ListingMediaTabs
        listingId={LISTING_ID}
        current="tour"
        available={{ photos: true, floorplan: true, tour: false }}
      />,
    );
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.tour' })).toBeInTheDocument();
  });

  it('🔑 `aria-current="page"` ΜΟΝΟ στην τρέχουσα καρτέλα', () => {
    render(
      <ListingMediaTabs
        listingId={LISTING_ID}
        current="floorplan"
        available={{ photos: true, floorplan: true, tour: true }}
      />,
    );
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.floorplan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.photos' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.tour' })).not.toHaveAttribute('aria-current');
  });

  it('🔑 το `<nav>` έχει το ονομαστικό `aria-label`', () => {
    render(
      <ListingMediaTabs
        listingId={LISTING_ID}
        current="photos"
        available={{ photos: true, floorplan: false, tour: false }}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'listing-detail:media.tabs.label' })).toBeInTheDocument();
  });
});
