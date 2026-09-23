/**
 * ADR-777 §8.71 — ο χάρτης χαρτοφυλακίου του κατόχου: **ό,τι βλέπει ο κόσμος**, με τον ΕΝΑ ζωγράφο.
 *
 * Οι άγκυρες ρωτούν:
 *   Κ1 · η πηγή θέσης είναι το ΣΗΜΑΔΙ, ποτέ το ιδιωτικό `place` (ακριβής πινέζα κατόχου + σημάδι
 *        «πόλη» ⇒ ο χάρτης ζωγραφίζει πόλη, στο σημείο του σημαδιού).
 *   Κ2 · το feature είναι ΤΑΥΤΟΣΗΜΟ με του δημόσιου χάρτη (`listingFeature`).
 *   Κ3 · ο κριτής κρίνει ΠΡΩΤΟΣ: μπαγιάτικο σημάδι σε αποσυρμένη/αποτυχημένη αγγελία δεν ζωγραφίζεται.
 *   Κ4 · το όριο του διακόπτη.
 *   Κ5 · η προβολή στο URL: άγνωστο ⇒ λίστα, η λίστα δεν γράφεται.
 */

import { listingFeature } from '@/lib/listings/listings-geojson';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { OwnerProperty } from '@/types/owner-property';

import {
  OWNER_PORTFOLIO_MAP_MIN_MARKED,
  hasOwnerPortfolioMap,
  ownerPortfolioGeoJson,
  parseOwnerPortfolioView,
  partitionOwnerPortfolio,
  writeOwnerPortfolioView,
} from '../owner-portfolio-map';
import { offerOf, validOwnerProperty } from './owner-property-fixtures';

const AT = '2026-08-11T12:00:00.000Z';

/** Το σημάδι μιας «Θεσσαλονίκης»: σκιασμένη πόλη, σε άλλο σημείο από την ιδιωτική πινέζα. */
const CITY_MARK: ListingMapMark = { shape: 'shaded-city', point: { lat: 40.64, lng: 22.94 } };

function published(id: string, mark: unknown): OwnerProperty {
  return validOwnerProperty({ id, publication: { outcome: 'published', at: AT, mapMark: mark as ListingMapMark } });
}

describe('Κ1 — σημάδι, ποτέ θέση', () => {
  it('ακριβής ιδιωτική πινέζα + σημάδι «πόλη» ⇒ ο χάρτης ζωγραφίζει ΠΟΛΗ στο σημείο του σημαδιού', () => {
    const property = published('ownp_city', CITY_MARK);
    // ✅ Ο παρονομαστής μέσα στη δοκιμή: ο κάτοχος ξέρει ΑΚΡΙΒΗ θέση.
    expect(property.place).toMatchObject({ kind: 'declared', accuracy: 'exact' });

    const { mapped } = partitionOwnerPortfolio([property], AT);
    const [feature] = ownerPortfolioGeoJson(mapped).features;

    expect(feature.properties.shape).toBe('shaded-city');
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [22.94, 40.64] });
  });
});

describe('Κ2 — ένας ζωγράφος', () => {
  it('το feature είναι ταυτόσημο με του δημόσιου χάρτη', () => {
    const property = published('ownp_same', CITY_MARK);
    const { mapped } = partitionOwnerPortfolio([property], AT);

    expect(ownerPortfolioGeoJson(mapped).features[0]).toEqual(
      listingFeature(property.id, property.title, CITY_MARK),
    );
  });
});

describe('Κ3 — ο κριτής κρίνει πρώτος, το σημάδι μετά', () => {
  it('διαμερίζει με αιτία και κρατά τη σειρά', () => {
    const withdrawn = validOwnerProperty({
      id: 'ownp_withdrawn',
      offers: [offerOf('sell', 210_000, 'withdrawn')],
      publication: { outcome: 'published', at: AT, mapMark: CITY_MARK },
    });
    const failed = validOwnerProperty({
      id: 'ownp_failed',
      publication: { outcome: 'failed', at: AT, mapMark: CITY_MARK },
    });
    const noMark = published('ownp_nomark', null);
    const garbage = published('ownp_garbage', { shape: 'pin' });
    const ok = published('ownp_ok', CITY_MARK);

    const { mapped, unmapped } = partitionOwnerPortfolio([withdrawn, failed, noMark, garbage, ok], AT);

    expect(mapped.map((m) => m.property.id)).toEqual(['ownp_ok']);
    expect(unmapped.map((u) => [u.property.id, u.reason])).toEqual([
      ['ownp_withdrawn', 'withdrawn'],
      ['ownp_failed', 'failed'],
      ['ownp_nomark', 'no-mark'],
      ['ownp_garbage', 'no-mark'],
    ]);
  });

  it('αγγελία πριν το πεδίο (χωρίς αποτύπωμα) ⇒ «χωρίς θέση», ποτέ πινέζα από το `place`', () => {
    const legacy = validOwnerProperty({ id: 'ownp_legacy' });
    expect(legacy.publication).toBeUndefined();

    const { mapped, unmapped } = partitionOwnerPortfolio([legacy], AT);
    expect(mapped).toHaveLength(0);
    expect(unmapped[0]?.reason).toBe('no-mark');
  });
});

describe('Κ4 — το όριο του διακόπτη', () => {
  it(`χάρτης μόνο από ${OWNER_PORTFOLIO_MAP_MIN_MARKED} σημάδια και πάνω`, () => {
    const below = Array.from({ length: OWNER_PORTFOLIO_MAP_MIN_MARKED - 1 }, (_, i) => published(`ownp_${i}`, CITY_MARK));
    const at = [...below, published('ownp_last', CITY_MARK)];

    expect(hasOwnerPortfolioMap(partitionOwnerPortfolio(below, AT))).toBe(false);
    expect(hasOwnerPortfolioMap(partitionOwnerPortfolio(at, AT))).toBe(true);
  });

  it('τα ακίνητα εκτός χάρτη δεν μετράνε στο όριο', () => {
    const one = published('ownp_one', CITY_MARK);
    const many = Array.from({ length: 5 }, (_, i) => published(`ownp_none_${i}`, null));
    expect(hasOwnerPortfolioMap(partitionOwnerPortfolio([one, ...many], AT))).toBe(false);
  });
});

describe('Κ5 — η προβολή στο URL', () => {
  it.each([
    ['', 'list'],
    ['view=map', 'map'],
    ['view=list', 'list'],
    ['view=satellite', 'list'],
  ])('«%s» ⇒ %s', (query, expected) => {
    expect(parseOwnerPortfolioView(new URLSearchParams(query))).toBe(expected);
  });

  it('η γραφή κρατά τα άσχετα κλειδιά· η λίστα σβήνει το κλειδί', () => {
    const params = new URLSearchParams('tab=x');
    writeOwnerPortfolioView('map', params);
    expect(params.toString()).toBe('tab=x&view=map');
    writeOwnerPortfolioView('list', params);
    expect(params.toString()).toBe('tab=x');
  });
});
