/**
 * ADR-716 Φ1 — η ΑΠΟΔΕΙΞΗ ως εκτελέσιμος φύλακας.
 *
 * Το κρίσιμο τεστ αυτού του αρχείου δεν είναι «περνάει το δείγμα» — είναι ο **λόγος Northing
 * του παραθύρου < 2,54** (ADR-716 §5.4). Όσο ισχύει αυτό, το πολύ ΜΙΑ μονάδα μπορεί να περάσει
 * την πύλη, άρα το αποτέλεσμα είναι ταυτοποίηση και όχι μαντεψιά — και μόνο γι' αυτόν τον λόγο
 * επιτρέπεται να νικά το `$INSUNITS`. Αν κάποιος διευρύνει το γεωγραφικό bbox τόσο ώστε ο λόγος
 * να ξεπεράσει το 2,54, **η απόδειξη καταρρέει και το τεστ κοκκινίζει πριν το commit**.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §5
 */

import {
  GREECE_GEOGRAPHIC_BBOX,
  GREEK_PROJECTED_GRID_ENVELOPE,
  PLAUSIBLE_DRAWING_EXTENT_M,
  identifyUnitsByGeodeticEnvelope,
  type GeodeticUnitCandidate,
} from '../projected-crs-envelopes';
import { geographicToGrid } from '../egsa87-projection';
import { sceneUnitsToMeters, type SceneUnits } from '../../../utils/scene-units';

/** Ο πλήρης πίνακας υποψηφίων, από τη SSoT μετατροπής — κανένας μαγικός αριθμός εδώ. */
const ALL_UNITS: readonly SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];
const CANDIDATES: readonly GeodeticUnitCandidate<SceneUnits>[] = ALL_UNITS.map(unit => ({
  unit,
  metresPerUnit: sceneUnitsToMeters(unit),
}));

/** Το πραγματικό extent του `47_ergasia.dxf` ($EXTMIN/$EXTMAX, ΕΓΣΑ87 μέτρα). */
const ERGASIA_47 = {
  min: { x: 407565.2907102597, y: 4502055.67106188 },
  max: { x: 408152.0910632098, y: 4502543.611061878 },
};

/** Πολλαπλασιάζει ένα extent — προσομοιώνει «το ίδιο σχέδιο, γραμμένο σε άλλη μονάδα». */
function scaleExtent(e: typeof ERGASIA_47, k: number): typeof ERGASIA_47 {
  return {
    min: { x: e.min.x * k, y: e.min.y * k },
    max: { x: e.max.x * k, y: e.max.y * k },
  };
}

describe('🔬 ADR-716 §5.4 — η απόδειξη μοναδικότητας, εκτελέσιμη', () => {
  it('ο λόγος Northing του παραθύρου είναι ΜΙΚΡΟΤΕΡΟΣ από τον λόγο in/cm = 2,54', () => {
    const { minN, maxN } = GREEK_PROJECTED_GRID_ENVELOPE;
    const northingRatio = maxN / minN;
    const smallestUnitRatio = sceneUnitsToMeters('in') / sceneUnitsToMeters('cm'); // 2,54

    expect(smallestUnitRatio).toBeCloseTo(2.54, 10);
    // 🔴 Αν αυτό σπάσει, ΔΕΝ χαλαρώνεται το κατώφλι: το παράθυρο διευρύνθηκε παράνομα.
    expect(northingRatio).toBeLessThan(smallestUnitRatio);
    // Γεωγραφικό γεγονός (η Ελλάδα εκτείνεται σε 7,3° πλάτους), όχι ρύθμιση.
    expect(northingRatio).toBeCloseTo(1.21, 2);
  });

  it('δύο υποψήφιες που περνούν αμφότερες ⇒ fail-closed (null), ποτέ «διάλεξε μία»', () => {
    // Τεχνητό ζεύγος με λόγο 1,02: το θεώρημα λέει ότι ΜΟΝΟ λόγοι < 1,21 μπορούν καν να είναι
    // διφορούμενοι — και μόνο για συγκεκριμένο y. Εδώ `y·1,02 = 4 592 096 < maxN`, άρα περνούν
    // όντως και οι δύο ⇒ ο κώδικας πρέπει να ΑΠΟΣΧΕΙ. (Καμία πραγματική μονάδα δεν έχει τέτοιον
    // λόγο — γι' αυτό ο κλάδος είναι αδύνατος στην πράξη, §5.4· κλειδώνεται ως δικλείδα.)
    const ambiguous: readonly GeodeticUnitCandidate<'a' | 'b'>[] = [
      { unit: 'a', metresPerUnit: 1 },
      { unit: 'b', metresPerUnit: 1.02 },
    ];
    expect(identifyUnitsByGeodeticEnvelope(ERGASIA_47, ambiguous)).toBeNull();
  });
});

describe('ADR-716 §5.3 — το παράθυρο είναι ΠΑΡΑΓΩΓΟ της υπάρχουσας προβολής', () => {
  it('τα άκρα του συμπίπτουν με ανεξάρτητες κλήσεις της geographicToGrid()', () => {
    const { minLat, maxLat, minLon, maxLon } = GREECE_GEOGRAPHIC_BBOX;
    // Transverse Mercator: το Easting απομακρύνεται από το 500k όσο μεγαλώνει το |Δλ| και
    // όσο μικραίνει το πλάτος ⇒ τα άκρα E βρίσκονται στη ΝΔ / ΝΑ γωνία.
    const swE = geographicToGrid(minLat, minLon).E;
    const seE = geographicToGrid(minLat, maxLon).E;
    expect(GREEK_PROJECTED_GRID_ENVELOPE.minE).toBeCloseTo(swE, 6);
    expect(GREEK_PROJECTED_GRID_ENVELOPE.maxE).toBeCloseTo(seE, 6);

    // Το Northing μεγιστοποιείται στο μεγαλύτερο πλάτος, μακριά από τον κεντρικό μεσημβρινό.
    expect(GREEK_PROJECTED_GRID_ENVELOPE.minN).toBeCloseTo(geographicToGrid(minLat, 24).N, 6);
    expect(GREEK_PROJECTED_GRID_ENVELOPE.maxN)
      .toBeCloseTo(Math.max(geographicToGrid(maxLat, minLon).N, geographicToGrid(maxLat, maxLon).N), 6);
  });

  it('καλύπτει ΕΓΣΑ87 + UTM 34N + UTM 35N με ΕΝΑ παράθυρο', () => {
    // Ίδιος τύπος TM, ίδιο k₀ = 0,9996, ίδιο FE = 500k, ίδιο ελλειψοειδές — αλλάζει ΜΟΝΟ ο
    // κεντρικός μεσημβρινός. Άρα UTM 34N (CM 21°) = geographicToGrid(lat, lon + 3) και
    // UTM 35N (CM 27°) = geographicToGrid(lat, lon − 3). Καμία δεύτερη προβολή.
    const env = GREEK_PROJECTED_GRID_ENVELOPE;
    const inside = ({ E, N }: { E: number; N: number }): boolean =>
      E >= env.minE && E <= env.maxE && N >= env.minN && N <= env.maxN;

    const zones = [
      { cmShift: +3, minLon: 19.3, maxLon: 24 },   // UTM 34N
      { cmShift: -3, minLon: 24, maxLon: 28.5 },   // UTM 35N
    ];
    for (const zone of zones) {
      for (let lat = GREECE_GEOGRAPHIC_BBOX.minLat; lat <= GREECE_GEOGRAPHIC_BBOX.maxLat; lat += 0.5) {
        for (let lon = zone.minLon; lon <= zone.maxLon; lon += 0.5) {
          expect(inside(geographicToGrid(lat, lon + zone.cmShift))).toBe(true);
        }
      }
    }
  });
});

describe('ADR-716 §5.5 — το πραγματικό δείγμα: ακριβώς ΜΙΑ υποψήφια περνά', () => {
  it('ταυτοποιεί ΜΕΤΡΑ στο 47_ergasia.dxf', () => {
    expect(identifyUnitsByGeodeticEnvelope(ERGASIA_47, CANDIDATES)).toBe('m');
  });

  it('κάθε άλλη υποψήφια κόβεται από τη θέση Ή από το μέγεθος', () => {
    const survivors = ALL_UNITS.filter(unit =>
      identifyUnitsByGeodeticEnvelope(ERGASIA_47, [{ unit, metresPerUnit: sceneUnitsToMeters(unit) }]) === unit,
    );
    expect(survivors).toEqual(['m']);
  });

  it('το «ft» περνά το Easting αλλά κόβεται από το Northing — όπως προβλέπει η §5.4', () => {
    const ftScale = sceneUnitsToMeters('ft');
    const env = GREEK_PROJECTED_GRID_ENVELOPE;
    const easting = ERGASIA_47.min.x * ftScale;
    const northing = ERGASIA_47.min.y * ftScale;
    expect(easting).toBeGreaterThanOrEqual(env.minE);
    expect(easting).toBeLessThanOrEqual(env.maxE);
    // 4 502 055 ft = 1 372 227 m — πολύ ΝΟΤΙΟΤΕΡΑ της Ελλάδας (ύψος Σαχάρας). Το Northing
    // είναι η πύλη που κόβει· ακριβώς ο άξονας πάνω στον οποίο στηρίζεται η απόδειξη §5.4.
    expect(northing).toBeLessThan(env.minN);
  });
});

describe('ADR-716 §5.6 — fail-closed: «απέχω» όταν δεν αποδεικνύεται', () => {
  it('πολλαπλασιαστής που ΔΕΝ είναι λόγος μονάδων (×7) ⇒ null — δεν «ταιριάζει σε όλα»', () => {
    // Η ουσιώδης δικλείδα κατά του λαστιχένιου μηχανισμού: μόνο οι πραγματικοί λόγοι μονάδων
    // μπορούν να φέρουν το extent μέσα στο παράθυρο. Οτιδήποτε ενδιάμεσο ⇒ απέχω.
    // ⚠️ Οι πολλαπλασιαστές πρέπει να απέχουν από ΚΑΘΕ λόγο ζεύγους μονάδων: το ×3,3 π.χ.
    // ταυτοποιείται (ορθά) ως 'ft', γιατί 1/0,3048 = 3,2808 — απόκλιση μόλις 0,6%.
    for (const k of [5, 7, 0.4, 250]) {
      expect(identifyUnitsByGeodeticEnvelope(scaleExtent(ERGASIA_47, k), CANDIDATES)).toBeNull();
    }
  });

  it('⚠️ διόρθωση ADR §11.1: το ×100 ΤΑΥΤΟΠΟΙΕΙΤΑΙ ως cm — και αυτή είναι η ΣΩΣΤΗ απάντηση', () => {
    // Το ×100 ΕΙΝΑΙ ο λόγος cm/m και το ×1000 ο λόγος mm/m. Ένα ελληνικό τοπογραφικό με
    // $EXTMIN = 40 756 529 είναι όντως γραμμένο σε εκατοστά — και η ταυτοποίηση οφείλει να το
    // πει. Η γραμμή «×100/×1000 δεν ταυτοποιούνται» του ADR ήταν αριθμητικά αδύνατη· η
    // συν-μεταβλητότητα με την κλίμακα ΕΙΝΑΙ ο μηχανισμός, όχι αστοχία του.
    expect(identifyUnitsByGeodeticEnvelope(scaleExtent(ERGASIA_47, 100), CANDIDATES)).toBe('cm');
    expect(identifyUnitsByGeodeticEnvelope(scaleExtent(ERGASIA_47, 1000), CANDIDATES)).toBe('mm');
  });

  it('κάτοψη κτιρίου κοντά στο (0,0) ⇒ null (μηδέν regression στη συντριπτική πλειοψηφία)', () => {
    const floorplan = { min: { x: 0, y: 0 }, max: { x: 40_000, y: 30_000 } };
    expect(identifyUnitsByGeodeticEnvelope(floorplan, CANDIDATES)).toBeNull();
  });

  it('αρνητικές / μη-πεπερασμένες συντεταγμένες ⇒ null', () => {
    expect(identifyUnitsByGeodeticEnvelope(
      { min: { x: -407_565, y: -4_502_055 }, max: { x: -407_000, y: -4_502_000 } }, CANDIDATES,
    )).toBeNull();
    expect(identifyUnitsByGeodeticEnvelope(
      { min: { x: NaN, y: 0 }, max: { x: 1, y: 1 } }, CANDIDATES,
    )).toBeNull();
    expect(identifyUnitsByGeodeticEnvelope(null, CANDIDATES)).toBeNull();
  });

  it('σωστή ΘΕΣΗ αλλά παράλογο ΜΕΓΕΘΟΣ ⇒ null (η πύλη μεγέθους, §5.2)', () => {
    // Εκφυλισμένο κουτί μέσα στο παράθυρο: διαγώνιος 0,14 m < 1 m ⇒ δεν είναι σχέδιο.
    const speck = {
      min: { x: 407_565.29, y: 4_502_055.67 },
      max: { x: 407_565.39, y: 4_502_055.77 },
    };
    expect(identifyUnitsByGeodeticEnvelope(speck, CANDIDATES)).toBeNull();
    expect(PLAUSIBLE_DRAWING_EXTENT_M.min).toBe(1);
  });
});
