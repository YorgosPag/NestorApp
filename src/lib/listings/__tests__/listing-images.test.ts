/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΣΥΝΟΡΟΥ ΤΟΥ ΚΑΝΟΝΑ 31** + το `srcset`.
 * @related ADR-841 §7 (Α2.2 · Α2.5 · Α2.6) · ADR-777 §7 Α19 · lib/listings/listing-images
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Όταν η Φ4 παραγάγει τον πρώτο καρέ, θα τον προτιμήσει η οθόνη — ή θα συνεχίσει
 *   να δείχνει τη φωτογραφία του κατόχου;**
 *
 * Είναι εκτελέσιμη μορφή του κανόνα 31: το `coverImage` είναι *«τι ΕΙΝΑΙ το κτίριο»* και
 * **υπερισχύει**· η συλλογή είναι *«τι ΔΕΙΧΝΕΙ ο κάτοχος»* και **αναπληρώνει**. Αν
 * κάποιος γράψει `gallery[0] ?? coverImage`, αυτή η σουίτα κοκκινίζει.
 */

import {
  LISTING_GALLERY_ALT_KEY,
  listingImageSrcSet,
  listingLeadImage,
} from '@/lib/listings/listing-images';
import type { ListingImage, PublicListing } from '@/types/public-listing';

function image(url: string, widths: readonly number[] = [1280]): ListingImage {
  const largest = widths[widths.length - 1];
  return {
    url,
    width: largest,
    height: Math.round(largest * 0.75),
    altKey: LISTING_GALLERY_ALT_KEY,
    sources: widths.map((width) => ({ url: `${url}?w=${width}`, width })),
  };
}

function listing(over: Partial<PublicListing>): PublicListing {
  return { coverImage: null, gallery: [], ...over } as PublicListing;
}

describe('Ι1 — Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΗΣ ΚΟΡΥΦΑΙΑΣ ΕΙΚΟΝΑΣ', () => {
  it('χωρίς τίποτα ⇒ `null`, και η οθόνη οφείλει να το πει', () => {
    expect(listingLeadImage(listing({}))).toBeNull();
  });

  it('χωρίς παραγόμενο καρέ ⇒ η ΠΡΩΤΗ της συλλογής', () => {
    const gallery = [image('a'), image('b')];
    expect(listingLeadImage(listing({ gallery }))).toBe(gallery[0]);
  });

  it('🔴 ΜΕ παραγόμενο καρέ ⇒ ΕΚΕΙΝΟΣ, ποτέ η φωτογραφία του κατόχου (κανόνας 31)', () => {
    const cover = image('model');
    expect(listingLeadImage(listing({ coverImage: cover, gallery: [image('owner')] }))).toBe(cover);
  });
});

describe('Ι2 — ΤΟ `srcset`: μόνο ό,τι ΥΠΑΡΧΕΙ, και μόνο όταν υπάρχει επιλογή', () => {
  it('ένα μόνο παράγωγο ⇒ ΚΑΝΕΝΑ `srcset` (τίποτα να διαλέξει ο περιηγητής)', () => {
    expect(listingImageSrcSet(image('a', [800]))).toBeUndefined();
  });

  it('πολλά παράγωγα ⇒ `url w` ανά γραμμή, στη σειρά του πίνακα', () => {
    expect(listingImageSrcSet(image('a', [640, 1280, 2560]))).toBe(
      'a?w=640 640w, a?w=1280 1280w, a?w=2560 2560w',
    );
  });

  it('🔑 δεν κατασκευάζει URL — κάθε γραμμή είναι αυτούσια από το σχήμα', () => {
    const only = image('a', [640, 1280]);
    const srcset = listingImageSrcSet(only) ?? '';

    for (const source of only.sources) {
      expect(srcset).toContain(source.url);
    }
    // Η Zillow βάζει τη διάσταση στο μονοπάτι· εμείς ποτέ δεν φτιάχνουμε URL μόνοι μας.
    expect(srcset.split(', ')).toHaveLength(only.sources.length);
  });
});

describe('Ι3 — ΤΟ `alt` ΔΕΝ ΕΙΝΑΙ ΚΕΝΟ, ΚΑΙ ΕΙΝΑΙ ΚΛΕΙΔΙ', () => {
  it('το κλειδί έχει namespace και δεν είναι κενή συμβολοσειρά', () => {
    // 🔴 `alt=""` θα δήλωνε **διακοσμητική** εικόνα — για φωτογραφία ακινήτου αυτό
    //    κρύβει γεγονός (WCAG 1.1.1, ADR-841 §7 Α2.5).
    expect(LISTING_GALLERY_ALT_KEY).not.toBe('');
    expect(LISTING_GALLERY_ALT_KEY).toContain(':');
  });
});
