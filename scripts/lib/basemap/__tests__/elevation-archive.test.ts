/**
 * @jest-environment node
 */
/**
 * ADR-920 §14.12 Β1 — το αρχείο υψομέτρου κόβεται **μόνο** από τον καρφωμένο πλανήτη του Mapterhorn.
 *
 * 🔑 Το upstream `planet.pmtiles` ξαναγράφεται στη θέση του. Αυτές οι άγκυρες κρατούν την υπόσχεση «ένα όνομα
 * αρχείου = ένα περιεχόμενο» που χρειάζεται ο διακομιστής μας για να σερβίρει `immutable`.
 */

import { ELEVATION_ARCHIVE_BUILD } from '../../../../src/lib/maps/basemap-catalog';
import { ELEVATION_MARGIN_KM, elevationExtent, parseMapterhornIndex, pinnedPlanetOf, type MapterhornIndex } from '../elevation-archive';

/** Οι τιμές του `download_urls.json` όπως διαβάστηκαν 2026-11-24 — γραμμένες εδώ δεύτερη φορά, με το χέρι. */
const PLANET = { name: 'planet.pmtiles', url: 'https://download.mapterhorn.com/planet.pmtiles', md5sum: '4bf586b043f7619d9a9442b43c163f36', size: 355579263191 };

const indexOf = (version: string, planet: typeof PLANET = PLANET): MapterhornIndex => ({ version, items: [planet] });

describe('parseMapterhornIndex', () => {
  it('δέχεται το σχήμα του ευρετηρίου και πετά ό,τι δεν είναι εγγραφή αρχείου', () => {
    const index = parseMapterhornIndex({ version: '0.0.13', items: [PLANET, { name: 'μισό' }, null] });
    expect(index).toEqual({ version: '0.0.13', items: [PLANET] });
  });

  it('άγνωστο σχήμα ⇒ σφάλμα — ποτέ «ό,τι βρέθηκε»', () => {
    expect(() => parseMapterhornIndex(null)).toThrow(/δεν είναι αντικείμενο/);
    expect(() => parseMapterhornIndex({ items: [] })).toThrow(/λείπει/);
    expect(() => parseMapterhornIndex({ version: '0.0.13', items: 'x' })).toThrow(/λείπει/);
  });
});

describe('pinnedPlanetOf — ένα όνομα αρχείου, ένα περιεχόμενο', () => {
  it('η έκδοση του καταλόγου έχει καρφωμένο πλανήτη, και το ζωντανό ευρετήριο της 2026-11-24 τον επιβεβαιώνει', () => {
    expect(ELEVATION_ARCHIVE_BUILD).toBe('0.0.13');
    expect(pinnedPlanetOf(indexOf('0.0.13'))).toEqual({ url: PLANET.url, md5sum: PLANET.md5sum, bytes: PLANET.size });
  });

  it('το upstream προχώρησε έκδοση ⇒ άρνηση (το planet.pmtiles άλλαξε στη θέση του)', () => {
    expect(() => pinnedPlanetOf(indexOf('0.0.14'))).toThrow(/upstream σερβίρει 0\.0\.14/);
  });

  it('ίδια έκδοση, άλλο md5 ή άλλο μέγεθος ⇒ άρνηση', () => {
    expect(() => pinnedPlanetOf(indexOf('0.0.13', { ...PLANET, md5sum: 'x' }))).toThrow(/άλλαξε χωρίς νέα έκδοση/);
    expect(() => pinnedPlanetOf(indexOf('0.0.13', { ...PLANET, size: 1 }))).toThrow(/άλλαξε χωρίς νέα έκδοση/);
  });

  it('ο πλανήτης λείπει από το ευρετήριο ⇒ άρνηση', () => {
    expect(() => pinnedPlanetOf({ version: '0.0.13', items: [] })).toThrow(/δεν έχει πια/);
  });

  it('έκδοση χωρίς γραμμή στον πίνακα ⇒ άρνηση πριν από κάθε αίτημα', () => {
    expect(() => pinnedPlanetOf(indexOf('9.9.9'), '9.9.9')).toThrow(/κανένας καρφωμένος πλανήτης/);
  });
});

describe('elevationExtent — ορθογώνιο χωρίς τρύπες', () => {
  const leaves = [
    { id: 'a', level: 5, bbox: { west: 20, south: 35, east: 22, north: 37 } },
    { id: 'b', level: 5, bbox: { west: 25, south: 39, east: 28, north: 41 } },
  ];

  it('περιέχει κάθε όριο και περισσεύει προς κάθε κατεύθυνση', () => {
    const box = elevationExtent(leaves);
    expect(box.west).toBeLessThan(20);
    expect(box.south).toBeLessThan(35);
    expect(box.east).toBeGreaterThan(28);
    expect(box.north).toBeGreaterThan(41);
  });

  it('το περιθώριο στον άξονα βορρά–νότου είναι το δηλωμένο (1° ≈ 111,32 km)', () => {
    const box = elevationExtent(leaves);
    expect((35 - box.south) * 111.32).toBeCloseTo(ELEVATION_MARGIN_KM, 6);
    expect((box.north - 41) * 111.32).toBeCloseTo(ELEVATION_MARGIN_KM, 6);
  });
});
