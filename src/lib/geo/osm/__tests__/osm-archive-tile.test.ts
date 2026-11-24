/**
 * @fileoverview 🏆 **Το δικό μας αρχείο OSM, σε ΠΡΑΓΜΑΤΙΚΑ πλακίδια** — αποκωδικοποίηση, περιεκτικότητα, ραφή (ADR-777 §8.104).
 *
 * Fixtures: δύο πλακίδια z15 της Θέρμης από το `greece-20260926.pmtiles` (2026-11-19), αποσυμπιεσμένα MVT σε gzip:
 * `18479/12338` (το πλακίδιο του (40.5609, 23.0213)) και ο δυτικός του γείτονας `18478/12338`.
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Α1 354 θραύσματα κτιρίων, 37 ξεχειλίζουν | λάθος στρώση / φίλτρο `kind` / κανένα `spills` |
 * | Α2 το σημείο ⇒ way 980875811 (OSM API: `building=yes`) | εγγύτητα αντί περιεκτικότητας · λάθος προβολή |
 * | Α3 ραφή 978287779: 4,9 m² ⇒ ~266 m² (Overpass 264,5) | θραύσμα ως «το κτίριο» · άθροισμα χωρίς ένωση |
 * | Α4 μόνο ο γείτονας προς τον οποίο ξεχειλίζει | άντληση όλου του 3×3 |
 * | Α5 πλέγμα ⇄ WGS84 round-trip | δεύτερη διατύπωση Mercator (256 ⇄ 512) |
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { assembleArchiveBuilding, fragmentContains, fragmentsById } from '../osm-archive-building';
import {
  archiveTileOf,
  decodeBuildingFragments,
  decodeRoadNames,
  geoPointOfGrid,
  gridPairOf,
  neighbourTilesFor,
  type ArchiveTileAddress,
} from '../osm-archive-tile';
import { tileFeatureIdOfOsmWay } from '../protomaps-osm-identity';

const Z = 15;
const CENTRE: ArchiveTileAddress = { z: Z, x: 18479, y: 12338 };
const WEST: ArchiveTileAddress = { z: Z, x: 18478, y: 12338 };
const POINT = { lat: 40.5609, lng: 23.0213 };

function fixture(tile: ArchiveTileAddress): Uint8Array {
  return gunzipSync(readFileSync(join(__dirname, 'fixtures', `thermi-z15-${tile.x}-${tile.y}.mvt.gz`)));
}

const centre = decodeBuildingFragments(fixture(CENTRE), CENTRE);
const west = decodeBuildingFragments(fixture(WEST), WEST);
const idOf = (wayId: string): number => tileFeatureIdOfOsmWay(wayId) as number;

describe('Α1 — αποκωδικοποίηση της στρώσης κτιρίων', () => {
  it('🔴 354 θραύσματα, όλα με id, 37 ξεχειλίζουν', () => {
    expect(centre).toHaveLength(354);
    const spilling = centre.filter(({ spills }) => spills.west || spills.east || spills.north || spills.south);
    expect(spilling).toHaveLength(37);
  });

  it('🔑 το σημείο πέφτει στο πλακίδιο του fixture', () => {
    expect(archiveTileOf(POINT, Z)).toEqual(CENTRE);
  });
});

describe('Α2 — περιεκτικότητα, όχι εγγύτητα', () => {
  it('🔴 το (40.5609, 23.0213) περιέχεται στο way 980875811 — και ΜΟΝΟ σε αυτό', () => {
    const containing = centre.filter((fragment) => fragmentContains(fragment, POINT, Z));
    expect(containing.map((fragment) => fragment.featureId)).toEqual([idOf('980875811')]);
  });

  it('🔑 το κτίριο: ref way, σημείο = κέντρο περιβλήματος μέσα στο κτίριο, εμβαδό ~155 m²', () => {
    const building = assembleArchiveBuilding(fragmentsById(centre).get(idOf('980875811')) ?? [], Z);
    expect(building?.ref).toEqual({ elementType: 'way', elementId: '980875811' });
    expect(building?.areaSqm).toBeCloseTo(155.4, 0);
    expect(building?.outline.length).toBeGreaterThanOrEqual(3);
    expect(Math.abs((building?.point.lat ?? 0) - POINT.lat)).toBeLessThan(0.0002);
  });
});

describe('Α3 · Α4 — ραφή κτιρίου πάνω σε όριο πλακιδίου', () => {
  const id = idOf('978287779');
  const own = centre.filter((fragment) => fragment.featureId === id);

  it('🔑 Α4 — ξεχειλίζει ΜΟΝΟ δυτικά ⇒ ζητείται ΜΟΝΟ ο δυτικός γείτονας', () => {
    expect(own).toHaveLength(1);
    expect(neighbourTilesFor(CENTRE, own)).toEqual([WEST]);
  });

  it('🔴 Α3 — θραύσμα ~4,9 m² ⇒ ραμμένο ~266 m², εντός 2 % του Overpass (264,5 m²)', () => {
    const alone = assembleArchiveBuilding(own, Z);
    const whole = assembleArchiveBuilding([...own, ...west.filter((fragment) => fragment.featureId === id)], Z);
    expect(alone?.areaSqm).toBeLessThan(10);
    expect(Math.abs((whole?.areaSqm ?? 0) - 264.5) / 264.5).toBeLessThan(0.02);
  });
});

describe('Α5 — μία προβολή', () => {
  it('🔴 WGS84 → πλέγμα → WGS84 (κάτω από εκατοστό)', () => {
    const back = geoPointOfGrid(gridPairOf(POINT, Z), Z);
    expect(back.lat).toBeCloseTo(POINT.lat, 7);
    expect(back.lng).toBeCloseTo(POINT.lng, 7);
  });
});

describe('Α6 — ονόματα οδών από τη στρώση `roads` (ADR-950 §8.13, «Μήπως εννοείτε…»)', () => {
  const names = decodeRoadNames(fixture(CENTRE));

  it('🔴 34 διακριτά ονόματα (43 δρόμοι, 4 ανώνυμοι — μετρημένο 2026-11-24)', () => {
    expect(names).toHaveLength(34);
    expect(new Set(names).size).toBe(names.length);
  });

  it('🔑 πραγματικές οδοί της Θέρμης, χωρίς κενά', () => {
    expect(names).toEqual(expect.arrayContaining(['Πανοράματος', 'Θερμοπυλών', 'Ανδρέα Κάλβου']));
    expect(names.every((name) => name.trim() === name && name !== '')).toBe(true);
  });
});
