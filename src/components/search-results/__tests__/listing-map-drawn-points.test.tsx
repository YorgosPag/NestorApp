/**
 * @fileoverview ΑΓΚΥΡΑ — **πινακίδες τιμής ΜΟΝΟ πάνω σε σημείο που ο χάρτης ζωγράφισε χωριστά** (ADR-777 §8.78).
 * @related components/search-results/listing-map-drawn-points.tsx · ListingPriceMarkers.tsx · lib/listings/listing-price-markers.ts
 *
 *   Ζ1 · ανάγνωση: ομάδα (`point_count`) ⇒ έξω · μεμονωμένο σημείο ⇒ μέσα · διπλό από δύο πλακίδια ⇒ μία φορά.
 *   Ζ2 · σύνδεση: ο χάρτης ρωτιέται στο `idle`, στην πηγή που έδωσε ο πυρήνας — όχι νωρίτερα.
 *   Ζ3 · ενσωμάτωση: μέσα στον πυρήνα, πινακίδα σε σημείο ομάδας ΔΕΝ αποδίδεται· έξω από πυρήνα, όλες.
 *   Ζ5 · λεζάντα `≈` (§8.66.11): φαίνεται ΜΟΝΟ όταν ζωγραφίστηκε ομάδα με αβέβαιο υποσύνολο.
 *   Ζ4 · σύγκρουση (κανόνας 5): η δεύτερη κατά σειρά γίνεται `invisible` ΣΤΟ ΠΕΡΙΒΛΗΜΑ· hover ⇒ ξαναφαίνεται·
 *        αλλαγή ζουμ ⇒ ξαναμέτρηση.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

jest.mock('@/lib/maps/maplibre', () => ({
  Marker: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="marker" className={className}>{children}</div>
  ),
}));

import {
  bindDrawnListingPoints,
  DrawnListingPointsProvider,
  readApproximateClusters,
  readDrawnListingPoints,
} from '../listing-map-drawn-points';
import { ClusterApproximationKey } from '../ClusterApproximationKey';
import { CLUSTER_UNCERTAIN_KEY } from '@/lib/maps/listing-clusters';
import { ListingPriceMarkers } from '../ListingPriceMarkers';
import type { MapEventTarget, RenderedFeature } from '../results-map-contract';
import { NO_LISTING_FOCUS } from '@/lib/listings/listing-focus';
import type { ListingPriceMarker } from '@/lib/listings/listing-price-markers';

const CLUSTER: RenderedFeature = { properties: { cluster: true, cluster_id: 7, point_count: 2 } };
const POINT_A: RenderedFeature = { properties: { id: 'a', shape: 'pin' } };
const POINT_B: RenderedFeature = { properties: { id: 'b', shape: 'pin' } };

const A: ListingPriceMarker = { id: 'a', title: 'Α', lng: 22.94, lat: 40.64, amount: 150_000, role: 'sale' };
const B: ListingPriceMarker = { id: 'b', title: 'Β', lng: 22.95, lat: 40.65, amount: 90_000, role: 'sale' };

describe('Ζ1 — τι ζωγράφισε η πηγή', () => {
  it('η ομάδα μένει έξω, τα μεμονωμένα σημεία μέσα, το διπλό από δύο πλακίδια μία φορά', () => {
    expect([...readDrawnListingPoints([CLUSTER, POINT_A, POINT_A, { properties: undefined }])]).toEqual(['a']);
  });

  it('ο κριτής είναι το `point_count`, όχι η απουσία `id` — ομάδα που κουβαλά `id` μένει έξω', () => {
    // Ένα μελλοντικό `clusterProperties` που συναθροίζει ταυτότητα δεν πρέπει να «ξεκλειδώσει» πινακίδα σε ομάδα.
    const clusterWithId: RenderedFeature = { properties: { id: 'a', point_count: 2 } };
    expect(readDrawnListingPoints([clusterWithId]).size).toBe(0);
  });
});

describe('Ζ5 — η λεζάντα του ≈ ακολουθεί ό,τι ζωγραφίστηκε (§8.66.11)', () => {
  const approx: RenderedFeature = { properties: { point_count: 17, [CLUSTER_UNCERTAIN_KEY]: 5 } };
  const exact: RenderedFeature = { properties: { point_count: 17, [CLUSTER_UNCERTAIN_KEY]: 0 } };

  it('ομάδα με αβέβαιο υποσύνολο ⇒ ναι · ομάδα χωρίς ⇒ όχι · σημείο με ίδιο πεδίο ⇒ όχι (δεν είναι ομάδα)', () => {
    expect(readApproximateClusters([exact, POINT_A, approx])).toBe(true);
    expect(readApproximateClusters([exact, CLUSTER, POINT_A])).toBe(false);
    expect(readApproximateClusters([{ properties: { id: 'a', [CLUSTER_UNCERTAIN_KEY]: 3 } }])).toBe(false);
  });

  it('η λεζάντα αποδίδεται μόνο όταν ζωγραφίστηκε «≈» — ως σημασιολογικό aside με όνομα', () => {
    const { rerender } = render(<ClusterApproximationKey visible={false} />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    rerender(<ClusterApproximationKey visible />);
    expect(screen.getByRole('complementary', { name: 'search-focus:clusterKey.label' })).toHaveTextContent(
      'search-focus:clusterKey.approximate',
    );
  });
});

describe('Ζ2 — ο χάρτης ρωτιέται στο idle', () => {
  it('καμία ανάγνωση πριν το idle· στο idle, η πηγή του πυρήνα', () => {
    const handlers = new Map<string, () => void>();
    const querySourceFeatures = jest.fn(() => [CLUSTER, POINT_B]);
    const target = {
      on: (event: string, handler: () => void) => { handlers.set(event, handler); },
      querySourceFeatures,
      getZoom: () => 15.5,
    } as unknown as MapEventTarget;
    const onDrawn = jest.fn();

    bindDrawnListingPoints(target, 'public-listings', onDrawn);
    expect(onDrawn).not.toHaveBeenCalled();

    handlers.get('idle')?.();
    expect(querySourceFeatures).toHaveBeenCalledWith('public-listings');
    const snapshot = onDrawn.mock.calls[0][0] as { points: ReadonlySet<string>; zoom: number };
    expect([...snapshot.points]).toEqual(['b']);
    expect(snapshot.zoom).toBe(15.5);
    expect(onDrawn.mock.calls[0][0]).toHaveProperty('approximateClusters', false);
  });
});

describe('Ζ3 — οι πινακίδες ακολουθούν ό,τι ζωγραφίστηκε', () => {
  const plaques = () => screen.queryAllByTestId('marker');
  const markers = <ListingPriceMarkers markers={[A, B]} focus={NO_LISTING_FOCUS} pinRadiusPx={7} />;

  it('μέσα στον πυρήνα: η αγγελία της ομάδας ΔΕΝ παίρνει πινακίδα', () => {
    render(<DrawnListingPointsProvider drawn={new Set(['b'])} zoom={15}>{markers}</DrawnListingPointsProvider>);
    expect(plaques()).toHaveLength(1);
  });

  it('ο ομαδοποιητής δεν απάντησε ακόμη ⇒ καμία πινακίδα', () => {
    render(<DrawnListingPointsProvider drawn="unknown" zoom={null}>{markers}</DrawnListingPointsProvider>);
    expect(plaques()).toHaveLength(0);
  });

  it('έξω από τον πυρήνα (χωρίς ομαδοποιητή) ⇒ όλες', () => {
    render(markers);
    expect(plaques()).toHaveLength(2);
  });
});

describe('Ζ4 — δύο πινακίδες στο ίδιο σημείο (ίδιο κτίριο): η δεύτερη γίνεται κουκίδα', () => {
  /** Θέση ανά αγγελία — το jsdom δεν έχει διάταξη, οπότε τη δηλώνουμε. */
  let left: Record<string, number>;
  beforeEach(() => {
    left = { a: 100, b: 104 };
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      const x = left[this.dataset.listingId ?? ''] ?? 0;
      return { left: x, right: x + 70, top: 0, bottom: 20, x, y: 0, width: 70, height: 20, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  const wrappers = () => screen.getAllByTestId('marker');
  // ΣΤΑΘΕΡΟΣ πίνακας: αλλιώς κάθε απόδοση θα ξαναμετρούσε έτσι κι αλλιώς, και το «νέο ζουμ» δεν θα ελεγχόταν.
  const both = [A, B];
  const view = (zoom: number, peeked: string | null = null) => (
    <DrawnListingPointsProvider drawn="all" zoom={zoom}>
      <ListingPriceMarkers markers={both} focus={{ selected: null, peeked }} pinRadiusPx={7} />
    </DrawnListingPointsProvider>
  );

  it('η δεύτερη κατά τη σειρά του κριτή κρύβεται — στο περίβλημα, όχι μόνο στο κουμπί', () => {
    render(view(15));
    expect(wrappers()[0]).not.toHaveClass('invisible');
    expect(wrappers()[1]).toHaveClass('invisible');
  });

  it('hover στην κρυμμένη ⇒ ξαναφαίνεται (ό,τι κοιτάς φαίνεται)', () => {
    const { rerender } = render(view(15));
    rerender(view(15, 'b'));
    expect(wrappers()[1]).not.toHaveClass('invisible');
  });

  it('νέο ζουμ ⇒ ξαναμέτρηση: χωρίστηκαν ⇒ και οι δύο ορατές', () => {
    const { rerender } = render(view(15));
    left = { a: 100, b: 300 };
    act(() => { rerender(view(17)); });
    expect(wrappers()[1]).not.toHaveClass('invisible');
  });
});
