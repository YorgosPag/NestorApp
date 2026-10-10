/**
 * @fileoverview 🏢 **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΠΥΡΗΝΑ ΤΗΣ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ** — κάδρο, κανονικοποίηση περιγράμματος, λεξιλόγιο (ADR-907 §11).
 * @related lib/listings/floor-plate/floor-plate-outline · lib/listings/floor-plate/floor-plate-state
 *
 *   Κ1 — κάδρο: ανεβασμένη εικόνα ⇒ `{0,0,W,H}` · λήψη ⇒ το κάδρο της συνταγής · αλλοιωμένη συνταγή ⇒ τίποτα;
 *   Κ2 — γνωστό κάδρο ⇒ γνωστές κορυφές, με το Y **αναποδογυρισμένο** και την έξοδο **επίπεδη**;
 *   Κ3 — τα πραγματικά δεδομένα της Υ2 (§11.1) βγάζουν τα μετρημένα κλάσματα;
 *   Κ4 — περίγραμμα εκτός κάδρου ⇒ απόρριψη, ποτέ σφήνωμα · θόρυβος πάνω στην ακμή συγχωρείται;
 *   Κ5 — λίγες / πολλές / μη πεπερασμένες κορυφές και εκφυλισμένο σχήμα ⇒ ονομασμένη άρνηση;
 *   Κ6 — ο αναγνώστης του επισκέπτη δέχεται ό,τι έγραψε ο γραφέας και αρνείται κάθε σκουπίδι;
 *   Σ  — κρίκος 19: παλιό έγγραφο αποκτά κενό `floorPlates`, ιδιοδύναμα, χωρίς να χάσει ό,τι ήδη είχε;
 *   Λ1 — κάθε εμπορική κατάσταση έχει δημόσια όψη, και **μόνο** οι τρεις «στην αγορά» είναι `available`;
 *   Λ2 — αδήλωτη / άγνωστη κατάσταση ⇒ `unavailable`, ποτέ `available`;
 *   Λ3 — το `self` είναι μέρος του λεξιλογίου του πεδίου, αλλά **ποτέ** αποτέλεσμα εμπορικής κατάστασης;
 *
 * ⛔ **ΜΕΤΑΛΛΑΞΕΙΣ** *(προβλεπόμενες — εκτελούνται στο κλείσιμο της φάσης, ADR-907 §10.11)*: (α) `v = (y − minY) / ΔY` (χωρίς αναστροφή) ⇒ Κ2/Κ3 κοκκινίζουν · (β) σφήνωμα αντί απόρριψης στο
 *   `fractionOf` ⇒ Κ4 · (γ) `sold: 'available'` ⇒ Λ1 · (δ) άγνωστο ⇒ `'available'` ⇒ Λ2 · (ε) χωρίς έλεγχο λόγου πλευρών
 *   στη λήψη ⇒ Κ1 · (στ) `[x, y]` ζεύγη αντί επίπεδου πίνακα ⇒ Κ2.
 */

import { COMMERCIAL_STATUSES, LISTED_COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import {
  FLOOR_PLATE_OUTLINE_MAX_VERTICES,
  floorPlateFrameOf,
  normalizeFloorPlateOutline,
  readFloorPlateOutline,
  type FloorPlateFrame,
} from '@/lib/listings/floor-plate/floor-plate-outline';
import { PUBLIC_LISTING_SCHEMA_VERSION, upgradeListingDocument } from '@/lib/listings/public-listing-schema';
import {
  FLOOR_PLATE_NEIGHBOUR_STATES,
  FLOOR_PLATE_SELF_STATE,
  FLOOR_PLATE_STATES,
  floorPlateNeighbourState,
  isFloorPlateState,
} from '@/lib/listings/floor-plate/floor-plate-state';

const FRAME: FloorPlateFrame = { minX: 100, minY: 200, maxX: 500, maxY: 400 };

const outlineOf = (vertices: readonly { x: number; y: number }[], frame: FloorPlateFrame = FRAME) => {
  const reading = normalizeFloorPlateOutline(vertices, frame);
  if (!reading.ok) throw new Error(`refused: ${reading.why}`);
  return reading.outline;
};

const refusalOf = (vertices: readonly { x: number; y: number }[], frame: FloorPlateFrame = FRAME) => {
  const reading = normalizeFloorPlateOutline(vertices, frame);
  return reading.ok ? null : reading.why;
};

describe('Κ1 — το κάδρο της εικόνας', () => {
  it('ανεβασμένη εικόνα ⇒ τα φυσικά pixels, από το μηδέν', () => {
    expect(floorPlateFrameOf({ kind: 'upload', widthPx: 3000, heightPx: 2000 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 3000,
      maxY: 2000,
    });
  });

  it.each([
    [0, 2000],
    [3000, 0],
    [-1, 2000],
    [Number.NaN, 2000],
    [3000, Number.POSITIVE_INFINITY],
  ])('ανεβασμένη εικόνα %p × %p ⇒ κανένα κάδρο', (widthPx, heightPx) => {
    expect(floorPlateFrameOf({ kind: 'upload', widthPx, heightPx })).toBeNull();
  });

  it('λήψη ⇒ το κάδρο της συνταγής, αυτούσιο', () => {
    const frame = { minX: -50, minY: -25, maxX: 150, maxY: 75 }; // 200 × 100 ⇒ 2:1
    expect(floorPlateFrameOf({ kind: 'capture', recipe: { frame, widthPx: 4096, heightPx: 2048 } })).toBe(frame);
  });

  it('λήψη με κάδρο άλλου λόγου πλευρών από τα pixels ⇒ αλλοιωμένη συνταγή, κανένα κάδρο', () => {
    const frame = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    expect(floorPlateFrameOf({ kind: 'capture', recipe: { frame, widthPx: 4096, heightPx: 3000 } })).toBeNull();
  });

  it('λήψη: η στρογγύλευση της κοντής πλευράς σε ακέραιο pixel ΔΕΝ είναι αλλοίωση', () => {
    // Το σχέδιο της Υ2: 36458,33 × 26041,67 ⇒ 4096 × 2925,71… ⇒ η μηχανή γράφει 2926.
    const frame = { minX: 0, minY: 0, maxX: 36458.3333333333, maxY: 26041.6666666667 };
    expect(floorPlateFrameOf({ kind: 'capture', recipe: { frame, widthPx: 4096, heightPx: 2926 } })).toBe(frame);
  });

  it('λήψη με ανάποδο ή μηδενικό κάδρο ⇒ κανένα κάδρο', () => {
    const flipped = { minX: 200, minY: 0, maxX: 0, maxY: 100 };
    const flat = { minX: 0, minY: 50, maxX: 200, maxY: 50 };
    expect(floorPlateFrameOf({ kind: 'capture', recipe: { frame: flipped, widthPx: 400, heightPx: 200 } })).toBeNull();
    expect(floorPlateFrameOf({ kind: 'capture', recipe: { frame: flat, widthPx: 400, heightPx: 200 } })).toBeNull();
  });
});

describe('Κ2 — γνωστό κάδρο ⇒ γνωστές κορυφές', () => {
  it('το Y αναποδογυρίζει: η ΠΑΝΩ ακμή του σχεδίου είναι το 0 της εικόνας', () => {
    // Τρίγωνο: κάτω-αριστερή γωνία του κάδρου, κάτω-δεξιά, πάνω-αριστερή.
    expect(
      outlineOf([
        { x: 100, y: 200 },
        { x: 500, y: 200 },
        { x: 100, y: 400 },
      ]),
    ).toEqual([0, 1, 1, 1, 0, 0]);
  });

  it('η έξοδος είναι ΕΠΙΠΕΔΗ (x0, y0, x1, y1, …) — κανένας πίνακας μέσα σε πίνακα', () => {
    const outline = outlineOf([
      { x: 200, y: 250 },
      { x: 400, y: 250 },
      { x: 400, y: 350 },
      { x: 200, y: 350 },
    ]);
    expect(outline).toEqual([0.25, 0.75, 0.75, 0.75, 0.75, 0.25, 0.25, 0.25]);
    expect(outline.every((value) => typeof value === 'number')).toBe(true);
  });

  it('η επανάληψη της πρώτης κορυφής στο τέλος πέφτει', () => {
    const closed = outlineOf([
      { x: 200, y: 250 },
      { x: 400, y: 250 },
      { x: 400, y: 350 },
      { x: 200, y: 250 },
    ]);
    expect(closed).toHaveLength(6);
  });

  it('τα κλάσματα κβαντίζονται στα 5 ψηφία', () => {
    const outline = outlineOf(
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
      { minX: 0, minY: 0, maxX: 3, maxY: 3 },
    );
    expect(outline).toEqual([0.33333, 1, 0.66667, 1, 0.66667, 0.33333]);
  });
});

describe('Κ3 — τα δεδομένα της μέτρησης Υ2 (ADR-907 §11.1)', () => {
  const SCENE: FloorPlateFrame = { minX: 0, minY: 0, maxX: 36458.3333333333, maxY: 26041.6666666667 };
  const OUTLINE = [
    { x: 3293.7727313332944, y: 16453.3066696667 },
    { x: 10943.986631333297, y: 16453.29666966669 },
    { x: 10943.981731333297, y: 8753.296669666688 },
    { x: 10743.966731333305, y: 8753.296669666695 },
    { x: 10743.966731333301, y: 8303.296669666703 },
    { x: 3293.7727313332944, y: 8303.306669666697 },
  ];

  it('βγάζει τα κλάσματα που μετρήθηκαν, μέσα σε μισό κβάντο', () => {
    const measured = [0.090343, 0.368193, 0.300178, 0.368193, 0.300178, 0.663873, 0.294692, 0.663873, 0.294692, 0.681153, 0.090343, 0.681153];
    const outline = outlineOf(OUTLINE, SCENE);
    expect(outline).toHaveLength(measured.length);
    outline.forEach((value, index) => expect(Math.abs(value - measured[index])).toBeLessThanOrEqual(6e-6));
  });

  it('το σφάλμα κβαντισμού μένει κάτω από 0,03 px στα 2560 px', () => {
    const outline = outlineOf(OUTLINE, SCENE);
    OUTLINE.forEach((vertex, index) => {
      const exactU = vertex.x / SCENE.maxX;
      expect(Math.abs(outline[index * 2] - exactU) * 2560).toBeLessThan(0.03);
    });
  });
});

describe('Κ4 — περίγραμμα εκτός κάδρου', () => {
  it.each([
    ['αριστερά', { x: 99, y: 300 }],
    ['δεξιά', { x: 501, y: 300 }],
    ['κάτω', { x: 300, y: 199 }],
    ['πάνω', { x: 300, y: 401 }],
  ])('μία κορυφή %s από το κάδρο ⇒ απόρριψη ολόκληρου του σχήματος', (_side, stray) => {
    expect(refusalOf([{ x: 200, y: 250 }, { x: 400, y: 250 }, stray])).toBe('outside-frame');
  });

  it('θόρυβος κινητής υποδιαστολής πάνω στην ακμή συγχωρείται και σφηνώνεται ακριβώς στο 0 / 1', () => {
    const outline = outlineOf([
      { x: 100 - 1e-9, y: 200 - 1e-9 },
      { x: 500 + 1e-9, y: 200 },
      { x: 300, y: 400 + 1e-9 },
    ]);
    expect(outline).toEqual([0, 1, 1, 1, 0.5, 0]);
  });
});

describe('Κ5 — σχήματα που δεν βγαίνουν στο κοινό', () => {
  it('λιγότερες από τρεις κορυφές', () => {
    expect(refusalOf([{ x: 200, y: 250 }, { x: 400, y: 250 }])).toBe('too-few-vertices');
    // Τρεις, αλλά η τρίτη είναι το κλείσιμο ⇒ δύο.
    expect(refusalOf([{ x: 200, y: 250 }, { x: 400, y: 250 }, { x: 200, y: 250 }])).toBe('too-few-vertices');
  });

  it('περισσότερες από το ταβάνι', () => {
    const many = Array.from({ length: FLOOR_PLATE_OUTLINE_MAX_VERTICES + 1 }, (_, index) => {
      const angle = (index / (FLOOR_PLATE_OUTLINE_MAX_VERTICES + 1)) * Math.PI * 2;
      return { x: 300 + 50 * Math.cos(angle), y: 300 + 50 * Math.sin(angle) };
    });
    expect(refusalOf(many)).toBe('too-many-vertices');
    expect(refusalOf(many.slice(1))).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('κορυφή με %p', (bad) => {
    expect(refusalOf([{ x: 200, y: 250 }, { x: 400, y: 250 }, { x: bad, y: 300 }])).toBe('not-finite');
    expect(refusalOf([{ x: 200, y: 250 }, { x: 400, y: 250 }, { x: 300, y: bad }])).toBe('not-finite');
  });

  it('συνευθειακές κορυφές ⇒ μηδενικό εμβαδόν', () => {
    expect(refusalOf([{ x: 200, y: 250 }, { x: 300, y: 250 }, { x: 400, y: 250 }])).toBe('degenerate');
  });

  it('κορυφές που ο κβαντισμός ταυτίζει ⇒ εκφυλισμένο, όχι σχήμα δύο σημείων', () => {
    expect(refusalOf([{ x: 200, y: 250 }, { x: 200.0000001, y: 250 }, { x: 200, y: 250.0000001 }])).toBe('degenerate');
  });
});

describe('Κ6 — ο αναγνώστης του επισκέπτη', () => {
  it('δέχεται ό,τι έγραψε ο γραφέας', () => {
    const outline = outlineOf([
      { x: 200, y: 250 },
      { x: 400, y: 250 },
      { x: 400, y: 350 },
    ]);
    expect(readFloorPlateOutline(outline)).toEqual(outline);
  });

  it.each([
    ['όχι πίνακας', { 0: 0.1 }],
    ['μονός αριθμός τιμών', [0, 0, 1, 0, 1]],
    ['δύο κορυφές', [0, 0, 1, 1]],
    ['τιμή πάνω από 1', [0, 0, 1.2, 0, 1, 1]],
    ['αρνητική τιμή', [0, 0, -0.1, 0, 1, 1]],
    ['μη αριθμός', [0, 0, '1', 0, 1, 1]],
    ['NaN', [0, 0, Number.NaN, 0, 1, 1]],
    ['ζεύγη αντί επίπεδου', [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0.5], [0.5, 0.5]]],
    ['πάνω από το ταβάνι', Array.from({ length: (FLOOR_PLATE_OUTLINE_MAX_VERTICES + 1) * 2 }, () => 0.5)],
    ['null', null],
  ])('%s ⇒ null', (_name, value) => {
    expect(readFloorPlateOutline(value)).toBeNull();
  });
});

describe('Σ — ο κρίκος 19 του δημόσιου σχήματος', () => {
  it('έγγραφο της έκδοσης 18 αποκτά ΚΕΝΟ `floorPlates` και σφραγίδα 19', () => {
    const upgraded = upgradeListingDocument({ schemaVersion: 18, videos: [] });
    expect(upgraded.floorPlates).toEqual([]);
    expect(upgraded.schemaVersion).toBe(19);
    expect(PUBLIC_LISTING_SCHEMA_VERSION).toBe(19);
  });

  it('σκουπίδι στη θέση του πίνακα ⇒ κενό, όχι εξαίρεση· δεύτερη εφαρμογή ⇒ ίδιο αποτέλεσμα', () => {
    const once = upgradeListingDocument({ schemaVersion: 18, floorPlates: 'nope' });
    expect(once.floorPlates).toEqual([]);
    expect(upgradeListingDocument(once)).toEqual(once);
  });

  it('έγγραφο που έχει ήδη κάτοψη ορόφου την κρατά αυτούσια', () => {
    const plate = { provenance: 'declared', value: { units: [] } };
    expect(upgradeListingDocument({ schemaVersion: 18, floorPlates: [plate] }).floorPlates).toEqual([plate]);
  });

  it('έγγραφο από την έκδοση 1 φτάνει στο 19 με το κουτί στη θέση του', () => {
    expect(upgradeListingDocument({}).floorPlates).toEqual([]);
  });
});

describe('Λ — το δημόσιο λεξιλόγιο κατάστασης', () => {
  it('Λ1: κάθε εμπορική κατάσταση έχει δημόσια όψη, και μόνο οι «στην αγορά» είναι available', () => {
    const listed: readonly string[] = LISTED_COMMERCIAL_STATUSES;
    for (const status of COMMERCIAL_STATUSES) {
      const state = floorPlateNeighbourState(status);
      expect(FLOOR_PLATE_NEIGHBOUR_STATES).toContain(state);
      expect(state === 'available').toBe(listed.includes(status));
    }
  });

  it('Λ1: κρατημένη ⇒ reserved · πωλημένη, νοικιασμένη, εκτός αγοράς ⇒ unavailable (χωρίς διάκριση)', () => {
    expect(floorPlateNeighbourState('reserved')).toBe('reserved');
    expect(floorPlateNeighbourState('sold')).toBe('unavailable');
    expect(floorPlateNeighbourState('rented')).toBe('unavailable');
    expect(floorPlateNeighbourState('unavailable')).toBe('unavailable');
  });

  it.each([undefined, null, '', 'κάτι τυχαίο', 42, {}])('Λ2: %p ⇒ unavailable', (value) => {
    expect(floorPlateNeighbourState(value)).toBe('unavailable');
  });

  it('Λ3: το self ανήκει στο λεξιλόγιο του πεδίου, αλλά καμία εμπορική κατάσταση δεν το παράγει', () => {
    expect(isFloorPlateState(FLOOR_PLATE_SELF_STATE)).toBe(true);
    expect(FLOOR_PLATE_STATES).toEqual(['self', 'available', 'reserved', 'unavailable']);
    for (const status of COMMERCIAL_STATUSES) expect(floorPlateNeighbourState(status)).not.toBe(FLOOR_PLATE_SELF_STATE);
  });

  it.each(['sold', 'for-sale', 'SELF', '', null, 1])('Λ3: %p δεν είναι δημόσια κατάσταση', (value) => {
    expect(isFloorPlateState(value)).toBe(false);
  });
});
