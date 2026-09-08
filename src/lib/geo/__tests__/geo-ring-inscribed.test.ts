/**
 * @fileoverview Άγκυρες για την **εγγεγραμμένη ακτίνα** και τον περικλείοντα κύκλο
 * **συνόλου δακτυλίων** — ADR-846 Φάση 2.5.
 *
 * 🔑 **Τι φυλάει πραγματικά αυτό το αρχείο**: όχι «τρέχει η συνάρτηση», αλλά τις
 * **τέσσερις** αποφάσεις από τις οποίες κρέμεται η ορθότητα κάθε συμπεράσματος του
 * κριτή — απόσταση προς **ακμή** (όχι κορυφή), `0` όταν το κέντρο είναι **έξω**, οι
 * **τρύπες** μετρούν, και ο εγκλεισμός `inner ⊆ σχήμα ⊆ outer` **ισχύει**.
 */

import { distanceMeters } from '../geo-distance';
import { geoRingsBoundingCircle, geoRingsInscribedRadius, vertexCentroid } from '../geo-ring';
import { geoJsonRings } from '../geo-geojson';
import type { GeoOutline } from '@/types/geo/coordinates';

/** Τετράγωνο σε μοίρες, με κέντρο (`lat`, `lng`) και ημι-πλευρά `half`. */
function square(lat: number, lng: number, half: number): GeoOutline {
  return [
    { lat: lat - half, lng: lng - half },
    { lat: lat - half, lng: lng + half },
    { lat: lat + half, lng: lng + half },
    { lat: lat + half, lng: lng - half },
  ];
}

describe('geoRingsInscribedRadius — η εγγεγραμμένη ακτίνα', () => {
  it('σε τετράγωνο δίνει την απόσταση προς την ΠΛΗΣΙΕΣΤΕΡΗ ακμή, όχι προς κορυφή', () => {
    const ring = square(40.05, 23.05, 0.05);
    const centre = vertexCentroid(ring);

    const inscribedKm = geoRingsInscribedRadius([ring], centre);

    // Ο μεσημβρινός «γίνεται» ~111,2 km/μοίρα· ο παράλληλος στις 40° μόνο ~85,1 km/μοίρα.
    // Άρα η στενή διάσταση είναι η ΑΝΑΤΟΛΙΚΗ–ΔΥΤΙΚΗ: 0,05° × 111,195 × cos(40,05°).
    const expectedKm = 0.05 * 111.194926 * Math.cos((40.05 * Math.PI) / 180);
    expect(inscribedKm).toBeCloseTo(expectedKm, 2);

    // 🔴 Η ΔΙΑΚΡΙΣΗ ΠΟΥ ΜΕΤΡΑΕΙ: η απόσταση προς την πλησιέστερη **κορυφή** είναι η
    //    διαγώνιος — αισθητά μεγαλύτερη. Αν η υλοποίηση γύριζε ποτέ σε «απόσταση προς
    //    κορυφή», ο κύκλος θα ξεχείλιζε έξω από το σχήμα και ο κριτής θα παρήγαγε
    //    ψεύτικα `intersects`.
    const nearestVertexKm = Math.min(...ring.map((v) => distanceMeters(centre, v) / 1000));
    expect(inscribedKm).toBeLessThan(nearestVertexKm * 0.95);
  });

  it('🔴 σε ΛΕΠΤΟ σχήμα η διαφορά ακμής/κορυφής είναι τάξεις μεγέθους — και τηρείται', () => {
    // Λωρίδα: πολύ πλατιά, πολύ χαμηλή. Οι κορυφές είναι μακριά, οι μεγάλες ακμές δίπλα.
    const ring: GeoOutline = [
      { lat: 39.999, lng: 22.0 },
      { lat: 39.999, lng: 24.0 },
      { lat: 40.001, lng: 24.0 },
      { lat: 40.001, lng: 22.0 },
    ];
    const centre = vertexCentroid(ring);

    const inscribedKm = geoRingsInscribedRadius([ring], centre);
    const nearestVertexKm = Math.min(...ring.map((v) => distanceMeters(centre, v) / 1000));

    expect(inscribedKm).toBeCloseTo(0.001 * 111.194926, 3); // ~111 m — η μισή «ύψους»
    expect(nearestVertexKm).toBeGreaterThan(80); // ~85 km — η μισή «πλάτους»
  });

  it('🔴 δίνει 0 όταν το κέντρο πέφτει ΕΞΩ από το σχήμα (αρχιπέλαγος)', () => {
    // Δύο μακρινά νησιά: το κεντροειδές των κορυφών πέφτει στη μέση, στο πουθενά.
    const west = square(40, 22, 0.05);
    const east = square(40, 25, 0.05);
    const centre = vertexCentroid([...west, ...east]);

    expect(geoRingsInscribedRadius([west, east], centre)).toBe(0);
  });

  it('🔴 δίνει 0 όταν το κέντρο πέφτει μέσα σε ΤΡΥΠΑ (even–odd, όχι «μέσα στον πρώτο»)', () => {
    const outer = square(40, 23, 0.5);
    const hole = square(40, 23, 0.2);
    const centre = vertexCentroid([...outer, ...hole]);

    // Το κέντρο είναι μέσα στον εξωτερικό **και** μέσα στην τρύπα ⇒ 2 δακτύλιοι ⇒ έξω.
    expect(geoRingsInscribedRadius([outer, hole], centre)).toBe(0);
  });

  it('η ΤΡΥΠΑ περιορίζει την ακτίνα ακόμη κι όταν δεν περιέχει το κέντρο', () => {
    const outer = square(40, 23, 0.5);
    const withoutHole = geoRingsInscribedRadius([outer], vertexCentroid(outer));

    // Τρύπα κοντά στο κέντρο, αλλά όχι γύρω του.
    const hole = square(40.05, 23, 0.02);
    const centre = vertexCentroid(outer);
    const withHole = geoRingsInscribedRadius([outer, hole], centre);

    expect(withHole).toBeGreaterThan(0);
    expect(withHole).toBeLessThan(withoutHole);
  });

  it('δίνει 0 για κενή είσοδο και για εκφυλισμένο δακτύλιο', () => {
    expect(geoRingsInscribedRadius([], { lat: 40, lng: 23 })).toBe(0);
    expect(geoRingsInscribedRadius([[{ lat: 40, lng: 23 }]], { lat: 40, lng: 23 })).toBe(0);
  });
});

describe('geoRingsBoundingCircle — ο περικλείων κύκλος συνόλου', () => {
  it('περικλείει ΚΑΘΕ κορυφή ΚΑΘΕ μέρους', () => {
    const west = square(40, 22, 0.05);
    const east = square(40, 25, 0.05);

    const circle = geoRingsBoundingCircle([west, east], distanceMeters);
    expect(circle).not.toBeNull();

    for (const vertex of [...west, ...east]) {
      expect(distanceMeters(circle!.center, vertex) / 1000).toBeLessThanOrEqual(
        circle!.radiusKm + 1e-9,
      );
    }
  });

  it('🔒 Η ΑΓΚΥΡΑ ΤΟΥ ΕΓΚΛΕΙΣΜΟΥ: outer >= inner, σε κάθε σχήμα', () => {
    const shapes: readonly (readonly GeoOutline[])[] = [
      [square(40, 23, 0.05)],
      [square(38, 21, 0.5), square(38, 24, 0.1)],
      [square(40, 23, 0.5), square(40, 23, 0.2)],
      [square(37.9, 23.7, 0.01)],
    ];

    for (const rings of shapes) {
      const circle = geoRingsBoundingCircle(rings, distanceMeters);
      expect(circle).not.toBeNull();
      const innerKm = geoRingsInscribedRadius(rings, circle!.center);
      expect(circle!.radiusKm).toBeGreaterThanOrEqual(innerKm);
    }
  });

  it('δίνει null για σχήμα χωρίς καμία κορυφή', () => {
    expect(geoRingsBoundingCircle([], distanceMeters)).toBeNull();
  });
});

describe('geoJsonRings — GeoJSON → δακτύλιοι', () => {
  it('αφαιρεί την επαναλαμβανόμενη τελευταία κορυφή και αντιστρέφει σωστά το ζεύγος', () => {
    const rings = geoJsonRings({
      type: 'Polygon',
      coordinates: [
        [
          [23, 40],
          [23.1, 40],
          [23.1, 40.1],
          [23, 40.1],
          [23, 40],
        ],
      ],
    });

    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    // 🔴 `[lng, lat]` στο GeoJSON — αν αντιστραφεί, το σχήμα φεύγει σε άλλη ήπειρο.
    expect(rings[0][0]).toEqual({ lng: 23, lat: 40 });
  });

  it('ισοπεδώνει MultiPolygon μαζί με τις τρύπες του', () => {
    const rings = geoJsonRings({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [23, 40],
            [24, 40],
            [24, 41],
            [23, 40],
          ],
          [
            [23.2, 40.2],
            [23.4, 40.2],
            [23.4, 40.4],
            [23.2, 40.2],
          ],
        ],
        [
          [
            [25, 40],
            [26, 40],
            [26, 41],
            [25, 40],
          ],
        ],
      ],
    });

    expect(rings).toHaveLength(3);
  });

  it('απορρίπτει δακτύλιο που δεν περικλείει εμβαδόν', () => {
    const rings = geoJsonRings({
      type: 'Polygon',
      coordinates: [
        [
          [23, 40],
          [24, 41],
          [23, 40],
        ],
      ],
    });

    expect(rings).toHaveLength(0);
  });
});
