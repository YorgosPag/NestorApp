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
 *   Κ6 · ο ΕΝΑΣ κριτής παρουσίας (§8.73): πέντε σκέλη· η διαμέριση είναι προβολή του.
 */

import { listingFeature } from '@/lib/listings/listings-geojson';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { OwnerProperty } from '@/types/owner-property';

import {
  OWNER_PORTFOLIO_MAP_MIN_MARKED,
  hasOwnerPortfolioMap,
  isOwnerListingPublic,
  ownerMapPresence,
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

  it('αγγελία πριν το πεδίο ⇒ «άγνωστο», ΟΧΙ «χωρίς θέση» — και ποτέ πινέζα από το `place` (§8.73)', () => {
    const noFootprint = validOwnerProperty({ id: 'ownp_legacy' });
    const beforeField = validOwnerProperty({ id: 'ownp_before', publication: { outcome: 'published', at: AT } });
    expect(noFootprint.publication).toBeUndefined();
    // ✅ Ο παρονομαστής: ο κάτοχος ΕΧΕΙ δηλωμένη θέση — ο δημόσιος χάρτης μάλλον δείχνει πινέζα.
    expect(beforeField.place).toMatchObject({ kind: 'declared' });

    const { mapped, unmapped } = partitionOwnerPortfolio([noFootprint, beforeField], AT);
    expect(mapped).toHaveLength(0);
    expect(unmapped.map((u) => u.reason)).toEqual(['unrecorded', 'unrecorded']);
  });
});

describe('Κ6 — ο ΕΝΑΣ κριτής παρουσίας (§8.73): «δημόσια» ≠ «στον χάρτη»', () => {
  it.each([
    ['σημάδι', published('ownp_m', CITY_MARK), 'marked', true],
    ['δηλωμένη απουσία σημαδιού', published('ownp_n', null), 'no-mark', true],
    ['πριν το πεδίο, με θέση', validOwnerProperty({ id: 'ownp_u', publication: { outcome: 'published', at: AT } }), 'unrecorded', true],
    ['πριν το πεδίο, θέση που αρνήθηκε ⇒ ΒΕΒΑΙΟ', validOwnerProperty({ id: 'ownp_d', place: { kind: 'declined' }, publication: { outcome: 'published', at: AT } }), 'no-mark', true],
    ['απέτυχε', validOwnerProperty({ id: 'ownp_f', publication: { outcome: 'failed', at: AT, mapMark: CITY_MARK } }), 'failed', false],
    ['αποσύρθηκε', validOwnerProperty({ id: 'ownp_w', offers: [offerOf('sell', 1, 'withdrawn')] }), 'withdrawn', false],
  ] as const)('%s ⇒ %s (δημόσια: %s)', (_label, property, kind, isPublic) => {
    const presence = ownerMapPresence(property, AT);
    expect(presence.kind).toBe(kind);
    expect(isOwnerListingPublic(presence)).toBe(isPublic);
  });

  it('η διαμέριση και ο κριτής δεν διαφωνούν ποτέ', () => {
    const all = [published('ownp_a', CITY_MARK), published('ownp_b', null), validOwnerProperty({ id: 'ownp_c' })];
    const { mapped, unmapped } = partitionOwnerPortfolio(all, AT);
    const fromPartition = [...mapped.map((m) => [m.property.id, 'marked']), ...unmapped.map((u) => [u.property.id, u.reason])];
    expect(fromPartition.sort()).toEqual(all.map((p) => [p.id, ownerMapPresence(p, AT).kind]).sort());
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
