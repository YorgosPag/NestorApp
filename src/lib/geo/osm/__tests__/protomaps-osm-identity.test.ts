/**
 * @fileoverview 🏆 **Η ταυτότητα πλακιδίου ↔ OSM** — από τα **μετρημένα** id (ADR-777 §8.104).
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Τ1 τα δύο μετρημένα id ⇒ τα way που επιβεβαίωσε το OSM API | λάθος βάση (π.χ. `2^44`) |
 * | Τ2 αντίστροφο ⇒ ίδιο id (round-trip) | ασύμμετρη κωδικοποίηση |
 * | Τ3 εκτός μετρημένης ζώνης / μη ακέραιο / `undefined` ⇒ `null`, ποτέ «way» | σιωπηλή μαντεψιά node/relation |
 * | Τ4 το κριτήριο «κτίριο» και το φίλτρο της MapLibre λένε το ίδιο | δύο λίστες που αποκλίνουν |
 */
import {
  isProtomapsBuildingKind,
  osmRefOfTileFeatureId,
  protomapsBuildingKindFilter,
  PROTOMAPS_BUILDING_KINDS,
  tileFeatureIdOfOsmWay,
} from '../protomaps-osm-identity';

/** Μετρημένα 2026-11-19 στο `greece-20260926.pmtiles` και επιβεβαιωμένα στο OSM API. */
const MEASURED = [
  { featureId: 35184972705813, wayId: '600616981' }, // Lidl, Πανόραμα 55236
  { featureId: 35185350375225, wayId: '978286393' }, // building=yes
] as const;

describe('Τ1 · Τ2 — μετρημένη κωδικοποίηση `2^45 + way`', () => {
  it.each(MEASURED)('🔴 $featureId ⇒ way $wayId, και πίσω', ({ featureId, wayId }) => {
    expect(osmRefOfTileFeatureId(featureId)).toEqual({ elementType: 'way', elementId: wayId });
    expect(tileFeatureIdOfOsmWay(wayId)).toBe(featureId);
  });
});

describe('Τ3 — έξω από τη μετρημένη ζώνη ⇒ `null`', () => {
  it.each([
    ['κάτω από τη βάση (πιθανή κωδικοποίηση node)', 2 ** 44 + 5],
    ['πάνω από τη ζώνη (πιθανή κωδικοποίηση relation)', 3 * 2 ** 44 + 5],
    ['ακριβώς η βάση (way 0)', 2 ** 45],
    ['μη ακέραιο', 2 ** 45 + 0.5],
    ['undefined (χαρακτηριστικό χωρίς id)', undefined],
    ['συμβολοσειρά', '35184972705813'],
  ])('🔴 %s', (_label, id) => {
    expect(osmRefOfTileFeatureId(id)).toBeNull();
  });

  it.each(['0', '-5', '12a', '', String(2 ** 44)])('🔴 way id «%s» ⇒ `null`', (wayId) => {
    expect(tileFeatureIdOfOsmWay(wayId)).toBeNull();
  });
});

describe('Τ4 — ένα κριτήριο «κτίριο»', () => {
  it('🔴 το φίλτρο της MapLibre απαριθμεί ακριβώς τα ίδια `kind`', () => {
    expect(protomapsBuildingKindFilter()).toEqual(['in', ['get', 'kind'], ['literal', [...PROTOMAPS_BUILDING_KINDS]]]);
  });

  it('🔑 νέος πίνακας σε κάθε κλήση (το στυλ μπορεί να τον μεταλλάξει)', () => {
    expect(protomapsBuildingKindFilter()).not.toBe(protomapsBuildingKindFilter());
  });

  it.each([
    ['building', true],
    ['building_part', true],
    ['address', false],
    [undefined, false],
  ])('`kind: %s` ⇒ %s', (kind, expected) => {
    expect(isProtomapsBuildingKind(kind)).toBe(expected);
  });
});
