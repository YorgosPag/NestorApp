/**
 * Άγκυρες της **απόφασης** πλακιδίων: πόσο βαθιά, πόσα, και πόσο πυκνό πλέγμα παραμόρφωσης.
 *
 * Κάθε μία κλειδώνει μια συμπεριφορά που, αν χαλάσει, δεν σπάει τίποτα ορατά — απλώς ο χάρτης
 * γίνεται θολός, ή αργός, ή πλημμυρίζει τον πάροχο με αιτήματα. Δηλαδή ακριβώς οι βλάβες που
 * δεν πιάνονται κοιτώντας την οθόνη.
 */

import { BASEMAP_SOURCES } from '../basemap-source';
import { chooseZoomLevel, tilesForDisplayRect, MAX_TILES_PER_FRAME } from '../basemap-tile-model';
import { buildTileWarpMesh } from '../basemap-warp';
import { geographicToWorldMm } from '../basemap-projection';

const OSM = BASEMAP_SOURCES['osm-standard'];

/** Ένα display ορθογώνιο πλάτους `spanMm` γύρω από την Ακρόπολη (μη γεωαναφερμένο ⇒ display = world). */
function rectAroundAthens(spanMm: number) {
  const centre = geographicToWorldMm(37.9715, 23.7257);
  return {
    minX: centre.x - spanMm / 2, maxX: centre.x + spanMm / 2,
    minY: centre.y - spanMm / 2, maxY: centre.y + spanMm / 2,
  };
}

describe('επιλογή επιπέδου', () => {
  it('Τ1 — σε κλίμακα σχεδίου ζητείται το ΒΑΘΥΤΕΡΟ επίπεδο, και αυτό είναι το φυσιολογικό', () => {
    // 0,2 px/mm ⇒ 5 mm ανά εικονοστοιχείο. Το βαθύτερο επίπεδο του OSM δίνει ~0,22 m/px στην
    // Ελλάδα, άρα ΚΑΘΕ ρεαλιστική κλίμακα σχεδίου κτιρίου ζητά περισσότερη λεπτομέρεια απ' όση
    // υπάρχει. Η άγκυρα καταγράφει αυτό ως δηλωμένη κατάσταση: ο χάρτης είναι ήδη στο μέγιστο
    // πολύ πριν ο χρήστης πλησιάσει στο κτίριο — γι' αυτό ο έλεγχος της ΛΟΓΙΚΗΣ γίνεται στο Τ4,
    // σε κλίμακα μακριά από το ταβάνι.
    const z = chooseZoomLevel({ pixelsPerMm: 0.2, devicePixelRatio: 1, latitude: 38, source: OSM });
    expect(z).toBe(OSM.maxZoom);
  });

  it('Τ2 — όσο μικραίνει η κλίμακα, το επίπεδο ΔΕΝ αυξάνεται (μονότονο)', () => {
    const zoomed = chooseZoomLevel({ pixelsPerMm: 0.2, devicePixelRatio: 1, latitude: 38, source: OSM });
    const wide = chooseZoomLevel({ pixelsPerMm: 0.002, devicePixelRatio: 1, latitude: 38, source: OSM });
    expect(wide).toBeLessThan(zoomed);
  });

  it('Τ3 — ΠΟΤΕ πάνω από το βαθύτερο που σερβίρει ο πάροχος (αλλιώς βέβαιο 404)', () => {
    const z = chooseZoomLevel({ pixelsPerMm: 1000, devicePixelRatio: 3, latitude: 38, source: OSM });
    expect(z).toBe(OSM.maxZoom);
  });

  it('Τ4 — η πυκνότητα οθόνης μετράει: retina ζητά ΑΚΡΙΒΩΣ ένα επίπεδο βαθύτερα', () => {
    // Κλίμακα ~1 m/px, δηλαδή γύρω στο επίπεδο 17 — μακριά και από τα δύο άκρα, ώστε το
    // αποτέλεσμα να προέρχεται από τον υπολογισμό και όχι από τον περιορισμό.
    const base = { pixelsPerMm: 0.001, latitude: 38, source: OSM };
    const standard = chooseZoomLevel({ ...base, devicePixelRatio: 1 });
    const retina = chooseZoomLevel({ ...base, devicePixelRatio: 2 });
    expect(standard).toBeLessThan(OSM.maxZoom); // αλλιώς η άγκυρα θα μετρούσε ξανά το ταβάνι
    // Διπλάσια πυκνότητα = μισό μέτρο ανά εικονοστοιχείο = ακριβώς ένα βήμα επιπέδου.
    expect(retina).toBe(standard + 1);
  });
});

describe('ταβάνι πλήθους πλακιδίων', () => {
  it('Τ5 — μικρή περιοχή: κρατά το ζητούμενο επίπεδο και δεν μειώνει', () => {
    const selection = tilesForDisplayRect(rectAroundAthens(200_000), 18, null);
    expect(selection.zoom).toBe(18);
    expect(selection.reducedForBudget).toBe(false);
    expect(selection.tiles.length).toBeGreaterThan(0);
  });

  it('Τ6 — τεράστια περιοχή: ΚΑΤΕΒΑΖΕΙ επίπεδο αντί να κόψει τη λίστα', () => {
    // 400 km πλάτος στο βαθύτερο επίπεδο = εκατομμύρια πλακίδια.
    const selection = tilesForDisplayRect(rectAroundAthens(400_000_000), 19, null);
    expect(selection.reducedForBudget).toBe(true);
    expect(selection.zoom).toBeLessThan(19);
    expect(selection.tiles.length).toBeLessThanOrEqual(MAX_TILES_PER_FRAME);
  });

  it('Τ7 — ΚΑΝΕΝΑ επιστρεφόμενο πλακίδιο δεν είναι εκτός κόσμου', () => {
    const selection = tilesForDisplayRect(rectAroundAthens(400_000_000), 19, null);
    const max = 2 ** selection.zoom;
    for (const tile of selection.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(max);
      expect(tile.y).toBeLessThan(max);
    }
  });
});

describe('πλέγμα παραμόρφωσης', () => {
  it('Τ8 — οι κορυφές είναι (divisions+1)² και σε σειρά γραμμών', () => {
    const mesh = buildTileWarpMesh({ z: 18, x: 149_000, y: 101_000 }, null, 0.2);
    expect(mesh.vertices.length).toBe((mesh.divisions + 1) ** 2);
    expect(mesh.vertices[0].u).toBe(0);
    expect(mesh.vertices[0].v).toBe(0);
    expect(mesh.vertices[mesh.vertices.length - 1].u).toBe(1);
    expect(mesh.vertices[mesh.vertices.length - 1].v).toBe(1);
  });

  it('Τ9 — σε μεγάλη κλίμακα το πλέγμα ΠΥΚΝΩΝΕΙ (η ανοχή είναι σε εικονοστοιχεία)', () => {
    const tile = { z: 12, x: 2328, y: 1580 };
    const coarse = buildTileWarpMesh(tile, null, 0.000_01);
    const fine = buildTileWarpMesh(tile, null, 1);
    expect(fine.divisions).toBeGreaterThanOrEqual(coarse.divisions);
  });

  it('Τ10 — η υποδιαίρεση δεν ξεπερνά ποτέ το ταβάνι, όσο ακραία κι αν είναι η κλίμακα', () => {
    const mesh = buildTileWarpMesh({ z: 3, x: 4, y: 3 }, null, 10_000);
    expect(mesh.divisions).toBeLessThanOrEqual(8);
    expect(mesh.divisions).toBeGreaterThanOrEqual(1);
  });
});
