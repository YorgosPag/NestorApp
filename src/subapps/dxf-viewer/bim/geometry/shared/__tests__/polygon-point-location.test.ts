/**
 * ADR-730 — σημασιολογία «μέσα στο πολύγωνο»: interior / boundary / exterior.
 *
 * ⚠️ Πριν από αυτά, **κανένα** test σε ΟΛΟ το repo δεν έλεγχε σημείο πάνω σε ακμή ή κορυφή
 * (επαληθεύτηκε με grep 2026-07-29) — γι' αυτό το ψέμα του σχολίου («μέσα ή στην ακμή») έζησε
 * χρόνια και διαδόθηκε αυτούσιο στον τοπογραφικό καταναλωτή.
 *
 * Ο §"ΤΟ ΨΕΜΑ" παρακάτω είναι **άγκυρα οπισθοδρόμησης**: καρφώνει τη μετρημένη *αυθαιρεσία* του
 * ωμού `pointInPolygon` στο σύνορο. Αν κάποιος «διορθώσει» το ωμό, αυτά τα tests θα ανάψουν και
 * θα τον στείλουν εδώ να διαβάσει γιατί το ωμό πρέπει να μείνει ωμό (fill rules).
 */

import {
  locatePointInPolygon,
  pointInPolygonCovers,
  pointInPolygonWithin,
  DEFAULT_BOUNDARY_TOLERANCE_MM,
  pointInPolygon,
} from '../polygon-utils';

/** Τετράγωνο 10 m × 10 m σε canonical mm, CCW από την αρχή. */
const SQUARE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 10_000 },
  { x: 0, y: 10_000 },
] as const;

/**
 * Γ-σχήμα (κοίλο) σε mm — η ανακλαστική (reflex) κορυφή είναι η (4000, 4000).
 * Το κοίλο είναι απαραίτητο: το σύνορο εκεί «γυρίζει μέσα» και ένας αφελής έλεγχος συνόρου
 * που κοιτάει μόνο το κυρτό περίβλημα θα το έχανε.
 */
const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 4_000 },
  { x: 4_000, y: 4_000 },
  { x: 4_000, y: 10_000 },
  { x: 0, y: 10_000 },
] as const;

const EXACT = { boundaryToleranceMm: 0 } as const;

describe('locatePointInPolygon — εσωτερικό / εξωτερικό', () => {
  it('γνήσια εντός → interior', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 5_000 }, SQUARE)).toBe('interior');
  });

  it('γνήσια εκτός → exterior', () => {
    expect(locatePointInPolygon({ x: 50_000, y: 5_000 }, SQUARE)).toBe('exterior');
    expect(locatePointInPolygon({ x: 5_000, y: -50_000 }, SQUARE)).toBe('exterior');
  });

  it('εκφυλισμένο πολύγωνο (< 3 κορυφές) → exterior', () => {
    expect(locatePointInPolygon({ x: 0, y: 0 }, [])).toBe('exterior');
    expect(locatePointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe('exterior');
  });
});

describe('locatePointInPolygon — ΚΟΡΥΦΕΣ (η κλάση που έσπαγε)', () => {
  it.each([
    ['κάτω-αριστερά', 0],
    ['κάτω-δεξιά', 1],
    ['πάνω-δεξιά', 2],
    ['πάνω-αριστερά', 3],
  ])('και οι 4 κορυφές → boundary (%s)', (_label, index) => {
    expect(locatePointInPolygon(SQUARE[index], SQUARE)).toBe('boundary');
  });

  it('ανακλαστική κορυφή κοίλου πολυγώνου → boundary', () => {
    expect(locatePointInPolygon({ x: 4_000, y: 4_000 }, L_SHAPE)).toBe('boundary');
  });
});

describe('locatePointInPolygon — ΑΚΜΕΣ', () => {
  it('μέσο οριζόντιας ακμής → boundary', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 0 }, SQUARE)).toBe('boundary');
  });

  it('μέσο κατακόρυφης ακμής → boundary', () => {
    expect(locatePointInPolygon({ x: 0, y: 5_000 }, SQUARE)).toBe('boundary');
  });

  it('μέσο κεκλιμένης ακμής → boundary', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10_000, y: 0 }, { x: 0, y: 10_000 }];
    expect(locatePointInPolygon({ x: 5_000, y: 5_000 }, tri)).toBe('boundary');
  });

  it('ακμή που «γυρίζει μέσα» σε κοίλο σχήμα → boundary', () => {
    expect(locatePointInPolygon({ x: 4_000, y: 7_000 }, L_SHAPE)).toBe('boundary');
  });

  it('η εγκοπή του Γ παραμένει exterior — η ανοχή ΔΕΝ γεμίζει το κοίλο', () => {
    expect(locatePointInPolygon({ x: 7_000, y: 7_000 }, L_SHAPE)).toBe('exterior');
  });
});

describe('locatePointInPolygon — η ζώνη ανοχής (προεπιλογή 1 mm)', () => {
  it('η προεπιλογή είναι το πρότυπο XY tolerance του ArcGIS: 1 mm', () => {
    expect(DEFAULT_BOUNDARY_TOLERANCE_MM).toBe(1);
  });

  it('0,5 mm ΜΕΣΑ από την ακμή → boundary', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 0.5 }, SQUARE)).toBe('boundary');
  });

  it('0,5 mm ΕΞΩ από την ακμή → boundary', () => {
    expect(locatePointInPolygon({ x: 5_000, y: -0.5 }, SQUARE)).toBe('boundary');
  });

  it('ακριβώς στην ανοχή (1 mm) → boundary — το όριο είναι κλειστό', () => {
    expect(locatePointInPolygon({ x: 5_000, y: -1 }, SQUARE)).toBe('boundary');
  });

  it('2 mm μέσα → interior (πέρα από την ανοχή)', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 2 }, SQUARE)).toBe('interior');
  });

  it('2 mm έξω → exterior (πέρα από την ανοχή)', () => {
    expect(locatePointInPolygon({ x: 5_000, y: -2 }, SQUARE)).toBe('exterior');
  });

  it('0,5 mm διαγώνια έξω από ΚΟΡΥΦΗ → boundary (η ζώνη τυλίγει και τις γωνίες)', () => {
    expect(locatePointInPolygon({ x: -0.3, y: -0.3 }, SQUARE)).toBe('boundary');
  });

  it('ρητή μεγαλύτερη ανοχή μετακινεί τη ζώνη', () => {
    const p = { x: 5_000, y: -40 };
    expect(locatePointInPolygon(p, SQUARE)).toBe('exterior');
    expect(locatePointInPolygon(p, SQUARE, { boundaryToleranceMm: 50 })).toBe('boundary');
  });
});

describe('locatePointInPolygon — ανοχή 0 εκφυλίζεται ΑΚΡΙΒΩΣ στη σημασιολογία του JTS', () => {
  it('ακριβής κορυφή → boundary ακόμη και με μηδενική ανοχή', () => {
    expect(locatePointInPolygon(SQUARE[1], SQUARE, EXACT)).toBe('boundary');
  });

  it('ακριβές μέσο ακμής → boundary ακόμη και με μηδενική ανοχή', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 0 }, SQUARE, EXACT)).toBe('boundary');
  });

  it('0,5 mm από την ακμή → ΟΧΙ boundary (καμία ζώνη)', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 0.5 }, SQUARE, EXACT)).toBe('interior');
    expect(locatePointInPolygon({ x: 5_000, y: -0.5 }, SQUARE, EXACT)).toBe('exterior');
  });

  it('αρνητική / μη-πεπερασμένη ανοχή αντιμετωπίζεται ως 0, ποτέ ως NaN', () => {
    const halfMmIn = { x: 5_000, y: 0.5 };
    expect(locatePointInPolygon(halfMmIn, SQUARE, { boundaryToleranceMm: -5 })).toBe('interior');
    expect(locatePointInPolygon(halfMmIn, SQUARE, { boundaryToleranceMm: NaN })).toBe('interior');
    expect(locatePointInPolygon(SQUARE[0], SQUARE, { boundaryToleranceMm: NaN })).toBe('boundary');
  });

  it('undefined ⇒ προεπιλογή (ΟΧΙ 0)', () => {
    expect(locatePointInPolygon({ x: 5_000, y: 0.5 }, SQUARE, {})).toBe('boundary');
  });
});

describe('παράγωγα κατηγορήματα — covers vs within', () => {
  const vertex = SQUARE[0];
  const centre = { x: 5_000, y: 5_000 };
  const outside = { x: -5_000, y: 5_000 };

  it('covers = interior ∪ boundary', () => {
    expect(pointInPolygonCovers(centre, SQUARE)).toBe(true);
    expect(pointInPolygonCovers(vertex, SQUARE)).toBe(true);
    expect(pointInPolygonCovers(outside, SQUARE)).toBe(false);
  });

  it('within = ΜΟΝΟ interior — το σύνορο αποκλείεται ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ', () => {
    expect(pointInPolygonWithin(centre, SQUARE)).toBe(true);
    expect(pointInPolygonWithin(vertex, SQUARE)).toBe(false);
    expect(pointInPolygonWithin(outside, SQUARE)).toBe(false);
  });

  it('covers ≠ within ΑΚΡΙΒΩΣ στο σύνορο, πουθενά αλλού', () => {
    for (const p of [centre, outside, { x: 5_000, y: 2 }, { x: 5_000, y: -2 }]) {
      expect(pointInPolygonCovers(p, SQUARE)).toBe(pointInPolygonWithin(p, SQUARE));
    }
    for (const p of [...SQUARE, { x: 5_000, y: 0 }, { x: 0, y: 5_000 }]) {
      expect(pointInPolygonCovers(p, SQUARE)).toBe(true);
      expect(pointInPolygonWithin(p, SQUARE)).toBe(false);
    }
  });
});

describe('ΤΟ ΨΕΜΑ — η μετρημένη αυθαιρεσία του ωμού pointInPolygon στο σύνορο', () => {
  /**
   * 🔴 Αυτό ΔΕΝ είναι επιθυμητή συμπεριφορά — είναι **τεκμηρίωση** του γιατί χρειάστηκε το
   * ADR-730. Στο ΙΔΙΟ τετράγωνο, ο ωμός έλεγχος απαντά `true` για μία κορυφή και `false` για
   * τις άλλες τρεις, επειδή ο half-open κανόνας `yi > y !== yj > y` σπάει την ισοπαλία προς
   * μία μόνο κατεύθυνση. Καμία από τις δύο απαντήσεις δεν είναι «σωστή»: το ερώτημα είναι
   * κακώς ορισμένο για boolean.
   */
  it('ο ωμός έλεγχος δίνει ΔΙΑΦΟΡΕΤΙΚΗ απάντηση σε κορυφές του ΙΔΙΟΥ τετραγώνου', () => {
    const answers = SQUARE.map((v) => pointInPolygon(v, SQUARE));
    expect(answers).toEqual([true, false, false, false]);
    expect(new Set(answers).size).toBe(2); // δηλαδή: ασυνεπής
  });

  it('η νέα συνάρτηση απαντά ΤΟ ΙΔΙΟ και για τις 4 — αυτό είναι όλη η διόρθωση', () => {
    expect(SQUARE.map((v) => locatePointInPolygon(v, SQUARE))).toEqual(
      ['boundary', 'boundary', 'boundary', 'boundary'],
    );
  });

  it('μακριά από το σύνορο, ωμό και νέο συμφωνούν απόλυτα', () => {
    for (const p of [{ x: 5_000, y: 5_000 }, { x: 100, y: 9_900 }, { x: -1, y: -1_000 }]) {
      expect(pointInPolygon(p, SQUARE)).toBe(pointInPolygonWithin(p, SQUARE));
    }
  });
});

describe('μεγέθη ΕΓΣΑ — η ανοχή του 1 mm επιβιώνει σε συντεταγμένες ~5·10⁸ mm', () => {
  /**
   * Το τοπογραφικό τρέχει σε LOCAL frame (ADR-650 M1) ακριβώς για να αποφύγει τέτοια μεγέθη,
   * αλλά ο SSoT δεν το επιβάλλει — άρα το μετράμε αντί να το υποθέσουμε. Στα 5·10⁸ mm το ulp
   * του float64 είναι ~10⁻⁷ mm, δηλαδή 7 τάξεις κάτω από την ανοχή: η ζώνη του 1 mm παραμένει
   * ευκρινής και η διαφορά ΜΕΣΑ/ΕΞΩ δεν καταρρέει.
   */
  const E = 4_700_000_000; // ~470 km σε mm (τάξη ΕΓΣΑ'87 easting)
  const N = 4_200_000_000;
  const FAR_SQUARE = [
    { x: E, y: N },
    { x: E + 10_000, y: N },
    { x: E + 10_000, y: N + 10_000 },
    { x: E, y: N + 10_000 },
  ] as const;

  it('κορυφή σε μέγεθος ΕΓΣΑ → boundary', () => {
    expect(locatePointInPolygon(FAR_SQUARE[2], FAR_SQUARE)).toBe('boundary');
  });

  it('0,5 mm από την ακμή → boundary· 2 mm → interior/exterior', () => {
    expect(locatePointInPolygon({ x: E + 5_000, y: N - 0.5 }, FAR_SQUARE)).toBe('boundary');
    expect(locatePointInPolygon({ x: E + 5_000, y: N + 2 }, FAR_SQUARE)).toBe('interior');
    expect(locatePointInPolygon({ x: E + 5_000, y: N - 2 }, FAR_SQUARE)).toBe('exterior');
  });
});
