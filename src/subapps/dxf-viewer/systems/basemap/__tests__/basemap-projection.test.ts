/**
 * Βαθμονόμηση της αλυσίδας «πλακίδιο χάρτη → χαρτί σχεδίου».
 *
 * ## Γιατί δεν αρκεί κύκλος μετάβασης-επιστροφής
 * Ένας κύκλος `f(f⁻¹(x)) === x` περνά **πράσινος** ακόμη κι όταν και οι δύο κατευθύνσεις είναι
 * λάθος με τον ίδιο τρόπο — π.χ. αν η μετάθεση datum παραλειφθεί και στις δύο. Το αποθετήριο
 * έχει ονομάσει αυτό το σχήμα: «0 = κανείς δεν κοίταξε». Γι' αυτό εδώ υπάρχουν **και** αγκυρώσεις
 * σε ανεξάρτητα γνωστές τιμές, **και** ρητή μέτρηση του μεγέθους της μετάθεσης.
 */

import { ggrs87ToWgs84, wgs84ToGgrs87 } from '../../geo-referencing/ggrs87-datum';
import { geographicToGrid, gridToGeographic } from '../../geo-referencing/egsa87-projection';
import { geographicToWorldMm, worldMmToGeographic } from '../basemap-projection';
import {
  geographicToTileFraction,
  groundResolutionM,
  tileFractionToGeographic,
} from '../web-mercator';

/** Απόσταση δύο γεωγραφικών σημείων σε μέτρα (τοπικά επίπεδη προσέγγιση — αρκεί για μέτρα). */
function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const metresPerDegLat = 111_132;
  const metresPerDegLon = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * metresPerDegLat, (a.lon - b.lon) * metresPerDegLon);
}

describe('μετάθεση datum GGRS87 ↔ WGS84', () => {
  it('Μ1 — ΔΕΝ είναι ταυτοτική, και το μέγεθος είναι ΕΚΑΤΟΝΤΑΔΕΣ μέτρα', () => {
    // Ακρόπολη, Αθήνα.
    const shifted = ggrs87ToWgs84(37.9715, 23.7257);
    const drift = metresBetween({ lat: 37.9715, lon: 23.7257 }, shifted);

    // 🔴 Το σχόλιο του module έγραφε αρχικά «~2-6 m». ΛΑΘΟΣ: μετρήθηκε **324,86 m**. Η μετάθεση
    // των 326 m πέφτει σχεδόν ολόκληρη οριζόντια στο πλάτος της Ελλάδας. Το εύρος εδώ είναι
    // στενό επίτηδες: πιάνει και την παράλειψη της μετάθεσης (→ 0) και ένα ανάποδο πρόσημο
    // (→ ~650 m), που είναι οι δύο τρόποι να χαλάσει αυτό το αρχείο.
    expect(drift).toBeGreaterThan(250);
    expect(drift).toBeLessThan(400);
  });

  it('Μ2 — κύκλος μετάβασης-επιστροφής κλείνει, ΟΤΑΝ διαδίδεται το ύψος', () => {
    const origin = { lat: 37.9715, lon: 23.7257, height: 0 };
    const forward = ggrs87ToWgs84(origin.lat, origin.lon, origin.height);
    const roundTrip = wgs84ToGgrs87(forward.lat, forward.lon, forward.height);
    // Αποδεικνύει τα ΜΑΘΗΜΑΤΙΚΑ: με το ύψος στη θέση του, ο κύκλος κλείνει στα όρια της
    // αριθμητικής διπλής ακρίβειας — όχι σε κάποια ανοχή που διαλέξαμε.
    expect(metresBetween(origin, roundTrip)).toBeLessThan(1e-6);
    expect(roundTrip.height).toBeCloseTo(0, 6);
  });

  it('Μ2β — πετώντας το ύψος, το υπολειπόμενο είναι ~1,6 mm· δηλωμένο, όχι κρυμμένο', () => {
    const origin = { lat: 37.9715, lon: 23.7257 };
    const forward = ggrs87ToWgs84(origin.lat, origin.lon);
    // Η αλυσίδα του υποβάθρου ΔΕΝ κουβαλά ύψος (ένα πλακίδιο χάρτη δεν έχει). Αυτό είναι το
    // τίμημα, μετρημένο. Αν ξεπεράσει ποτέ το εκατοστό, κάποιος πείραξε τα ελλειψοειδή.
    const roundTrip = wgs84ToGgrs87(forward.lat, forward.lon, 0);
    const residual = metresBetween(origin, roundTrip);
    expect(residual).toBeGreaterThan(0);
    expect(residual).toBeLessThan(0.01);
  });
});

describe('προβολή ΕΓΣΑ87', () => {
  it('Μ3 — στον κεντρικό μεσημβρινό (24°Ε) το Easting είναι το ψευδές, 500.000', () => {
    const grid = geographicToGrid(38, 24);
    expect(grid.E).toBeCloseTo(500_000, 3);
  });

  it('Μ4 — κύκλος γεωγραφικές ↔ κάνναβος κλείνει', () => {
    const grid = geographicToGrid(37.9715, 23.7257);
    const back = gridToGeographic(grid.E, grid.N);
    expect(back.lat).toBeCloseTo(37.9715, 9);
    expect(back.lon).toBeCloseTo(23.7257, 9);
  });
});

describe('πλέγμα Web Mercator', () => {
  it('Μ5 — το επίπεδο 0 είναι ένα πλακίδιο και το κέντρο του πέφτει στο (0°, 0°)', () => {
    const centre = tileFractionToGeographic(0.5, 0.5, 0);
    expect(centre.lat).toBeCloseTo(0, 9);
    expect(centre.lon).toBeCloseTo(0, 9);
  });

  it('Μ6 — κύκλος γεωγραφικές ↔ θέση πλέγματος κλείνει', () => {
    const fraction = geographicToTileFraction(37.9715, 23.7257, 18);
    const back = tileFractionToGeographic(fraction.tx, fraction.ty, 18);
    expect(back.lat).toBeCloseTo(37.9715, 9);
    expect(back.lon).toBeCloseTo(23.7257, 9);
  });

  it('Μ7 — η ανάλυση εδάφους περιλαμβάνει τον όρο cos(φ)· χωρίς αυτόν η επιλογή επιπέδου αστοχεί', () => {
    const atEquator = groundResolutionM(0, 18, 256);
    const inGreece = groundResolutionM(38, 18, 256);
    // cos(38°) ≈ 0,788 — η διαφορά είναι ~21%, δηλαδή πάνω από ένα ολόκληρο βήμα επιπέδου.
    expect(inGreece / atEquator).toBeCloseTo(Math.cos((38 * Math.PI) / 180), 6);
  });
});

describe('ολόκληρη η αλυσίδα', () => {
  it('Μ8 — WGS84 → κόσμος (ΕΓΣΑ mm) → WGS84 κλείνει κάτω από το εκατοστό', () => {
    const world = geographicToWorldMm(37.9715, 23.7257);
    const back = worldMmToGeographic(world.x, world.y);
    // Το κατώφλι είναι το εκατοστό και όχι το χιλιοστό επειδή η αλυσίδα δεν κουβαλά ύψος —
    // δες `Μ2β`, όπου το ίδιο υπολειπόμενο μετριέται απομονωμένο. Για υπόβαθρο χάρτη σε
    // πλακίδια των ~30 cm/pixel στο βαθύτερο επίπεδο, είναι τέσσερις τάξεις κάτω από το ορατό.
    expect(metresBetween({ lat: 37.9715, lon: 23.7257 }, back)).toBeLessThan(0.01);
  });

  it('Μ9 — ο κόσμος βγαίνει σε canonical mm, δηλαδή τάξη 10⁸ για την Ελλάδα', () => {
    const world = geographicToWorldMm(37.9715, 23.7257);
    // Easting ~476 km ⇒ ~4,76·10⁸ mm· Northing ~4.203 km ⇒ ~4,2·10⁹ mm.
    expect(world.x).toBeGreaterThan(4e8);
    expect(world.x).toBeLessThan(6e8);
    expect(world.y).toBeGreaterThan(4e9);
    expect(world.y).toBeLessThan(5e9);
  });

  it('Μ10 — η αλυσίδα ΠΕΡΝΑ από τη μετάθεση datum (αλλιώς η Μ1 θα ήταν διακοσμητική)', () => {
    // Ίδιο σημείο, με και χωρίς μετάθεση. Αν η αλυσίδα την παρέκαμπτε, οι δύο θα ταυτίζονταν.
    const withDatum = geographicToWorldMm(37.9715, 23.7257);
    const withoutDatum = geographicToGrid(37.9715, 23.7257);
    const deltaMm = Math.hypot(withDatum.x - withoutDatum.E * 1000, withDatum.y - withoutDatum.N * 1000);
    expect(deltaMm).toBeGreaterThan(1_000); // πάνω από ένα μέτρο
  });
});
