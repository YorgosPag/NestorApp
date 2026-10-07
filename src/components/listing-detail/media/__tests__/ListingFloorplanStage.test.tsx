/**
 * @fileoverview **Η σκηνή της κάτοψης μέσα στην καρτέλα** (ADR-907 Φ2β-3 · Φ2β-4), εκτελεσμένη.
 *
 * Σ1 — τα χειριστήρια όψης υπάρχουν, και το κουτί παραχωρεί την κύλιση στη σελίδα (`touch-pan-y`);
 * Σ2 — σημείο λήψης ⇒ η φωτογραφία **στην ίδια σελίδα**: γράφεται `?photo=N`, η διαδρομή ΔΕΝ αλλάζει, κανένα `router.push`;
 * Σ3 — χωρίς επιλογή φαίνεται η πρώτη φωτογραφία της κάτοψης, χωρίς να γραφτεί τίποτα στη διεύθυνση;
 * Σ4 — προηγούμενη/επόμενη βηματίζουν **ανάμεσα στα σημεία αυτής της κάτοψης**, κυκλικά;
 * Σ5 — πολλές κατόψεις ⇒ επιλογέας· `?photo=` άλλης κάτοψης **φέρνει** την κάτοψή της;
 * Σ6 — κάτοψη χωρίς σημεία ⇒ καμία φωτογραφία δίπλα, μόνο η σκηνή;
 * Σ7 — κλικ που ακολουθεί **σύρσιμο** δεν ανοίγει φωτογραφία.
 *
 * ⚠️ Το ότι ο τροχός κυλά τη σελίδα και ότι η μεγέθυνση/σύρση δουλεύουν πάνω σε πραγματική διάταξη τα βλέπει ο browser
 * (ADR-907 §7)· η λογική τους είναι στο `useZoomPan.test`.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { ListingCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { ListingFloorplan, ListingImage, PublicListing } from '@/types/public-listing';

import { ListingFloorplanStage } from '../ListingFloorplanStage';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: mockPush, replace: mockPush, prefetch: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn() }),
}));

const PATH = '/listing/prop_1';

const spot = (floorplanIndex: number, x = 0.5): ListingCaptureSpot => ({ floorplanIndex, x, y: 0.5, headingRad: 0, fovRad: 1.2 });

const photo = (name: string, captureSpot?: ListingCaptureSpot): ListingImage => ({
  url: `https://shelf/${name}.webp`, width: 1600, height: 1200, altKey: 'alt', sources: [],
  ...(captureSpot ? { captureSpot } : {}),
});

const plan = (name: string): ListingFloorplan => ({
  provenance: 'declared', at: '2026-10-01T00:00:00.000Z',
  value: { url: `https://shelf/${name}.webp`, width: 1000, height: 800, altKey: 'plan-alt', sources: [] },
} as ListingFloorplan);

function renderStage(images: readonly ListingImage[], floorplans: readonly ListingFloorplan[], query = '') {
  window.history.replaceState(null, '', `${PATH}${query}`);
  const listing = { id: 'prop_1', coverImage: null, gallery: [...images], floorplans: [...floorplans], authorship: 'agency' } as unknown as PublicListing;
  // Ο `TooltipProvider` έρχεται από το `(light)/layout.tsx` (ADR-813)· εδώ το δίνει το test.
  return render(
    <TooltipProvider>
      <ListingFloorplanStage listing={listing} shown={floorplans} caption={(shown) => <p>{`caption:${shown.value.url}`}</p>} />
    </TooltipProvider>,
  );
}

const marker = (index: number, total: number) =>
  screen.getByRole('button', { name: `listing-detail:media.capture.markerLabel::${JSON.stringify({ index, total })}` });
const sidePhoto = () => screen.queryByRole('complementary')?.querySelector('img') ?? null;
const photoParam = () => new URLSearchParams(window.location.search).get('photo');

beforeEach(() => mockPush.mockClear());

describe('ListingFloorplanStage', () => {
  const images = [photo('a', spot(0, 0.2)), photo('b'), photo('c', spot(0, 0.8))];

  it('Σ1 χειριστήρια όψης + το κουτί παραχωρεί την κάθετη κύλιση στη σελίδα', () => {
    const { container } = renderStage(images, [plan('ground')]);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'photoPreview.zoom.in' })).toBeInTheDocument();
    expect(container.querySelector('[data-floorplan-stage]')?.className).toContain('touch-pan-y');
  });

  it('🔴 Σ2 σημείο λήψης ⇒ φωτογραφία ΣΤΗΝ ΙΔΙΑ ΣΕΛΙΔΑ — `?photo=N`, ίδια διαδρομή, κανένα `router.push`', async () => {
    renderStage(images, [plan('ground')], '?mediaTab=floorplan&adults=2');
    fireEvent.click(marker(3, 3));

    expect(window.location.pathname).toBe(PATH);
    expect(photoParam()).toBe('3');
    // Οι άλλες παράμετροι της σελίδας δεν χάνονται.
    expect(new URLSearchParams(window.location.search).get('mediaTab')).toBe('floorplan');
    expect(new URLSearchParams(window.location.search).get('adults')).toBe('2');
    expect(mockPush).not.toHaveBeenCalled();
    // Η διεύθυνση ειδοποιεί τους αναγνώστες της σε microtask (`url-query-state`).
    await waitFor(() => expect(sidePhoto()?.getAttribute('src')).toBe('https://shelf/c.webp'));
    expect(marker(3, 3)).toHaveAttribute('aria-current', 'true');
  });

  it('Σ3 χωρίς επιλογή ⇒ η πρώτη φωτογραφία της κάτοψης, και η διεύθυνση μένει ανέγγιχτη', () => {
    renderStage(images, [plan('ground')]);
    expect(sidePhoto()?.getAttribute('src')).toBe('https://shelf/a.webp');
    expect(window.location.search).toBe('');
    // Η έξοδος στο πλήρες παράθυρο μένει σύνδεσμος — δεν αντικαταστάθηκε.
    expect(screen.getByRole('link').getAttribute('href')).toContain('/photos?photo=1');
  });

  it('Σ4 προηγούμενη/επόμενη: μόνο ανάμεσα στα σημεία αυτής της κάτοψης, κυκλικά', async () => {
    renderStage(images, [plan('ground')]);
    fireEvent.click(screen.getByRole('button', { name: 'listing-detail:media.capture.next' }));
    // η «b» δεν έχει θέση — δεν είναι στάση
    await waitFor(() => expect(sidePhoto()?.getAttribute('src')).toBe('https://shelf/c.webp'));
    fireEvent.click(screen.getByRole('button', { name: 'listing-detail:media.capture.next' }));
    await waitFor(() => expect(sidePhoto()?.getAttribute('src')).toBe('https://shelf/a.webp'));
  });

  it('🔴 Σ5 πολλές κατόψεις: επιλογέας, και `?photo=` άλλης κάτοψης ΦΕΡΝΕΙ την κάτοψή της', async () => {
    const two = [photo('a', spot(0)), photo('b', spot(1))];
    renderStage(two, [plan('ground'), plan('first')], '?photo=2');

    expect(screen.getByText('caption:https://shelf/first.webp')).toBeInTheDocument();
    expect(sidePhoto()?.getAttribute('src')).toBe('https://shelf/b.webp');

    fireEvent.click(screen.getByRole('button', { name: `listing-detail:media.capture.floorplanTab::${JSON.stringify({ index: 1 })}` }));
    expect(await screen.findByText('caption:https://shelf/ground.webp')).toBeInTheDocument();
    // Η επιλογή κάτοψης αφήνει τη φωτογραφία της άλλης: αλλιώς η διεύθυνση θα την ξανάφερνε πίσω.
    expect(photoParam()).toBeNull();
  });

  it('Σ6 κάτοψη χωρίς σημεία ⇒ μόνο η σκηνή — καμία φωτογραφία δίπλα, κανένας επιλογέας για μία κάτοψη', () => {
    renderStage([photo('a'), photo('b')], [plan('ground')]);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('🔴 Σ7 κλικ μετά από ΣΥΡΣΙΜΟ δεν ανοίγει φωτογραφία', () => {
    renderStage(images, [plan('ground')]);
    const target = marker(3, 3);
    fireEvent.mouseDown(target, { clientX: 100, clientY: 100 });
    fireEvent.click(target, { clientX: 160, clientY: 130 });
    expect(photoParam()).toBeNull();

    fireEvent.mouseDown(target, { clientX: 100, clientY: 100 });
    fireEvent.click(target, { clientX: 101, clientY: 100 });
    expect(photoParam()).toBe('3');
  });
});
