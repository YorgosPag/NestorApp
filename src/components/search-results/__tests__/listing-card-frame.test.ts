/**
 * @jest-environment node
 *
 * @fileoverview 🖼️ **ΑΓΚΥΡΑ — ένας αριθμός για το πλαίσιο της κάρτας** (ADR-777 §8.80).
 *
 * Τρεις γλώσσες λένε τον ίδιο λόγο: η κλάση Tailwind, το `sizes` και το πλέγμα. Αν κάποια
 * αποκλίνει — ή αν ξαναγραφτεί `aspect-[4/3]` με το χέρι σε καταναλωτή — κοκκινίζει εδώ.
 */
import { MOBILE_BREAKPOINT } from '@/constants/layout';
import { readRepoCode, stripComments } from '@/test-utils/read-source';

import {
  LISTING_CARD_ASPECT,
  LISTING_CARD_ASPECT_CLASS,
  LISTING_CARD_GRID_CLASS,
  LISTING_CARD_MIN_REM,
  RESULTS_CARD_IMAGE_REM,
  RESULTS_CARD_IMAGE_SIZES,
} from '../listing-card-frame';

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
    // Το πάτωμα ΔΕΝ νικά ποτέ τον περιέκτη (CHECK 3.94 · ADR-797 §Φ.Ρ.3): σκέτο `17rem` έκοβε 16 px στα 320.
    expect(LISTING_CARD_GRID_CLASS).toContain(`minmax(min(${LISTING_CARD_MIN_REM}rem,100%),1fr)`);
    expect(LISTING_CARD_GRID_CLASS).toContain('auto-fill');
  });

  it('το `sizes` των αποτελεσμάτων δηλώνει πλάτος ΜΕΣΑ στο εύρος ενός κελιού', () => {
    expect(RESULTS_CARD_IMAGE_REM).toBeGreaterThanOrEqual(LISTING_CARD_MIN_REM);
    expect(RESULTS_CARD_IMAGE_REM).toBeLessThanOrEqual(LISTING_CARD_MIN_REM * 2);
    expect(RESULTS_CARD_IMAGE_SIZES).toBe(`(min-width: ${MOBILE_BREAKPOINT}px) ${RESULTS_CARD_IMAGE_REM}rem, 100vw`);
  });

  /**
   * 🔴 **Ο ΚΩΔΙΚΑΣ ρωτιέται, όχι η αφήγησή του (2026-10-13).** Ως τότε η άγκυρα έψαχνε σε όλο το κείμενο· το
   * `73c97b13` έγραψε στο `OwnerPropertyCardCover` σχόλιο που **τεκμηριώνει** το σφάλμα («το `aspect-[3/2]`
   * αγνοούνταν») και η άγκυρα κοκκίνισε πάνω στην εξήγηση της θεραπείας — σπρώχνοντας τον επόμενο να σβήσει τη γνώση.
   * `readRepoCode` = το ένα SSoT ανάγνωσης χωρίς σχόλια (`test-utils/read-source`).
   */
  const HAND_WRITTEN_ASPECT = /aspect-\[\d+\/\d+\]/;

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το κόψιμο σχολίων αφήνει τον ΚΩΔΙΚΑ ορατό — χειρόγραφη κλάση πιάνεται, αναφορά σε σχόλιο όχι', () => {
    expect(stripComments('<figure className="aspect-[3/2]" />')).toMatch(HAND_WRITTEN_ASPECT);
    expect(stripComments('/** το `aspect-[3/2]` αγνοούνταν */\n// aspect-[4/3]\nconst a = 1;')).not.toMatch(HAND_WRITTEN_ASPECT);
  });

  it.each(CONSUMERS)('%s ζητά τη σταθερά — κανένα χειρόγραφο aspect-[…]', (file) => {
    const code = readRepoCode(file);
    expect(code).toContain('LISTING_CARD_ASPECT_CLASS');
    expect(code).not.toMatch(HAND_WRITTEN_ASPECT);
  });
});
