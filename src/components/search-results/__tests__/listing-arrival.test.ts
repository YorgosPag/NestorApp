/**
 * @fileoverview ΑΓΚΥΡΑ — **η άφιξη σε μία αγγελία** (ADR-777 §8.77, σύνδεσμος `?selected=`).
 * @related lib/listings/listing-map-bounds.ts (`listingArrivalArea`) · components/search-results/useListingArrival.ts
 *
 *   Φ1 · ακριβής πινέζα ⇒ κάδρο-σημείο (το ταβάνι `suggested` ορίζει το ζουμ).
 *   Φ2 · «κάπου στην πόλη» ⇒ το κάδρο ΠΕΡΙΚΛΕΙΕΙ τον κύκλο αβεβαιότητας (όχι ψευδής ακρίβεια, Α5).
 *   Φ3 · άγνωστο id ⇒ `null` (ο καλών καδράρει τα δεδομένα).
 *   Φ4 · ΜΙΑ άφιξη: 1η κλήση ⇒ η αγγελία · 2η ⇒ τα δεδομένα.
 *   Φ5 · άγνωστο id ⇒ τα δεδομένα, και η άφιξη ΚΑΤΑΝΑΛΩΝΕΤΑΙ (όχι μελλοντικό τίναγμα).
 *   Φ6 · κάδρο αποστολέα (`?box=`) στη γέννηση ⇒ καμία άφιξη.
 */

import { renderHook } from '@testing-library/react';

import { listingArrivalArea, type ListingBounds } from '@/lib/listings/listing-map-bounds';
import { listingFeature, type ListingGeoJson } from '@/lib/listings/listings-geojson';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

import type { MapEventTarget } from '../results-map-contract';
import { useListingArrival } from '../useListingArrival';

const PIN: ListingMapMark = { shape: 'pin', point: { lat: 40.64, lng: 22.94 } };
const CITY: ListingMapMark = { shape: 'shaded-city', point: { lat: 40.63, lng: 22.95 } };

function geojsonOf(entries: ReadonlyArray<readonly [string, ListingMapMark]>): ListingGeoJson {
  return { type: 'FeatureCollection', features: entries.map(([id, mark]) => listingFeature(id, id, mark)) };
}

const DATA = geojsonOf([['pin', PIN], ['city', CITY]]);
const ALL: ListingBounds = [[22.94, 40.63], [22.95, 40.64]];

describe('listingArrivalArea — τι ισχυρίζεται το κάδρο', () => {
  it('Φ1 · ακριβής πινέζα ⇒ σημείο', () => {
    expect(listingArrivalArea(DATA, 'pin')).toEqual({ west: 22.94, south: 40.64, east: 22.94, north: 40.64 });
  });

  it('Φ2 · «πόλη» ⇒ ο κύκλος αβεβαιότητας χωρά ολόκληρος', () => {
    const area = listingArrivalArea(DATA, 'city');
    const feature = DATA.features.find((f) => f.properties.id === 'city');
    if (area === null || feature === undefined) throw new Error('λείπει');
    const radiusDegLat = feature.properties.uncertaintyM / 111_320;

    expect(radiusDegLat).toBeGreaterThan(0.01); // ο παρονομαστής: πράγματι χιλιόμετρα, όχι σημείο
    expect(area.north - CITY.point.lat).toBeGreaterThanOrEqual(radiusDegLat * 0.99);
    expect(CITY.point.lat - area.south).toBeGreaterThanOrEqual(radiusDegLat * 0.99);
    expect(area.east - CITY.point.lng).toBeGreaterThan(radiusDegLat); // μήκος: φαρδύτερο στις 40°
  });

  it('Φ3 · άγνωστο id ⇒ null', () => {
    expect(listingArrivalArea(DATA, 'nope')).toBeNull();
  });
});

describe('useListingArrival — μία άφιξη ανά χάρτη', () => {
  function fakeMap(): MapEventTarget & { calls: Array<[[number, number], [number, number]]> } {
    const calls: Array<[[number, number], [number, number]]> = [];
    return { calls, fitBounds: (bounds: [[number, number], [number, number]]) => { calls.push(bounds); } } as unknown as
      MapEventTarget & { calls: Array<[[number, number], [number, number]]> };
  }

  function arrival(selected: string | null, box: GeoBoundingBox | null = null) {
    return renderHook(() => useListingArrival(DATA, selected, box)).result.current;
  }

  it('Φ4 · 1η φορά ⇒ η αγγελία · 2η ⇒ τα δεδομένα', () => {
    const map = fakeMap();
    const frame = arrival('pin');
    frame(map, ALL);
    frame(map, ALL);
    expect(map.calls).toEqual([[[22.94, 40.64], [22.94, 40.64]], ALL]);
  });

  it('Φ5 · αγγελία που δεν ζωγραφίζεται ⇒ τα δεδομένα, και η άφιξη δεν περιμένει', () => {
    const map = fakeMap();
    const frame = arrival('withdrawn');
    frame(map, ALL);
    expect(map.calls).toEqual([ALL]);
  });

  it('Φ6 · κάδρο αποστολέα στη γέννηση ⇒ καμία άφιξη', () => {
    const map = fakeMap();
    const frame = arrival('pin', { west: 1, south: 1, east: 2, north: 2 });
    frame(map, ALL);
    expect(map.calls).toEqual([ALL]);
  });
});
