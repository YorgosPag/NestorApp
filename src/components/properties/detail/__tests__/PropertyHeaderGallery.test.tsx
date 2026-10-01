/**
 * @fileoverview **Η γκαλερί της κεφαλίδας ακινήτου** (ADR-899 §9).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Η1: αποτυχία ανάγνωσης ⇒ σιωπηλό σπιτάκι (το σύμπτωμα της 2026-10-01).
 * - Η2: τα `<img>` ζητούν το πρωτότυπο αντί για την κλίμακα (`srcset` χάνεται).
 * - Η3: κλικ σε slide δεν ανοίγει το lightbox στη ΣΩΣΤΗ φωτογραφία.
 * - Η4: ←/→ δεν πλοηγούν μέσα στη γκαλερί.
 * - Η5: δεύτερη εικόνα με `fetchpriority="high"` (ADR-841 Α2.4).
 * - Η6: οι κατόψεις διαβάζονται χωρίς να ανοίξει το lightbox.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PropertyPhotosState } from '@/features/property-grid/hooks/usePropertyThumbnail';
import type { Property } from '@/types/property-viewer';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));
let photosState: PropertyPhotosState = { kind: 'loading' };
jest.mock('@/features/property-grid/hooks/usePropertyThumbnail', () => ({ usePropertyPhotos: () => photosState }));
const floorplansHook = jest.fn((..._args: unknown[]) => []);
jest.mock('@/features/property-grid/hooks/usePropertyFloorplanSpots', () => ({
  usePropertyFloorplanSpots: (...args: unknown[]) => floorplansHook(...args),
}));
const lightboxProps = jest.fn();
jest.mock('next/dynamic', () => () => (props: Record<string, unknown>) => {
  lightboxProps(props);
  return <div data-testid="lightbox" />;
});

import { PropertyHeaderGallery } from '../PropertyHeaderGallery';

const PROPERTY = { id: 'prop_1' } as Property;
const photo = (fileId: string, hasCaptureSpot = false) => ({
  fileId,
  url: `/api/storage/file/${fileId}.jpg`,
  preview: { src: `/api/storage/file/${fileId}.jpg?w=1280`, srcSet: `/api/storage/file/${fileId}.jpg?w=320 320w` },
  title: fileId,
  hasCaptureSpot,
});

class NoopObserver { observe() {} disconnect() {} unobserve() {} }

beforeAll(() => {
  Object.assign(globalThis, { IntersectionObserver: NoopObserver });
  Element.prototype.scrollTo = jest.fn();
});
beforeEach(() => {
  lightboxProps.mockClear();
  floorplansHook.mockClear();
});

describe('PropertyHeaderGallery', () => {
  it('🔴 Η1 αποτυχία ⇒ ορατή κατάσταση, όχι σιωπηλό εικονίδιο', () => {
    photosState = { kind: 'failed' };
    render(<PropertyHeaderGallery property={PROPERTY} />);
    expect(screen.getByRole('status')).toHaveTextContent('properties-detail:detailPage.photos.loadFailed');
  });

  it('🔴 Η2 + Η5 παράγωγα με srcset· μία μόνο εικόνα υψηλής προτεραιότητας', () => {
    photosState = { kind: 'ready', photos: [photo('a', true), photo('b')] };
    render(<PropertyHeaderGallery property={PROPERTY} />);
    const images = screen.getAllByRole('img');
    expect(images.map((img) => img.getAttribute('srcset'))).toEqual([photo('a').preview.srcSet, photo('b').preview.srcSet]);
    expect(images.filter((img) => img.getAttribute('fetchpriority') === 'high')).toHaveLength(1);
    expect(screen.getByText('properties-detail:detailPage.photos.captureSpot')).toBeInTheDocument();
  });

  it('🔴 Η3 + Η6 κλικ στη 2η ⇒ lightbox στη 2η· οι κατόψεις ζητούνται μόνο τότε', async () => {
    photosState = { kind: 'ready', photos: [photo('a', true), photo('b')] };
    render(<PropertyHeaderGallery property={PROPERTY} />);
    expect(floorplansHook).toHaveBeenLastCalledWith(PROPERTY, expect.any(Array), false);
    await userEvent.click(screen.getByRole('button', { name: /openLabel::\{"index":2,"total":2\}/ }));
    expect(lightboxProps).toHaveBeenLastCalledWith(expect.objectContaining({ openIndex: 1 }));
    expect(floorplansHook).toHaveBeenLastCalledWith(PROPERTY, expect.any(Array), true);
  });

  it('🔴 Η4 → από slide ⇒ ο κύλινδρος πάει στην επόμενη', async () => {
    photosState = { kind: 'ready', photos: [photo('a'), photo('b')] };
    render(<PropertyHeaderGallery property={PROPERTY} />);
    const scroller = screen.getByRole('list');
    Object.defineProperty(scroller, 'clientWidth', { value: 192, configurable: true });
    screen.getAllByRole('button', { name: /openLabel/ })[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(scroller.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 192 }));
  });

  it('κανένα αρχείο ⇒ το εικονίδιο της οντότητας, καμία γκαλερί', () => {
    photosState = { kind: 'ready', photos: [] };
    render(<PropertyHeaderGallery property={PROPERTY} />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
