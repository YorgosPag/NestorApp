/**
 * @fileoverview **ΤΟ ΕΝΑ ΣΗΜΑ ΧΩΡΙΚΩΝ ΜΕΣΩΝ** — ο πίνακας αλήθειας της απόφασης (ADR-777 §8.88).
 * @related lib/listings/listing-spatial-media
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: ότι η κάρτα δεν διαφημίζει ποτέ κάτι που η σελίδα της αγγελίας **δεν θα δείξει** — μοντέλο που
 * μάντεψε μηχανή χωρίς έγκριση ανθρώπου (ADR-842 Α7) δεν ανάβει σήμα — και ότι «και τα δύο» είναι **τρίτη** τιμή, όχι
 * δύο σήματα.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { REAL_PLANE, publishedTerrainOf } from '@/lib/terrain/publication/__tests__/fixtures/terrain-3d-fixtures';
import type { ListingModel, ListingTourPresence, PublicListing } from '@/types/public-listing';

import {
  LISTING_SPATIAL_BADGES,
  hasListedTour,
  hasSpatialMedia,
  listingSpatialBadge,
  presentableModels,
  presentableTerrain,
} from '../listing-spatial-media';

const AT = '2026-10-13T10:00:00.000Z';
const FILE = { url: 'https://shelf.example/model.glb', altKey: 'listing-detail:model.alt.agency' };

const MEASURED: ListingModel = { provenance: 'measured', value: FILE, at: AT, sourceRef: 'bim' };
/** Συμπέρασμα μηχανής που **κανείς δεν ενέκρινε** — δεν είναι γεγονός (Α7). */
const UNCONFIRMED = { provenance: 'inferred', value: FILE, at: AT, confirmedAt: null } as unknown as ListingModel;

const PUBLIC_TOUR: ListingTourPresence = { visibility: 'public' };
const ON_REQUEST_TOUR: ListingTourPresence = { visibility: 'on-request' };

/** ADR-920 Β6.6β — μετρημένο ανάγλυφο, όπως το γράφει ο binder (Β3β), και ένα που μάντεψε μηχανή χωρίς έγκριση. */
const TERRAIN = publishedTerrainOf(REAL_PLANE());
const MEASURED_TERRAIN = { provenance: 'measured', value: TERRAIN, at: AT, sourceRef: 'property-terrain:measured' } as unknown as PublicListing['terrain'];
const UNCONFIRMED_TERRAIN = { provenance: 'inferred', value: TERRAIN, at: AT, confirmedAt: null } as unknown as PublicListing['terrain'];

describe('ο πίνακας αλήθειας — ΕΝΑ σήμα, ποτέ στοίβα', () => {
  it.each([
    ['τίποτα', [], null, null, null],
    ['μόνο μοντέλο', [MEASURED], null, null, 'model'],
    ['μόνο περιήγηση', [], PUBLIC_TOUR, null, 'tour'],
    ['και τα δύο ⇒ ΤΡΙΤΗ τιμή', [MEASURED], PUBLIC_TOUR, null, 'tour-and-model'],
    ['περιήγηση με αίτημα μετρά ως «έχει»', [], ON_REQUEST_TOUR, null, 'tour'],
    // ADR-920 Β6.6β — το ανάγλυφο είναι το ΤΕΛΕΥΤΑΙΟ: ό,τι άλλο υπάρχει εξηγεί ήδη το «3D», χωρίς στοίβα.
    ['μόνο ανάγλυφο', [], null, MEASURED_TERRAIN, 'terrain'],
    ['ανάγλυφο + περιήγηση ⇒ η περιήγηση', [], PUBLIC_TOUR, MEASURED_TERRAIN, 'tour'],
    ['ανάγλυφο + μοντέλο ⇒ το μοντέλο', [MEASURED], null, MEASURED_TERRAIN, 'model'],
    ['ανάγλυφο που μάντεψε μηχανή ⇒ τίποτα (Α7)', [], null, UNCONFIRMED_TERRAIN, null],
  ] as const)('%s', (_name, models, tour, terrain, expected) => {
    expect(listingSpatialBadge(listing({ models, tour, terrain }))).toBe(expected);
  });

  it('κάθε απάντηση ανήκει στο κλειστό σύνολο', () => {
    const answers = [
      listingSpatialBadge(listing({ models: [MEASURED], tour: null })),
      listingSpatialBadge(listing({ models: [], tour: PUBLIC_TOUR })),
      listingSpatialBadge(listing({ models: [MEASURED], tour: PUBLIC_TOUR })),
      listingSpatialBadge(listing({ models: [], tour: null, terrain: MEASURED_TERRAIN })),
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

// ADR-920 Β6.6 — ο κριτής της καρτέλας «Ανάγλυφο» και της σκηνής της: ΕΝΑΣ, ο ίδιος του Α7.
describe('🔴 ανάγλυφο — δείχνεται μόνο ό,τι δέχεται ο κριτής του Α7', () => {
  const subject = (terrain: PublicListing['terrain']) => ({ terrain });

  it('χωρίς έδαφος ⇒ null', () => {
    expect(presentableTerrain(subject(null))).toBeNull();
  });

  it('μετρημένο ⇒ η τιμή του (url + κάρτα)', () => {
    expect(presentableTerrain(subject(MEASURED_TERRAIN))).toBe(TERRAIN);
  });

  it('συμπέρασμα μηχανής χωρίς έγκριση ⇒ null', () => {
    expect(presentableTerrain(subject(UNCONFIRMED_TERRAIN))).toBeNull();
  });

  // Β6.6β: ο κριτής της καρτέλας ΕΙΝΑΙ και ο κριτής του σήματος — ό,τι διαφημίζει η κάρτα, το δείχνει η σελίδα.
  it('ανάβει το «3D» ΑΚΡΙΒΩΣ όταν η καρτέλα «Ανάγλυφο» υπάρχει', () => {
    for (const terrain of [null, MEASURED_TERRAIN, UNCONFIRMED_TERRAIN]) {
      const subjectListing = listing({ models: [], tour: null, terrain });
      expect(hasSpatialMedia(subjectListing)).toBe(presentableTerrain(subjectListing) !== null);
    }
  });
});
