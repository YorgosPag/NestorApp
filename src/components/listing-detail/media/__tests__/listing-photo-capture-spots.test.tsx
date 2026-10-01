/**
 * @fileoverview 📍 **Η ΔΗΜΟΣΙΑ ΠΛΕΥΡΑ ΤΩΝ ΣΗΜΕΙΩΝ ΛΗΨΗΣ, ΕΚΤΕΛΕΣΜΕΝΗ** (ADR-897 Φ4).
 * @related lib/listings/listing-capture-spots · lib/listings/listing-routes · ../ListingPhotoLightbox · ../PhotoFloorplanPanel
 *
 * Δ1 — τα σημεία δένονται στη σειρά που **βλέπει** ο επισκέπτης (εξώφυλλο πρώτο), όχι στη θέση στο `gallery`;
 * Δ2 — κατόψεις που δεν παρουσιάζονται **δεν** δείχνουν σημεία· η «Κάτοψη N» είναι ίδια παντού;
 * Δ3 — `?photo=N` ⇄ δείκτης: 1-based, ανθεκτικό σε σκουπίδι και σε φωτογραφίες που χάθηκαν;
 * Δ4 — lightbox: σημείο ⇒ άλμα· ← / → πλοηγούν· η τρέχουσα έχει `aria-current`· χωρίς θέση ⇒ ειπωμένο;
 * Δ5 — αγγελία **χωρίς** σημεία ⇒ κανένα πάνελ (η σελίδα μένει όπως πριν);
 * Δ6 — ο διάλογος έχει **περιγραφή** (οδηγία ← →) — μετρημένο ζωντανά: η Radix προειδοποιούσε ότι έλειπε;
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { floorplanSpotsByUrl, listingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { listingPhotosHref, readListingPhotoParam } from '@/lib/listings/listing-routes';
import type { ListingCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { ListingFloorplan, ListingImage, PublicListing } from '@/types/public-listing';

import { ListingPhotoLightbox } from '../ListingPhotoLightbox';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

const spot = (floorplanIndex: number, x = 0.5): ListingCaptureSpot =>
  ({ floorplanIndex, x, y: 0.5, headingRad: 0, fovRad: 1.2 });

const photo = (name: string, captureSpot?: ListingCaptureSpot): ListingImage => ({
  url: `https://shelf/${name}.webp`, width: 1600, height: 1200, altKey: 'alt', sources: [],
  ...(captureSpot ? { captureSpot } : {}),
});

const plan = (name: string, provenance: ListingFloorplan['provenance'] = 'declared'): ListingFloorplan => ({
  provenance, at: '2026-10-01T00:00:00.000Z',
  // «Μαντεμένη» χωρίς έγκριση ανθρώπου ⇒ `confirmedAt: null` (ADR-842 Α7) — αλλιώς ο κριτής τη θεωρεί εγκεκριμένη.
  ...(provenance === 'inferred' ? { confirmedAt: null } : {}),
  value: { url: `https://shelf/${name}.webp`, width: 1000, height: 800, altKey: 'plan-alt', sources: [] },
} as ListingFloorplan);

function listing(over: Partial<PublicListing>): PublicListing {
  return { id: 'prop_1', coverImage: null, gallery: [], floorplans: [], ...over } as unknown as PublicListing;
}

describe('Δ1 — η σειρά του επισκέπτη', () => {
  it('με ξεχωριστό εξώφυλλο, ο δείκτης είναι η θέση στο lightbox', () => {
    const cover = photo('cover');
    const kitchen = photo('kitchen', spot(0));
    const subject = listing({ coverImage: cover, gallery: [kitchen], floorplans: [plan('ground')] });
    const [entry] = listingFloorplanSpots(subject, [cover, kitchen]);
    expect(entry.photos).toEqual([{ imageIndex: 1, spot: spot(0) }]);
  });
});

describe('Δ2 — μόνο κατόψεις που παρουσιάζονται, σταθερή αρίθμηση', () => {
  it('μη παρουσιάσιμη κάτοψη ⇒ κανένα σημείο· η επόμενη κρατά το «Κάτοψη 2» της σελίδας', () => {
    const images = [photo('a', spot(0)), photo('b', spot(1)), photo('c', spot(2))];
    const subject = listing({ gallery: images, floorplans: [plan('one'), plan('guess', 'inferred'), plan('three')] });
    const entries = listingFloorplanSpots(subject, images);
    expect(entries.map((entry) => [entry.floorplanIndex, entry.ordinal])).toEqual([[0, 1], [2, 2]]);
    expect(floorplanSpotsByUrl(entries).has('https://shelf/guess.webp')).toBe(false);
  });

  it('δείκτης πέρα από τις κατόψεις ⇒ αγνοείται (ο αναγνώστης δεν εμπιστεύεται τον γραφέα)', () => {
    const images = [photo('a', spot(5))];
    expect(listingFloorplanSpots(listing({ gallery: images, floorplans: [plan('one')] }), images)).toEqual([]);
  });
});

describe('Δ3 — `?photo=N`', () => {
  it('σύνδεσμος 1-based, ανάγνωση 0-based', () => {
    expect(listingPhotosHref('prop_1', 2)).toBe('/listing/prop_1/photos?photo=3');
    expect(listingPhotosHref('prop_1')).toBe('/listing/prop_1/photos');
    expect(readListingPhotoParam('?photo=3', 5)).toBe(2);
  });

  it.each([['', 5], ['?photo=0', 5], ['?photo=6', 5], ['?photo=2.5', 5], ['?photo=abc', 5], ['?photo=-1', 5]])(
    '%p ⇒ καμία ανοιχτή φωτογραφία', (query, total) => {
      expect(readListingPhotoParam(query, total)).toBeNull();
    },
  );
});

function renderLightbox(images: readonly ListingImage[], floorplans: readonly ListingFloorplan[], openIndex: number) {
  const onNavigate = jest.fn();
  const entries = listingFloorplanSpots(listing({ gallery: [...images], floorplans: [...floorplans] }), images);
  render(<ListingPhotoLightbox images={images} floorplans={entries} openIndex={openIndex} onNavigate={onNavigate} />);
  return onNavigate;
}

const markerName = (index: number, total: number) =>
  `listing-detail:media.capture.markerLabel::${JSON.stringify({ index, total })}`;

describe('Δ4 — lightbox με πάνελ', () => {
  const images = [photo('a', spot(0, 0.2)), photo('b', spot(0, 0.8)), photo('c')];

  it('σημείο ⇒ άλμα στη φωτογραφία του· η τρέχουσα έχει `aria-current`', async () => {
    const onNavigate = renderLightbox(images, [plan('ground')], 0);
    expect(screen.getByRole('button', { name: markerName(1, 3) })).toHaveAttribute('aria-current', 'true');
    await userEvent.click(screen.getByRole('button', { name: markerName(2, 3) }));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('← / → πλοηγούν, και τα άκρα δεν ξεπερνιούνται', async () => {
    const onNavigate = renderLightbox(images, [plan('ground')], 0);
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onNavigate.mock.calls).toEqual([[1]]);
    expect(screen.getByRole('button', { name: 'listing-detail:media.capture.previous' })).toBeDisabled();
  });

  it('φωτογραφία χωρίς θέση ⇒ το λέμε, χωρίς τονισμένο σημείο', () => {
    renderLightbox(images, [plan('ground')], 2);
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByRole('status')).toHaveTextContent('listing-detail:media.capture.notPlaced');
    expect(panel.querySelector('[aria-current]')).toBeNull();
  });
});

describe('Δ5 — χωρίς σημεία, κανένα πάνελ', () => {
  it('η φωτογραφία μόνη της, όπως πριν', () => {
    renderLightbox([photo('a'), photo('b')], [plan('ground')], 0);
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('Δ6 — ο διάλογος έχει περιγραφή (ADR-897 §6, ζωντανός έλεγχος)', () => {
  it('το `aria-describedby` δείχνει στην οδηγία πληκτρολογίου — όχι σιωπή, όχι προειδοποίηση της Radix', () => {
    renderLightbox([photo('a', spot(0)), photo('b')], [plan('ground')], 0);
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('listing-detail:media.photosPage.keyboardHint');
  });
});
