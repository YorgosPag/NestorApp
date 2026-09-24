/**
 * @jest-environment node
 *
 * @fileoverview 🖼️ **ΑΓΚΥΡΑ — ένας αριθμός για το πλαίσιο της κάρτας** (ADR-777 §8.80).
 *
 * Τρεις γλώσσες λένε τον ίδιο λόγο: η κλάση Tailwind, το `sizes` και το πλέγμα. Αν κάποια
 * αποκλίνει — ή αν ξαναγραφτεί `aspect-[4/3]` με το χέρι σε καταναλωτή — κοκκινίζει εδώ.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { MOBILE_BREAKPOINT } from '@/constants/layout';

import {
  LISTING_CARD_ASPECT,
  LISTING_CARD_ASPECT_CLASS,
  LISTING_CARD_GRID_CLASS,
  LISTING_CARD_MIN_REM,
  RESULTS_CARD_IMAGE_REM,
  RESULTS_CARD_IMAGE_SIZES,
} from '../listing-card-frame';

const ROOT = join(__dirname, '..', '..', '..', '..');

/** Όσοι ζωγραφίζουν φωτογραφία σε πλαίσιο κάρτας — οφείλουν να ζητούν τη σταθερά. */
const CONSUMERS = [
  'src/components/search-results/ListingCardGallery.tsx',
  'src/components/owner-property/OwnerPropertyCardCover.tsx',
  'src/components/owner-property/OwnerPropertyMapPopup.tsx',
];

describe('listing-card-frame', () => {
  it('η κλάση λέει τον ίδιο λόγο με τον αριθμό', () => {
    expect(LISTING_CARD_ASPECT_CLASS).toBe(`aspect-[${LISTING_CARD_ASPECT.w}/${LISTING_CARD_ASPECT.h}]`);
  });

  it('το πλέγμα χρησιμοποιεί το δηλωμένο ελάχιστο πλάτος κελιού', () => {
    expect(LISTING_CARD_GRID_CLASS).toContain(`minmax(${LISTING_CARD_MIN_REM}rem,1fr)`);
    expect(LISTING_CARD_GRID_CLASS).toContain('auto-fill');
  });

  it('το `sizes` των αποτελεσμάτων δηλώνει πλάτος ΜΕΣΑ στο εύρος ενός κελιού', () => {
    expect(RESULTS_CARD_IMAGE_REM).toBeGreaterThanOrEqual(LISTING_CARD_MIN_REM);
    expect(RESULTS_CARD_IMAGE_REM).toBeLessThanOrEqual(LISTING_CARD_MIN_REM * 2);
    expect(RESULTS_CARD_IMAGE_SIZES).toBe(`(min-width: ${MOBILE_BREAKPOINT}px) ${RESULTS_CARD_IMAGE_REM}rem, 100vw`);
  });

  it.each(CONSUMERS)('%s ζητά τη σταθερά — κανένα χειρόγραφο aspect-[…]', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    expect(source).toContain('LISTING_CARD_ASPECT_CLASS');
    expect(source).not.toMatch(/aspect-\[\d+\/\d+\]/);
  });
});
