/**
 * @jest-environment jsdom
 *
 * @fileoverview Καπνός για τη σελίδα `/listing/[id]/photos` (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related components/listing-detail/media/ListingPhotosPageContent
 *
 * 🔑 Δεν ξαναδοκιμάζει ό,τι φυλά ήδη το `ListingGallery.test.tsx` (η επιλογή προέλευσης/alt) — ρωτά μόνο
 * ό,τι είναι ΝΕΟ εδώ: πλέγμα ΟΛΩΝ των εικόνων, η επικεφαλίδα, και οι καρτέλες.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingPhotosPageContent } from '../ListingPhotosPageContent';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import type { PublicListing } from '@/types/public-listing';
import type { PublicListingLookup } from '@/services/realtime/hooks/usePublicListings';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/listing/prop_a0000001/photos',
}));

// ADR-884 Φ2στ · §4.12 Μέρος Δ — η ερώτηση «έχει η αγγελία περιήγηση;» δεν είναι θέμα αυτής της
// άγκυρας· τη φυλά το `useTourPresenceAvailable` μόνο του.
jest.mock('@/lib/spatial-tour/useTourPresenceAvailable', () => ({
  useTourPresenceAvailable: () => false,
}));

const mockLookup = { value: { state: 'loading' } as PublicListingLookup };
jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicListing: () => mockLookup.value,
}));

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_a0000001',
    title: 'Διαμέρισμα στην Εγνατία',
    authorship: 'agency',
    coverImage: null,
    gallery: [
      { url: 'https://shelf/0.webp', width: 1280, height: 960, altKey: LISTING_MATERIAL_KEYS.agency.galleryAlt, sources: [] },
      { url: 'https://shelf/1.webp', width: 1280, height: 960, altKey: LISTING_MATERIAL_KEYS.agency.galleryAlt, sources: [] },
    ],
    floorplans: [],
    ...over,
  } as unknown as PublicListing;
}

describe('ADR-884 Φ2στ · §4.12 Μέρος Δ — `/listing/[id]/photos`', () => {
  it('🔑 φόρτωση ⇒ μήνυμα φόρτωσης, καμία εικόνα', () => {
    mockLookup.value = { state: 'loading' };
    render(<ListingPhotosPageContent listingId="prop_a0000001" />);
    expect(screen.getByText('search-results:detail.loading')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('🔑 βρέθηκε ⇒ ΟΛΕΣ οι εικόνες της συλλογής, ο τίτλος και οι καρτέλες', () => {
    mockLookup.value = { state: 'found', listing: listing() };
    render(<ListingPhotosPageContent listingId="prop_a0000001" />);

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Διαμέρισμα στην Εγνατία' })).toBeInTheDocument();
    // Η καρτέλα «φωτογραφίες» είναι η τρέχουσα.
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.photos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Χωρίς κατόψεις δηλωμένες σε αυτό το fixture ⇒ η καρτέλα «κάτοψη» ΔΕΝ εμφανίζεται.
    expect(screen.queryByRole('link', { name: 'listing-detail:media.tabs.floorplan' })).not.toBeInTheDocument();
  });

  it('⛔ χωρίς αγγελία (`absent`) ⇒ μήνυμα απουσίας, καμία εικόνα', () => {
    mockLookup.value = { state: 'absent' };
    render(<ListingPhotosPageContent listingId="prop_a0000001" />);
    expect(screen.getByText('search-results:detail.absent.title')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
