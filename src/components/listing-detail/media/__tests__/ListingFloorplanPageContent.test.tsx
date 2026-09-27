/**
 * @jest-environment jsdom
 *
 * @fileoverview Καπνός για τη σελίδα `/listing/[id]/floorplan` (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related components/listing-detail/media/ListingFloorplanPageContent
 *
 * 🔑 Δεν ξαναδοκιμάζει ό,τι φυλά ήδη το `ListingFloorplans.test.tsx` (προέλευση/alt) — ρωτά μόνο ό,τι είναι
 * ΝΕΟ εδώ: όλες οι κατόψεις στοιβαγμένες σε πλήρες πλάτος, η επικεφαλίδα, και οι καρτέλες.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingFloorplanPageContent } from '../ListingFloorplanPageContent';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import type { ListingFloorplan, PublicListing } from '@/types/public-listing';
import type { PublicListingLookup } from '@/services/realtime/hooks/usePublicListings';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/listing/prop_a0000001/floorplan',
}));

jest.mock('@/lib/spatial-tour/useTourPresenceAvailable', () => ({
  useTourPresenceAvailable: () => false,
}));

const mockLookup = { value: { state: 'loading' } as PublicListingLookup };
jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicListing: () => mockLookup.value,
}));

const AT = '2026-08-20T10:00:00.000Z';

function declaredPlan(url = 'https://shelf/plan.webp'): ListingFloorplan {
  return {
    provenance: 'declared',
    at: AT,
    value: {
      url,
      width: 1280,
      height: 960,
      altKey: LISTING_MATERIAL_KEYS.agency.floorplanAlt,
      sources: [],
    },
  };
}

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_a0000001',
    title: 'Διαμέρισμα στην Εγνατία',
    authorship: 'agency',
    coverImage: null,
    gallery: [],
    floorplans: [declaredPlan()],
    ...over,
  } as unknown as PublicListing;
}

describe('ADR-884 Φ2στ · §4.12 Μέρος Δ — `/listing/[id]/floorplan`', () => {
  it('🔑 βρέθηκε ⇒ η κάτοψη σε πλήρες πλάτος, ο τίτλος και οι καρτέλες', () => {
    mockLookup.value = { state: 'found', listing: listing() };
    render(<ListingFloorplanPageContent listingId="prop_a0000001" />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Διαμέρισμα στην Εγνατία' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.floorplan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Χωρίς φωτογραφίες ⇒ ΚΑΜΙΑ καρτέλα «Φωτογραφίες» (ήταν σταθερό `photos: true` — σύνδεσμος σε άδεια σελίδα).
    expect(screen.queryByRole('link', { name: 'listing-detail:media.tabs.photos' })).toBeNull();
  });

  it('με φωτογραφίες ⇒ η καρτέλα «Φωτογραφίες» εμφανίζεται', () => {
    mockLookup.value = { state: 'found', listing: listing({ gallery: [declaredPlan('https://shelf/photo.webp').value] } as Partial<PublicListing>) };
    render(<ListingFloorplanPageContent listingId="prop_a0000001" />);
    expect(screen.getByRole('link', { name: 'listing-detail:media.tabs.photos' })).toBeInTheDocument();
  });

  it('⛔ καμία δημοσιεύσιμη κάτοψη ⇒ η απουσία ονομάζεται, ΠΟΤΕ «δεν υπάρχει»', () => {
    mockLookup.value = { state: 'found', listing: listing({ floorplans: [] }) };
    render(<ListingFloorplanPageContent listingId="prop_a0000001" />);
    expect(screen.getByText('search-results:detail.media.absent')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('⛔ χωρίς αγγελία (`absent`) ⇒ μήνυμα απουσίας', () => {
    mockLookup.value = { state: 'absent' };
    render(<ListingFloorplanPageContent listingId="prop_a0000001" />);
    expect(screen.getByText('search-results:detail.absent.title')).toBeInTheDocument();
  });
});
