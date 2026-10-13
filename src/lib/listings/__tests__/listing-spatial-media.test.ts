/**
 * @fileoverview **ΤΟ ΕΝΑ ΣΗΜΑ ΧΩΡΙΚΩΝ ΜΕΣΩΝ** — ο πίνακας αλήθειας της απόφασης (ADR-777 §8.88).
 * @related lib/listings/listing-spatial-media
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: ότι η κάρτα δεν διαφημίζει ποτέ κάτι που η σελίδα της αγγελίας **δεν θα δείξει** — μοντέλο που
 * μάντεψε μηχανή χωρίς έγκριση ανθρώπου (ADR-842 Α7) δεν ανάβει σήμα — και ότι «και τα δύο» είναι **τρίτη** τιμή, όχι
 * δύο σήματα.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { ListingModel, ListingTourPresence } from '@/types/public-listing';

import {
  LISTING_SPATIAL_BADGES,
  hasListedTour,
  hasSpatialMedia,
  listingSpatialBadge,
  presentableModels,
} from '../listing-spatial-media';

const AT = '2026-10-13T10:00:00.000Z';
const FILE = { url: 'https://shelf.example/model.glb', altKey: 'listing-detail:model.alt.agency' };

const MEASURED: ListingModel = { provenance: 'measured', value: FILE, at: AT, sourceRef: 'bim' };
/** Συμπέρασμα μηχανής που **κανείς δεν ενέκρινε** — δεν είναι γεγονός (Α7). */
const UNCONFIRMED = { provenance: 'inferred', value: FILE, at: AT, confirmedAt: null } as unknown as ListingModel;

const PUBLIC_TOUR: ListingTourPresence = { visibility: 'public' };
const ON_REQUEST_TOUR: ListingTourPresence = { visibility: 'on-request' };

describe('ο πίνακας αλήθειας — ΕΝΑ σήμα, ποτέ στοίβα', () => {
  it.each([
    ['τίποτα', [], null, null],
    ['μόνο μοντέλο', [MEASURED], null, 'model'],
    ['μόνο περιήγηση', [], PUBLIC_TOUR, 'tour'],
    ['και τα δύο ⇒ ΤΡΙΤΗ τιμή', [MEASURED], PUBLIC_TOUR, 'tour-and-model'],
    ['περιήγηση με αίτημα μετρά ως «έχει»', [], ON_REQUEST_TOUR, 'tour'],
  ] as const)('%s', (_name, models, tour, expected) => {
    expect(listingSpatialBadge(listing({ models, tour }))).toBe(expected);
  });

  it('κάθε απάντηση ανήκει στο κλειστό σύνολο', () => {
    const answers = [
      listingSpatialBadge(listing({ models: [MEASURED], tour: null })),
      listingSpatialBadge(listing({ models: [], tour: PUBLIC_TOUR })),
      listingSpatialBadge(listing({ models: [MEASURED], tour: PUBLIC_TOUR })),
    ];
    expect([...answers].sort()).toEqual([...LISTING_SPATIAL_BADGES].sort());
  });
});

describe('🔴 μοντέλο που δεν δείχνεται ΔΕΝ διαφημίζεται (ADR-842 Α7)', () => {
  it('μη εγκεκριμένο συμπέρασμα μηχανής δεν ανάβει σήμα', () => {
    expect(presentableModels(listing({ models: [UNCONFIRMED] }))).toEqual([]);
    expect(listingSpatialBadge(listing({ models: [UNCONFIRMED], tour: null }))).toBeNull();
  });

  it('…και δίπλα σε περιήγηση το σήμα λέει ΜΟΝΟ περιήγηση', () => {
    expect(listingSpatialBadge(listing({ models: [UNCONFIRMED], tour: PUBLIC_TOUR }))).toBe('tour');
  });

  it('τα μοντέλα που δείχνονται κρατούν τη σειρά τους', () => {
    const second: ListingModel = { ...MEASURED, value: { ...FILE, url: 'https://shelf.example/b.glb' } };
    expect(presentableModels(listing({ models: [MEASURED, UNCONFIRMED, second] }))).toEqual([MEASURED, second]);
  });
});

describe('περιήγηση — διαβάζεται από την προβολή', () => {
  it('`null` = καμία περιήγηση που φαίνεται', () => {
    expect(hasListedTour(listing({ tour: null }))).toBe(false);
    expect(hasListedTour(listing({ tour: PUBLIC_TOUR }))).toBe(true);
  });
});

describe('🔴 το φίλτρο «Μόνο με 3D» περνά ΑΚΡΙΒΩΣ ό,τι φορά σήμα (ADR-777 §8.89)', () => {
  // Zillow, μετρημένο: με το φίλτρο `3d` ενεργό, 6/9 κάρτες έδειχναν άλλο σήμα. Εδώ οι δύο ερωτήσεις είναι ΜΙΑ.
  it.each([
    ['τίποτα', [], null],
    ['μόνο μοντέλο', [MEASURED], null],
    ['μόνο περιήγηση', [], PUBLIC_TOUR],
    ['περιήγηση με αίτημα', [], ON_REQUEST_TOUR],
    ['και τα δύο', [MEASURED], PUBLIC_TOUR],
    ['μοντέλο που δεν δείχνεται', [UNCONFIRMED], null],
    ['μοντέλο που δεν δείχνεται + περιήγηση', [UNCONFIRMED], PUBLIC_TOUR],
  ] as const)('%s', (_name, models, tour) => {
    const subject = listing({ models, tour });
    expect(hasSpatialMedia(subject)).toBe(listingSpatialBadge(subject) !== null);
  });

  it('μη εγκεκριμένο μοντέλο ΔΕΝ περνά το φίλτρο — δεν θα το έβλεπε κανείς', () => {
    expect(hasSpatialMedia(listing({ models: [UNCONFIRMED], tour: null }))).toBe(false);
  });
});
