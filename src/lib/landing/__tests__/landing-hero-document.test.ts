/**
 * ⚓ ADR-881 §4.2 — **ο ανεκτικός αναγνώστης των εγγράφων του ήρωα**.
 *
 * Τι κλειδώνεται: (Α) μια χαλασμένη έκδοση/σελίδα **δεν** ρίχνει τις άλλες · (Β) δείκτης προς
 * ξένη ταυτότητα = κενός δείκτης · (Γ) το δίχτυ ασφαλείας καλύπτει **κάθε** σελίδα χωρίς έκδοση.
 */

import {
  EMPTY_LANDING_HERO_POINTER,
  readLandingHeroPointers,
  readLandingHeroRevision,
  resolveLandingHeroSet,
  revisionToHeroImage,
} from '../landing-hero-document';
import type { LandingHeroImage, LandingHeroSet } from '../landing-hero-vocabulary';

const ID = 'lhrev_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const URL_BASE = 'https://storage.googleapis.com/public-shelf/landing-heroes';

function asset(tag: string) {
  return {
    src: `${URL_BASE}/${ID}/${tag}-2560.webp`,
    width: 2560,
    height: 1280,
    sources: [
      { url: `${URL_BASE}/${ID}/${tag}-640.webp`, width: 640 },
      { url: `${URL_BASE}/${ID}/${tag}-2560.webp`, width: 2560 },
    ],
  };
}

const VALID_REVISION = {
  page: 'stay',
  day: asset('day'),
  dusk: asset('dusk'),
  focalPoint: { x: 0.8, y: 0.6 },
  focalOrigin: 'declared',
  sources: { day: 'companies/c1/x/day.jpg', dusk: 'companies/c1/x/dusk.jpg' },
  derivedFrom: null,
  createdAt: '2026-09-24T10:00:00.000Z',
  createdBy: 'uid-1',
};

describe('Α — μία έκδοση', () => {
  it('διαβάζει έγκυρη έκδοση αυτούσια', () => {
    const revision = readLandingHeroRevision(ID, VALID_REVISION);
    expect(revision?.id).toBe(ID);
    expect(revision?.focalPoint).toEqual({ x: 0.8, y: 0.6 });
  });

  it('απορρίπτει ταυτότητα που δεν είναι `lhrev_*` — ακόμη κι αν το σώμα είναι έγκυρο', () => {
    expect(readLandingHeroRevision('prop_1', VALID_REVISION)).toBeNull();
    expect(readLandingHeroRevision('lhrev_a/../b', VALID_REVISION)).toBeNull();
  });

  it('απορρίπτει εκδοχή χωρίς παράγωγα — δεν είναι έκδοση ραφιού', () => {
    expect(readLandingHeroRevision(ID, { ...VALID_REVISION, day: { ...asset('day'), sources: [] } })).toBeNull();
  });

  it('απορρίπτει σημείο εκτός [0,1]', () => {
    expect(readLandingHeroRevision(ID, { ...VALID_REVISION, focalPoint: { x: 1.2, y: 0.5 } })).toBeNull();
  });

  it('χωρίς σούρουπο ⇒ η εικόνα ήρωα ΔΕΝ έχει `dusk` (η μέρα και στα δύο θέματα)', () => {
    const revision = readLandingHeroRevision(ID, { ...VALID_REVISION, dusk: null });
    if (revision === null) throw new Error('έγκυρη έκδοση απορρίφθηκε');
    expect(revisionToHeroImage(revision)).not.toHaveProperty('dusk');
  });
});

describe('Β — ο δείκτης', () => {
  it('απόν έγγραφο ⇒ κενός δείκτης σε κάθε σελίδα', () => {
    const pointers = readLandingHeroPointers(undefined);
    expect(pointers.home).toEqual(EMPTY_LANDING_HERO_POINTER);
    expect(pointers.pros).toEqual(EMPTY_LANDING_HERO_POINTER);
    expect(pointers.stay).toEqual(EMPTY_LANDING_HERO_POINTER);
  });

  it('χαλασμένη σελίδα ΔΕΝ τιμωρεί τις άλλες', () => {
    const pointers = readLandingHeroPointers({
      pages: {
        home: { publishedRevisionId: ID, publishedAt: '2026-09-24T10:00:00.000Z', publishedBy: 'uid-1' },
        pros: 'σκουπίδι',
      },
    });
    expect(pointers.home.publishedRevisionId).toBe(ID);
    expect(pointers.pros).toEqual(EMPTY_LANDING_HERO_POINTER);
  });

  it('δείκτης προς ξένη ταυτότητα ⇒ κενός — ποτέ δεν ακολουθείται', () => {
    const pointers = readLandingHeroPointers({
      pages: { home: { publishedRevisionId: 'prop_1', publishedAt: null, publishedBy: null } },
    });
    expect(pointers.home).toEqual(EMPTY_LANDING_HERO_POINTER);
  });
});

describe('Γ — το δίχτυ ασφαλείας', () => {
  const builtin: LandingHeroSet = {
    home: { day: { src: '/h.jpg', width: 1774, height: 887 }, focalPoint: { x: 1, y: 0.5 } },
    pros: { day: { src: '/p.jpg', width: 1774, height: 887 }, focalPoint: { x: 1, y: 0.85 } },
    stay: { day: { src: '/s.jpg', width: 1774, height: 887 }, focalPoint: { x: 1, y: 0.5 } },
  };

  it('δημοσιευμένη σελίδα κερδίζει, οι υπόλοιπες παίρνουν την ενσωματωμένη', () => {
    const published: LandingHeroImage = { day: asset('day'), focalPoint: { x: 0.7, y: 0.4 } };
    const set = resolveLandingHeroSet({ stay: published }, builtin);
    expect(set.stay).toBe(published);
    expect(set.home).toBe(builtin.home);
    expect(set.pros).toBe(builtin.pros);
  });

  it('τίποτα δημοσιευμένο ⇒ ακριβώς ο ενσωματωμένος πίνακας', () => {
    expect(resolveLandingHeroSet({}, builtin)).toEqual(builtin);
  });
});
