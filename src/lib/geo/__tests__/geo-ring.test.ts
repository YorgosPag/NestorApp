/**
 * Άγκυρες — **δακτύλιος** (ADR-777 Α9, Ζ4).
 *
 * Δύο συμβόλαια, και το δεύτερο είναι αυτό που μπορεί να σπάσει σιωπηλά:
 *
 * **Π** — «μέσα ή έξω», μαζί με τη **μη κυρτή** περίπτωση. Ένα σχήμα «Γ» είναι
 * ακριβώς αυτό που σχεδιάζει κάποιος όταν λέει *«αυτό το κομμάτι της οδού»*, και
 * είναι η περίπτωση όπου το **κέντρο πέφτει έξω από το σχήμα**.
 *
 * **Κ** — ο περικλείων κύκλος είναι **ΥΠΕΡΣΥΝΟΛΟ**. Αν σφίξει, η προβολή προς τα
 * φίλτρα κρύβει αγγελίες που ταιριάζουν **πραγματικά** — σιωπηλά.
 */

import { geoOutlineBoundingCircle, isPointInGeoOutline } from '../geo-ring';
import { distanceMeters as metres } from '@/lib/geo/geo-distance';
import type { GeoOutline } from '@/types/geo/coordinates';

/** Τετράγωνο 0,02° × 0,02° γύρω από τη Θεσσαλονίκη. */
const SQUARE: GeoOutline = [
  { lat: 40.63, lng: 22.93 },
  { lat: 40.63, lng: 22.95 },
  { lat: 40.65, lng: 22.95 },
  { lat: 40.65, lng: 22.93 },
];

/**
 * Σχήμα «Γ» — **μη κυρτό**, με την εγκοπή στο πάνω δεξιά τεταρτημόριο.
 * Το κέντρο βάρους των κορυφών πέφτει **μέσα** στην εγκοπή, δηλαδή **εκτός** σχήματος.
 */
const L_SHAPE: GeoOutline = [
  { lat: 40.63, lng: 22.93 },
  { lat: 40.63, lng: 22.97 },
  { lat: 40.64, lng: 22.97 },
  { lat: 40.64, lng: 22.94 },
  { lat: 40.67, lng: 22.94 },
  { lat: 40.67, lng: 22.93 },
];

describe('Π — μέσα ή έξω', () => {
  it('σημείο στο κέντρο τετραγώνου → μέσα', () => {
    expect(isPointInGeoOutline({ lat: 40.64, lng: 22.94 }, SQUARE)).toBe(true);
  });

  it('σημείο εκτός → έξω', () => {
    expect(isPointInGeoOutline({ lat: 37.98, lng: 23.73 }, SQUARE)).toBe(false);
    expect(isPointInGeoOutline({ lat: 40.64, lng: 22.99 }, SQUARE)).toBe(false);
  });

  it('🔴 ΜΗ ΚΥΡΤΟ: η εγκοπή του «Γ» είναι ΕΞΩ, το σκέλος ΜΕΣΑ', () => {
    // Ένας έλεγχος «μέσα στο ορθογώνιο περίβλημα» θα έλεγε «μέσα» και για τα δύο —
    // και είναι ακριβώς η υλοποίηση που μπαίνει κατά λάθος.
    expect(isPointInGeoOutline({ lat: 40.66, lng: 22.96 }, L_SHAPE)).toBe(false);
    expect(isPointInGeoOutline({ lat: 40.66, lng: 22.935 }, L_SHAPE)).toBe(true);
    expect(isPointInGeoOutline({ lat: 40.635, lng: 22.96 }, L_SHAPE)).toBe(true);
  });

  it('δακτύλιος με λιγότερες από 3 κορυφές δεν περιέχει ΤΙΠΟΤΑ', () => {
    expect(isPointInGeoOutline({ lat: 40.64, lng: 22.94 }, [])).toBe(false);
    expect(
      isPointInGeoOutline({ lat: 40.64, lng: 22.94 }, [
        { lat: 40.63, lng: 22.93 },
        { lat: 40.65, lng: 22.95 },
      ]),
    ).toBe(false);
  });

  it('🔑 η πρώτη κορυφή ΔΕΝ επαναλαμβάνεται — το κλείσιμο είναι ιδιότητα του τύπου', () => {
    const explicitlyClosed: GeoOutline = [...SQUARE, SQUARE[0]];
    // Η ίδια απάντηση με ή χωρίς επανάληψη: αλλιώς δύο νόμιμες γραφές του ίδιου
    // σχήματος θα έδιναν διαφορετικό αποτέλεσμα, ανάλογα με το ποιος το έγραψε.
    expect(isPointInGeoOutline({ lat: 40.64, lng: 22.94 }, explicitlyClosed)).toBe(true);
    expect(isPointInGeoOutline({ lat: 37.98, lng: 23.73 }, explicitlyClosed)).toBe(false);
  });
});

describe('🔴 Κ — ο περικλείων κύκλος ΠΕΡΙΚΛΕΙΕΙ', () => {
  it('κάθε κορυφή τετραγώνου είναι μέσα στον κύκλο', () => {
    const circle = geoOutlineBoundingCircle(SQUARE, metres)!;
    for (const vertex of SQUARE) {
      expect(metres(circle.center, vertex)).toBeLessThanOrEqual(circle.radiusKm * 1000 + 1e-6);
    }
  });

  it('🔴 ΚΑΙ ΣΤΟ ΜΗ ΚΥΡΤΟ — εκεί όπου το κέντρο πέφτει εκτός σχήματος', () => {
    const circle = geoOutlineBoundingCircle(L_SHAPE, metres)!;
    // Το κέντρο ΔΕΝ είναι μέσα στο «Γ» — και δεν πειράζει: το συμβόλαιο είναι
    // «περικλείει», όχι «το κέντρο ανήκει στο σχήμα».
    expect(isPointInGeoOutline(circle.center, L_SHAPE)).toBe(false);
    for (const vertex of L_SHAPE) {
      expect(metres(circle.center, vertex)).toBeLessThanOrEqual(circle.radiusKm * 1000 + 1e-6);
    }
  });

  it('🔴 εκφυλισμένος δακτύλιος ΔΕΝ δίνει ακτίνα 0 — το 0 φιλτράρει ΤΑ ΠΑΝΤΑ', () => {
    const point: GeoPoint = { lat: 40.64, lng: 22.94 };
    const circle = geoOutlineBoundingCircle([point, point, point], metres)!;
    expect(circle.radiusKm).toBeGreaterThan(0);
    // 10 μέτρα: μικρότερο από κάθε οικόπεδο, μεγαλύτερο από κάθε στρογγυλοποίηση.
    expect(circle.radiusKm).toBeCloseTo(0.01, 6);
  });

  it('κενός δακτύλιος → `null`, όχι κύκλος γύρω από το τίποτα', () => {
    expect(geoOutlineBoundingCircle([], metres)).toBeNull();
  });
});
