/**
 * @fileoverview ADR-896 — ποιος μπαίνει στον χάρτη του καταλόγου, και πώς.
 * Άγκυρα της εγγύησης «η πινέζα δεν λέει ποτέ περισσότερα από τη σελίδα προφίλ».
 */

import {
  hasDirectoryMap,
  presenceFootprintGeoJson,
  showcaseArrivalExtent,
  showcaseMapEntry,
  showcaseMapGeoJson,
  showcaseMapPresence,
  showcasePins,
  type MappableShowcase,
} from '../showcase-map';
import type { ShowcaseLocation, ShowcaseStreetLine } from '@/types/showcase-card';
import type { GeoPoint } from '@/types/geo/coordinates';

const SEAT = { lat: 40.64, lng: 22.94 };
const SHOP = { lat: 40.66, lng: 22.9 };
const HOME = { lat: 40.61, lng: 22.97 };

/**
 * ADR-896 §6 — «μόνο περιοχή» (`street: null`) **δεν έχει** πια τόπο στο δημόσιο σχήμα: το `position` που δίνει το
 * test για αυτό το σκέλος αγνοείται, όπως το αγνοεί ο αναγνώστης σε παλιό έγγραφο.
 */
function location(id: string, position: GeoPoint | null, street: ShowcaseStreetLine | null): ShowcaseLocation {
  const common = { id, role: 'branch' as const, label: null, hours: null, specialHours: [], channelKinds: [], emailConfirmedAt: null };
  return street === null
    ? { ...common, street: null, area: null }
    : { ...common, street, place: { landId: `land_${id}`, buildingId: null }, position };
}

const STREET = { street: 'Σαμοθράκης', number: '16', postalCode: '56334' };

function showcase(overrides: Partial<MappableShowcase> = {}): MappableShowcase {
  return { companyId: 'comp_a', displayName: 'Γραφείο Α', position: null, locations: [], coverage: null, ...overrides };
}

describe('showcasePins — η πινέζα δεν λέει περισσότερα από τη σελίδα προφίλ', () => {
  it('κατάστημα με δημοσιευμένη οδό ⇒ πινέζα', () => {
    expect(showcasePins(showcase({ locations: [location('sloc_1', SHOP, STREET)] }))).toEqual([
      { key: 'sloc_1', point: SHOP },
    ]);
  });

  it('κατάστημα «μόνο περιοχή» ⇒ ΚΑΜΙΑ πινέζα, ακόμη κι αν ξέρουμε το σημείο (Google SAB)', () => {
    expect(showcasePins(showcase({ locations: [location('sloc_1', HOME, null)] }))).toEqual([]);
  });

  it('με κάρτα, η παλιά έδρα ΔΕΝ γίνεται πινέζα — η κάρτα αποφασίζει', () => {
    const pins = showcasePins(showcase({ position: SEAT, locations: [location('sloc_1', HOME, null)] }));
    expect(pins).toEqual([]);
  });

  it('χωρίς κάρτα, η δημόσια «Έδρα» του προφίλ γίνεται πινέζα', () => {
    expect(showcasePins(showcase({ position: SEAT }))).toEqual([{ key: 'seat', point: SEAT }]);
  });

  it('μικτό: μόνο τα καταστήματα με οδό', () => {
    const pins = showcasePins(
      showcase({ locations: [location('sloc_1', SHOP, STREET), location('sloc_2', HOME, null), location('sloc_3', null, STREET)] }),
    );
    expect(pins.map((pin) => pin.key)).toEqual(['sloc_1']);
  });
});

describe('showcaseMapPresence', () => {
  it.each([
    ['pinned', showcase({ position: SEAT })],
    ['area-only', showcase({ locations: [location('sloc_1', HOME, null)] })],
    ['unplaced', showcase()],
  ] as const)('%s', (expected, subject) => {
    expect(showcaseMapPresence(subject)).toBe(expected);
  });
});

describe('showcaseMapGeoJson — ταυτότητα feature ≠ ταυτότητα εστίασης', () => {
  const geojson = showcaseMapGeoJson([
    showcase({ locations: [location('sloc_1', SHOP, STREET), location('sloc_2', SEAT, STREET)] }),
  ]);

  it('ένα feature ανά κατάστημα, με μοναδικό id', () => {
    expect(geojson.features.map((feature) => feature.id)).toEqual(['comp_a~sloc_1', 'comp_a~sloc_2']);
  });

  it('το properties.id είναι το γραφείο — το hover φωτίζει όλα τα καταστήματα', () => {
    expect(geojson.features.map((feature) => feature.properties.id)).toEqual(['comp_a', 'comp_a']);
  });

  it('ακριβής πινέζα, με το όνομα του γραφείου', () => {
    expect(geojson.features[0].properties.shape).toBe('pin');
    expect(geojson.features[0].properties.title).toBe('Γραφείο Α');
    expect(geojson.features[0].geometry).toEqual({ type: 'Point', coordinates: [SHOP.lng, SHOP.lat] });
  });
});

describe('hasDirectoryMap — πινέζα Ή εμβέλεια', () => {
  it('κανείς χωρίς τίποτα ⇒ όχι χάρτης', () => {
    expect(hasDirectoryMap([showcase(), showcase({ locations: [location('sloc_1', HOME, null)] })])).toBe(false);
  });

  it('μόνο «μόνο περιοχή» με δηλωμένη εμβέλεια ⇒ χάρτης (ο μόνος τόπος όπου φαίνεται πού δουλεύουν)', () => {
    const areaOnly = showcase({ locations: [location('sloc_1', HOME, null)], coverage: { nationwide: true } });
    expect(hasDirectoryMap([areaOnly])).toBe(true);
  });
});

it('showcaseMapEntry — χωρίς τιμή', () => {
  expect(showcaseMapEntry({ companyId: 'comp_a', displayName: 'Γραφείο Α' })).toEqual({
    id: 'comp_a',
    title: 'Γραφείο Α',
    price: null,
  });
});

describe('showcaseArrivalExtent — ο σύνδεσμος δείχνει πού δουλεύει, όχι μόνο πού κάθεται', () => {
  it('χαραγμένη περιοχή αλλού από το κατάστημα ⇒ κάδρο που περιέχει ΚΑΙ τα δύο', () => {
    const extent = showcaseArrivalExtent(
      showcase({
        locations: [location('sloc_1', SHOP, STREET)],
        coverage: { outline: [{ lat: 38, lng: 23.6 }, { lat: 38.1, lng: 23.7 }, { lat: 38, lng: 23.8 }] },
      }),
    );
    expect(extent).toEqual({ south: 38, west: 22.9, north: SHOP.lat, east: 23.8 });
  });

  it('διοικητική εμβέλεια (όρια ασύγχρονα) ⇒ μόνο τα καταστήματα', () => {
    expect(showcaseArrivalExtent(showcase({ position: SEAT, coverage: { adminIds: ['municipality:0701'] } }))).toEqual({
      south: SEAT.lat, west: SEAT.lng, north: SEAT.lat, east: SEAT.lng,
    });
  });

  it('τίποτα να καδραριστεί ⇒ null (ποτέ [0,0])', () => {
    expect(showcaseArrivalExtent(showcase())).toBeNull();
  });
});

describe('presenceFootprintGeoJson — η απόδειξη ακριβώς όπως γράφτηκε (ADR-896 §7.3 · ADR-846 Φ5δ)', () => {
  it('κύκλος με ακτίνα ⇒ περίγραμμα· ακτίνα 0 ⇒ σημείο — ένα feature ανά κύκλο', () => {
    const data = presenceFootprintGeoJson([{ center: SHOP, radiusKm: 1.5 }, { center: SEAT, radiusKm: 0 }]);
    expect(data.features.map((feature) => feature.geometry.type)).toEqual(['Polygon', 'Point']);
    expect(data.features[1].geometry).toEqual({ type: 'Point', coordinates: [SEAT.lng, SEAT.lat] });
  });

  it('🔴 ΠΟΤΕ διεύρυνση: κάθε κορυφή του περιγράμματος απέχει ακριβώς την ακτίνα (±1%)', () => {
    const [feature] = presenceFootprintGeoJson([{ center: SHOP, radiusKm: 1.5 }]).features;
    if (feature.geometry.type !== 'Polygon') throw new Error('expected polygon');
    const kmPerDegLat = 111.32;
    for (const [lng, lat] of feature.geometry.coordinates[0]) {
      const dy = (lat - SHOP.lat) * kmPerDegLat;
      const dx = (lng - SHOP.lng) * kmPerDegLat * Math.cos((SHOP.lat * Math.PI) / 180);
      expect(Math.hypot(dx, dy)).toBeCloseTo(1.5, 1);
    }
  });

  it('🔴 ΠΟΤΕ αριθμός: κανένα feature δεν κουβαλά ιδιότητα που θα γινόταν ετικέτα πλήθους', () => {
    const data = presenceFootprintGeoJson([{ center: SHOP, radiusKm: 1.5 }, { center: SEAT, radiusKm: 0 }]);
    expect(data.features.every((feature) => Object.keys(feature.properties ?? {}).length === 0)).toBe(true);
  });

  it('καμία απόδειξη ⇒ κενή συλλογή (όχι «πουθενά»)', () => {
    expect(presenceFootprintGeoJson([]).features).toEqual([]);
  });
});
