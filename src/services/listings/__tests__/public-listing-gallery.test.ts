/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ MANIFEST** — πώς τα παράγωγα δένονται στην αγγελία.
 * @related ADR-841 §7 (Α2.2 · Α2.5 · Α2.6) · services/listings/public-listing-projection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Μπορεί η αγγελία να διαφημίσει εικόνα που δεν υπάρχει στον κάδο;**
 *
 * Η απάντηση είναι *«όχι, δομικά»*, και ο λόγος είναι **η σειρά**: η συλλογή χτίζεται
 * **ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ** του ραφιού, όχι από την επιθυμία. Ό,τι απορρίφθηκε στον καθαρισμό
 * απλώς δεν εμφανίζεται — κανείς δεν χρειάζεται να το θυμηθεί.
 *
 * 🔑 Και η **καθαρή** προβολή γεννά `gallery: []`, γιατί τα URL **δεν υπάρχουν** πριν
 * τρέξει η συμφιλίωση: το κλειδί είναι το sha256 των **καθαρισμένων** bytes.
 */

import {
  buildPublicListing,
  withPublishedGallery,
  type PlaceKnowledge,
  type ProjectableProperty,
  type ProjectedShelfImage,
} from '../public-listing-projection';
import { LISTING_GALLERY_ALT_KEY } from '@/lib/listings/listing-images';
import type { PublicListing } from '@/types/public-listing';

const AT = '2026-09-01T10:00:00.000Z';
const NO_PLACE: PlaceKnowledge = { candidates: [], ref: null };

const LISTED: ProjectableProperty = {
  id: 'ownp_77aa21bc',
  name: 'Διαμέρισμα 80 τ.μ.',
  type: 'apartment',
  commercialStatus: 'for-sale',
  areas: { gross: 80 },
  commercial: { askingPrice: 150000 },
};

function shelfImage(name: string, widths: readonly number[]): ProjectedShelfImage {
  const largest = widths[widths.length - 1];
  return {
    url: `https://storage.googleapis.com/bucket/listings/ownp_77aa21bc/${name}-${largest}.webp`,
    width: largest,
    height: Math.round(largest * 0.7),
    sources: widths.map((width) => ({
      url: `https://storage.googleapis.com/bucket/listings/ownp_77aa21bc/${name}-${width}.webp`,
      width,
    })),
  };
}

function built(): PublicListing {
  const listing = buildPublicListing(LISTED, NO_PLACE, AT);
  if (listing === null) throw new Error('το fixture όφειλε να δημοσιεύεται');
  return listing;
}

describe('Γ1 — Η ΚΑΘΑΡΗ ΠΡΟΒΟΛΗ ΔΕΝ ΜΑΝΤΕΥΕΙ URL', () => {
  it('η συλλογή γεννιέται ΚΕΝΗ — το ράφι δεν έχει ρωτηθεί ακόμη', () => {
    expect(built().gallery).toEqual([]);
  });

  it('🔴 και το `coverImage` ΜΕΝΕΙ `null` — ο κανόνας 31 δεν κάμφθηκε', () => {
    expect(built().coverImage).toBeNull();
    expect(withPublishedGallery(built(), [shelfImage('a', [640])]).coverImage).toBeNull();
  });
});

describe('Γ2 — ΤΟ ΔΕΣΙΜΟ: η αναφορά του ραφιού γίνεται περιεχόμενο αγγελίας', () => {
  it('κάθε εικόνα κρατά ΟΛΑ τα παράγωγά της, αυτούσια', () => {
    const listing = withPublishedGallery(built(), [shelfImage('a', [640, 1280, 2560])]);

    expect(listing.gallery).toHaveLength(1);
    expect(listing.gallery[0].sources.map((source) => source.width)).toEqual([640, 1280, 2560]);
    expect(listing.gallery[0].url).toContain('a-2560.webp');
    expect(listing.gallery[0].width).toBe(2560);
  });

  it('🔴 Η ΣΕΙΡΑ ΤΑΞΙΔΕΥΕΙ ΑΥΤΟΥΣΙΑ — καμία ταξινόμηση πουθενά', () => {
    // 🔴 Ο κάτοχος έβαλε τη **μεγάλη πρώτη** και τη **μικρή δεύτερη**. Κάθε
    //    «τακτοποίηση» — κατά πλάτος, κατά όνομα, κατά οτιδήποτε — αντιστρέφει την
    //    επιλογή του **σιωπηλά** (ADR-841 §7 Α2.1). Το fixture είναι φτιαγμένο ώστε
    //    ταξινόμηση **και κατά πλάτος** (2560 > 640) **και κατά όνομα** (m-e < m-i)
    //    να δίνει **άλλη** σειρά από αυτήν που δηλώθηκε.
    const listing = withPublishedGallery(built(), [
      shelfImage('megali', [640, 2560]),
      shelfImage('mikri', [640]),
    ]);

    expect(listing.gallery.map((image) => image.url)).toEqual([
      expect.stringContaining('megali-2560.webp'),
      expect.stringContaining('mikri-640.webp'),
    ]);
    expect(listing.gallery.map((image) => image.width)).toEqual([2560, 640]);
  });

  it('κενή αναφορά ⇒ κενή συλλογή (απόσυρση ή «δεν διάλεξε τίποτα»)', () => {
    expect(withPublishedGallery(built(), []).gallery).toEqual([]);
  });

  it('δεν αγγίζει κανένα άλλο πεδίο του κλειστού σχήματος', () => {
    const before = built();
    const after = withPublishedGallery(before, [shelfImage('a', [640])]);

    expect({ ...after, gallery: [] }).toEqual({ ...before, gallery: [] });
  });
});

describe('Γ3 — ΤΟ `altKey` ΜΠΑΙΝΕΙ ΕΔΩ, ΜΙΑ ΦΟΡΑ', () => {
  it('κάθε εικόνα φέρει το ΙΔΙΟ κλειδί i18n — ποτέ ωμό κείμενο (N.11)', () => {
    const listing = withPublishedGallery(built(), [
      shelfImage('a', [640]),
      shelfImage('b', [640]),
    ]);

    for (const image of listing.gallery) {
      expect(image.altKey).toBe(LISTING_GALLERY_ALT_KEY);
    }
  });
});
