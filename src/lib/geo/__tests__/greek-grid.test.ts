/**
 * ADR-889 Φ5 — η ΜΙΑ σύνθεση «κάνναβος ΕΓΣΑ'87 → WGS84» (προβολή + datum).
 *
 * Άγκυρες: (α) αντίστροφη της διαδρομής WGS84 → κάνναβος που ήδη ελέγχεται (`basemap-projection`), (β) η μετάθεση datum
 * **υπάρχει και έχει το μετρημένο μέγεθος** — χωρίς αυτή, η ζώνη κάθεται τρία τετράγωνα δίπλα.
 */

import { distanceMeters } from '../geo-distance';
import { geographicToGrid, gridToGeographic } from '../egsa87-projection';
import { geoPointToGreekGrid, greekGridToGeoPoint } from '../greek-grid';
import { wgs84ToGgrs87 } from '../ggrs87-datum';

/** Σύνταγμα — WGS84. */
const SYNTAGMA = { lat: 37.9755, lng: 23.7348 };

function toGrid(point: { lat: number; lng: number }) {
  const local = wgs84ToGgrs87(point.lat, point.lng);
  return geographicToGrid(local.lat, local.lon);
}

describe('greekGridToGeoPoint', () => {
  it('αντιστρέφει τη διαδρομή WGS84 → κάνναβος στα λίγα χιλιοστά', () => {
    const grid = toGrid(SYNTAGMA);
    const back = greekGridToGeoPoint(grid.E, grid.N);
    // ~1,6 mm: η σύνθεση πετά το ελλειψοειδές ύψος (επίπεδη χρήση) — το ΙΔΙΟ μετρημένο φαινόμενο με την άγκυρα Μ2
    // του `ggrs87-datum` (1,59 mm). Αμελητέο για χάρτη ζωνών με ανοχή 2 m· το κατώφλι δεν «χαλαρώνει», το εξηγεί.
    expect(distanceMeters(back, SYNTAGMA)).toBeLessThan(0.005);
  });

  it('εφαρμόζει τη μετάθεση datum: μόνο προβολή ⇒ ~325 m δίπλα (το λάθος που αποκλείει)', () => {
    const grid = toGrid(SYNTAGMA);
    const projectionOnly = gridToGeographic(grid.E, grid.N);
    const offset = distanceMeters({ lat: projectionOnly.lat, lng: projectionOnly.lon }, SYNTAGMA);
    expect(offset).toBeGreaterThan(300);
    expect(offset).toBeLessThan(350);
  });
});

describe('geoPointToGreekGrid', () => {
  it('είναι η ίδια σύνθεση με τα δύο σκαλιά της, μετάθεση datum ΚΑΙ προβολή', () => {
    const grid = toGrid(SYNTAGMA);
    expect(geoPointToGreekGrid(SYNTAGMA)).toEqual({ easting: grid.E, northing: grid.N });
  });

  it('κλείνει τον κύκλο με τον εμπρός δρόμο στα λίγα χιλιοστά, από τη μία άκρη της χώρας ως την άλλη', () => {
    // Κέρκυρα · Αττική · Ρόδος (μακριά από τον κεντρικό μεσημβρινό, εκεί όπου οι σειρές δουλεύουν περισσότερο).
    for (const [easting, northing] of [[150_000, 4_390_000], [476_000, 4_202_000], [880_000, 4_010_000]]) {
      const back = geoPointToGreekGrid(greekGridToGeoPoint(easting, northing));
      expect(Math.hypot(back.easting - easting, back.northing - northing)).toBeLessThan(0.005);
    }
  });
});
