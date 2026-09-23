/**
 * @jest-environment node
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — το σημάδι είναι ό,τι βλέπει ο κόσμος, ΠΟΤΕ ακριβέστερο** (ADR-777 §8.70 Φ2).
 * @related lib/listings/listing-map-mark.ts · lib/listings/listings-geojson.ts
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το σημάδι κουβαλά `accuracy` / `provenance` / `osmRef` | `toStrictEqual` ⇒ 🔴 |
 * | «Θεσσαλονίκη» (`center`) γίνεται πινέζα | `shape` ≠ `shaded-city` ⇒ 🔴 |
 * | ο αναγνώστης δέχεται μισό περίγραμμα | όχι `null` ⇒ 🔴 |
 * | ο δημόσιος χάρτης και το στιγμιότυπο χτίζουν διαφορετικό feature | άνισα ⇒ 🔴 |
 */

import type { ListingPosition } from '@/types/public-listing';

import { listingMapMark, parseListingMapMark } from '../listing-map-mark';
import { listingFeature, listingsToGeoJson } from '../listings-geojson';

const AT = '2026-09-23T10:00:00.000Z';
const POINT = { lat: 40.63, lng: 22.95 };

function geocoded(accuracy: 'exact' | 'interpolated' | 'approximate' | 'center'): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point: POINT, locatedAt: AT, accuracy };
}

describe('γραφέας — θέση → σημάδι', () => {
  it.each([
    ['exact', 'pin'],
    ['interpolated', 'pin-with-ring'],
    ['approximate', 'shaded-circle'],
    ['center', 'shaded-city'],
  ] as const)('geocoded %s ⇒ %s, και ΤΙΠΟΤΑ άλλο από τη θέση', (accuracy, shape) => {
    expect(listingMapMark(geocoded(accuracy))).toStrictEqual({ shape, point: POINT });
  });

  it('🔴 osm ⇒ πινέζα ΧΩΡΙΣ `osmRef`', () => {
    const position: ListingPosition = {
      kind: 'known', provenance: 'osm', point: POINT, locatedAt: AT,
      osmRef: { elementType: 'way', elementId: '1', seenAt: AT },
    };
    expect(listingMapMark(position)).toStrictEqual({ shape: 'pin', point: POINT });
  });

  it('drawn με περίγραμμα ⇒ `outline` με το αποθηκευμένο σχήμα', () => {
    const outline = [POINT, { lat: 40.631, lng: 22.95 }, { lat: 40.631, lng: 22.951 }];
    const position: ListingPosition = { kind: 'known', provenance: 'drawn', point: POINT, locatedAt: AT, outline };
    expect(listingMapMark(position)).toStrictEqual({ shape: 'outline', point: POINT, outline });
  });

  it.each([
    [{ kind: 'unknown', reason: 'never-asked' }],
    [{ kind: 'unknown', reason: 'owner-declined' }],
  ] as const)('άγνωστη θέση ⇒ `null`', (position) => {
    expect(listingMapMark(position)).toBeNull();
  });
});

describe('αναγνώστης — δίσκος → σημάδι', () => {
  it('στρογγυλή διαδρομή γραφέα → αναγνώστη', () => {
    const mark = listingMapMark(geocoded('approximate'));
    expect(parseListingMapMark(JSON.parse(JSON.stringify(mark)))).toStrictEqual(mark);
  });

  it.each([
    ['null', null],
    ['άγνωστο σχήμα', { shape: 'star', point: POINT }],
    ['`none`', { shape: 'none', point: POINT }],
    ['σημείο εκτός κόσμου', { shape: 'pin', point: { lat: 95, lng: 0 } }],
    ['σημείο NaN', { shape: 'pin', point: { lat: Number.NaN, lng: 0 } }],
    ['περίγραμμα χωρίς κορυφές', { shape: 'outline', point: POINT }],
    ['🔴 μισό περίγραμμα', { shape: 'outline', point: POINT, outline: [POINT, { lat: 'x' }, POINT] }],
  ])('%s ⇒ `null`', (_label, raw) => {
    expect(parseListingMapMark(raw)).toBeNull();
  });

  it('πεδία πέρα από το σχήμα ΔΕΝ περνούν', () => {
    expect(parseListingMapMark({ shape: 'pin', point: { ...POINT, label: 'Εγνατίας 147' }, accuracy: 'exact' }))
      .toStrictEqual({ shape: 'pin', point: POINT });
  });
});

describe('🔑 ΕΝΑΣ ζωγράφος — δημόσιος χάρτης και στιγμιότυπο', () => {
  it('το feature του στιγμιότυπου είναι ΤΟ ΙΔΙΟ με του δημόσιου χάρτη', () => {
    const position = geocoded('center');
    const [publicFeature] = listingsToGeoJson([{ id: 'L1', title: 'Τ', position }]).features;
    const mark = listingMapMark(position);
    if (mark === null) throw new Error('η «Θεσσαλονίκη» έχει σημάδι (σκιασμένη πόλη)');
    expect(listingFeature('L1', 'Τ', mark)).toStrictEqual(publicFeature);
  });
});
