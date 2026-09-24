/**
 * @jest-environment node
 *
 * @fileoverview 🎯 **ΑΓΚΥΡΑ — οι στατικές κλάσεις θέσης φωτογραφίας** (ADR-880).
 *
 * Τρεις ερωτήσεις: *«υπάρχει literal για ΚΑΘΕ θέση που μπορεί να ζητηθεί;»* (αλλιώς το Tailwind δεν την
 * παράγει και η φωτογραφία πέφτει σιωπηλά στο κέντρο) · *«λέει η κλάση ό,τι λέει το κλειδί της;»* ·
 * *«ζητούν οι καταναλωτές τη συνάρτηση, και κανείς δεν γράφει `object-[…]` με το χέρι;»*.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import type { ListingImage } from '@/types/public-listing';

import { LISTING_CARD_ASPECT } from '../listing-card-frame';
import {
  PHOTO_POSITION_CLASSES,
  PHOTO_POSITION_STEP,
  listingPhotoPositionClass,
  photoPositionClass,
} from '../listing-photo-position-class';

const ROOT = join(__dirname, '..', '..', '..', '..');

const CONSUMERS = [
  'src/components/search-results/ListingCardGallery.tsx',
  'src/components/owner-property/OwnerPropertyCardCover.tsx',
];

const PORTRAIT = { width: 1000, height: 1500 };
const PANORAMA = { width: 3000, height: 1000 };

function image(focalPoint: unknown): ListingImage {
  return { url: 'u', width: 1000, height: 1500, altKey: 'k', sources: [], focalPoint } as ListingImage;
}

describe('πληρότητα — κάθε ζητήσιμη θέση έχει literal', () => {
  const steps = Array.from({ length: 100 / PHOTO_POSITION_STEP + 1 }, (_, i) => i * PHOTO_POSITION_STEP);

  it('ακριβώς οι δύο γραμμές του βήματος: 2·21 − 1 = 41', () => {
    const expected = new Set([...steps.map((p) => `50_${p}`), ...steps.map((p) => `${p}_50`)]);
    expect(new Set(Object.keys(PHOTO_POSITION_CLASSES))).toEqual(expected);
  });

  it.each(Object.entries(PHOTO_POSITION_CLASSES))('%s ⇒ %s λέει τον ίδιο αριθμό', (key, className) => {
    const [x, y] = key.split('_');
    expect(className).toBe(`object-[${x}%_${y}%]`);
  });

  it('κάθε σημείο σε κάθε σχήμα εικόνας βρίσκει κλάση (καμία σιωπηλή πτώση στο κέντρο)', () => {
    for (const shape of [PORTRAIT, PANORAMA, { width: 400, height: 1200 }, { width: 5000, height: 900 }]) {
      for (let i = 0; i <= 20; i += 1) {
        const point = { x: i / 20, y: 1 - i / 20 };
        expect(photoPositionClass(shape, LISTING_CARD_ASPECT, point)).not.toBe('');
      }
    }
  });
});

describe('σημασιολογία', () => {
  it('κάθετη φωτογραφία, θέμα ψηλά ⇒ η κάρτα ανεβαίνει', () => {
    expect(photoPositionClass(PORTRAIT, LISTING_CARD_ASPECT, { x: 0.5, y: 0.1 })).toBe('object-[50%_0%]');
  });

  it('πανοραμική, θέμα δεξιά ⇒ η κάρτα πάει δεξιά', () => {
    expect(photoPositionClass(PANORAMA, LISTING_CARD_ASPECT, { x: 0.95, y: 0.5 })).toBe('object-[100%_50%]');
  });

  it('χωρίς σημείο ⇒ `` (κέντρο: η συμπεριφορά πριν το ADR-880)', () => {
    expect(photoPositionClass(PORTRAIT, LISTING_CARD_ASPECT, null)).toBe('');
  });

  it.each([undefined, null, { x: 3, y: 0 }, 'x'])('έγγραφο με focalPoint=%p ⇒ κέντρο, ποτέ εξαίρεση', (value) => {
    expect(listingPhotoPositionClass(image(value), LISTING_CARD_ASPECT)).toBe('');
  });

  it('έγκυρο αποθηκευμένο σημείο ⇒ κλάση', () => {
    expect(listingPhotoPositionClass(image({ x: 0.5, y: 1 }), LISTING_CARD_ASPECT)).toBe('object-[50%_100%]');
  });
});

describe('καταναλωτές', () => {
  it.each(CONSUMERS)('%s ζητά τη συνάρτηση — κανένα χειρόγραφο object-[…]', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    expect(source).toContain('listingPhotoPositionClass');
    expect(source).not.toMatch(/object-\[\d/);
  });
});
