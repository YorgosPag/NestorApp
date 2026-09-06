/**
 * @fileoverview **ΔΕΙΧΝΕΙ Ο ΔΕΙΚΤΗΣ ΕΚΕΙ ΠΟΥ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑ;** — ADR-332 **D26**.
 * @related lib/geo/offscreen-edge-indicator
 *
 * 🔑 **Αυτή η άγκυρα εκτελεί τη ΣΥΝΑΡΤΗΣΗ, όχι μια οθόνη που την καλεί.** Το μάθημα του
 * D25 *(«άγκυρα που βεβαίωνε **κλειδί** αντί για **αποτέλεσμα** ήταν πράσινη ενώ η οθόνη
 * έγραφε 296.0κμμ»)* λέει ακριβώς αυτό: ό,τι μπορεί να απομονωθεί σε αριθμούς, ελέγχεται
 * σε αριθμούς — εκεί το «πέρασε» σημαίνει κάτι.
 *
 * ⚠️ Κάθε ομάδα εδώ αντιστοιχεί σε **τρόπο να σπάσει ο δείκτης ώστε να μη φανεί**:
 * καθρεφτισμένη γωνία, δείκτης έξω από το κάδρο, `NaN` που εξαφανίζει σιωπηλά, και το
 * `null` που **οφείλει** να δοθεί όταν η πινέζα ήδη φαίνεται.
 */

import {
  edgeIndicatorFor,
  type ScreenSize,
} from '../offscreen-edge-indicator';

/** Κάδρο 400×300 ⇒ κέντρο (200, 150). Μη τετράγωνο **επίτηδες**: ένα τετράγωνο κρύβει
 *  κάθε μπέρδεμα ανάμεσα στον οριζόντιο και τον κατακόρυφο άξονα. */
const FRAME: ScreenSize = { width: 400, height: 300 };
const INSET = 20;

/**
 * Το ορθογώνιο μέσα στο οποίο **οφείλει** να πέφτει κάθε δείκτης.
 *
 * ⚠️ Η ανοχή δεν είναι χαλάρωση του ελέγχου. Ο πολλαπλασιασμός `centerY + dy * (halfY/|dy|)`
 * επιστρέφει **19,99999999999997** αντί για 20 σε ορισμένες γωνίες — διαφορά **3·10⁻¹⁴ px**,
 * δηλαδή δώδεκα τάξεις μεγέθους κάτω από ένα εικονοστοιχείο. Χωρίς ανοχή, ο έλεγχος θα
 * κοκκίνιζε για την **αριθμητική των δεκαδικών**, όχι για τη γεωμετρία — και το πρώτο
 * πράγμα που θα έκανε ο επόμενος είναι να τον σβήσει.
 */
const FLOAT_TOLERANCE_PX = 1e-9;

function assertInsideFrame(point: { x: number; y: number }) {
  expect(point.x).toBeGreaterThanOrEqual(INSET - FLOAT_TOLERANCE_PX);
  expect(point.x).toBeLessThanOrEqual(FRAME.width - INSET + FLOAT_TOLERANCE_PX);
  expect(point.y).toBeGreaterThanOrEqual(INSET - FLOAT_TOLERANCE_PX);
  expect(point.y).toBeLessThanOrEqual(FRAME.height - INSET + FLOAT_TOLERANCE_PX);
}

describe('edgeIndicatorFor — πότε ΔΕΝ υπάρχει δείκτης', () => {
  it('ο στόχος στο ΚΕΝΤΡΟ δεν παίρνει δείκτη', () => {
    expect(edgeIndicatorFor({ x: 200, y: 150 }, FRAME, INSET)).toBeNull();
  });

  it('ο στόχος ΜΕΣΑ στο κάδρο δεν παίρνει δείκτη — φαίνεται η ίδια η πινέζα', () => {
    expect(edgeIndicatorFor({ x: 260, y: 200 }, FRAME, INSET)).toBeNull();
  });

  it('ΑΚΡΙΒΩΣ στο όριο του περιθωρίου μετράει ακόμη ως ορατός', () => {
    // halfX = 200 - 20 = 180 ⇒ x = 200 + 180 = 380
    expect(edgeIndicatorFor({ x: 380, y: 150 }, FRAME, INSET)).toBeNull();
  });

  it('🔴 ΜΕΣΑ στο κάδρο αλλά ΕΝΤΟΣ του περιθωρίου ⇒ ΠΑΙΡΝΕΙ δείκτη (η πινέζα είναι κομμένη)', () => {
    // x = 390 < width(400) ⇒ «τεχνικά ορατός», αλλά μισός έξω από την ακμή.
    expect(edgeIndicatorFor({ x: 390, y: 150 }, FRAME, INSET)).not.toBeNull();
  });
});

describe('edgeIndicatorFor — οι τέσσερις κατευθύνσεις', () => {
  it('ΠΑΝΩ ⇒ 0°, κολλημένος στην πάνω ακμή, οριζόντια στο κέντρο', () => {
    const result = edgeIndicatorFor({ x: 200, y: -5000 }, FRAME, INSET);
    expect(result).not.toBeNull();
    expect(result?.angleDeg).toBeCloseTo(0);
    expect(result?.x).toBeCloseTo(200);
    expect(result?.y).toBeCloseTo(INSET);
  });

  it('ΔΕΞΙΑ ⇒ 90°, κολλημένος στη δεξιά ακμή', () => {
    const result = edgeIndicatorFor({ x: 5000, y: 150 }, FRAME, INSET);
    expect(result?.angleDeg).toBeCloseTo(90);
    expect(result?.x).toBeCloseTo(FRAME.width - INSET);
    expect(result?.y).toBeCloseTo(150);
  });

  it('ΚΑΤΩ ⇒ 180°, κολλημένος στην κάτω ακμή', () => {
    const result = edgeIndicatorFor({ x: 200, y: 5000 }, FRAME, INSET);
    expect(result?.angleDeg).toBeCloseTo(180);
    expect(result?.y).toBeCloseTo(FRAME.height - INSET);
  });

  it('ΑΡΙΣΤΕΡΑ ⇒ 270°, κολλημένος στην αριστερή ακμή', () => {
    const result = edgeIndicatorFor({ x: -5000, y: 150 }, FRAME, INSET);
    expect(result?.angleDeg).toBeCloseTo(270);
    expect(result?.x).toBeCloseTo(INSET);
  });

  it('🔴 ΠΑΝΩ και ΚΑΤΩ ΔΕΝ δίνουν την ίδια γωνία — εκεί κρύβεται το καθρεφτισμένο πρόσημο', () => {
    const up = edgeIndicatorFor({ x: 200, y: -5000 }, FRAME, INSET);
    const down = edgeIndicatorFor({ x: 200, y: 5000 }, FRAME, INSET);
    expect(Math.abs((up?.angleDeg ?? 0) - (down?.angleDeg ?? 0))).toBeCloseTo(180);
  });
});

describe('edgeIndicatorFor — διαγώνιοι στόχοι', () => {
  it('πάνω-δεξιά κάθεται στην ακμή που φτάνει ΠΡΩΤΗ, όχι στη γωνία', () => {
    /*
      halfX=180, halfY=130. Στόχος (200+360, 150-130) ⇒ dx=360, dy=-130.
      scaleX = 180/360 = 0,5 · scaleY = 130/130 = 1 ⇒ νικά ο **οριζόντιος** άξονας.
      Άρα ο δείκτης πρέπει να ακουμπά τη ΔΕΞΙΑ ακμή, όχι την πάνω.
    */
    const result = edgeIndicatorFor({ x: 560, y: 20 }, FRAME, INSET);
    expect(result?.x).toBeCloseTo(FRAME.width - INSET);
    expect(result?.y).toBeCloseTo(150 - 65);
    expect(result?.angleDeg).toBeGreaterThan(0);
    expect(result?.angleDeg).toBeLessThan(90);
  });

  it('η γωνία κάθε τεταρτημορίου πέφτει στο σωστό τεταρτημόριο', () => {
    const quadrants: ReadonlyArray<readonly [number, number, number, number]> = [
      [1000, -1000, 0, 90],    // πάνω-δεξιά
      [1000, 1000, 90, 180],   // κάτω-δεξιά
      [-1000, 1000, 180, 270], // κάτω-αριστερά
      [-1000, -1000, 270, 360],// πάνω-αριστερά
    ];
    for (const [dx, dy, min, max] of quadrants) {
      const angle = edgeIndicatorFor({ x: 200 + dx, y: 150 + dy }, FRAME, INSET)?.angleDeg;
      expect(angle).toBeGreaterThan(min);
      expect(angle).toBeLessThan(max);
    }
  });

  it('🔴 ΚΑΝΕΝΑΣ δείκτης δεν βγαίνει έξω από το κάδρο, για 360 κατευθύνσεις', () => {
    for (let deg = 0; deg < 360; deg += 1) {
      const radians = (deg * Math.PI) / 180;
      const result = edgeIndicatorFor(
        { x: 200 + Math.cos(radians) * 9000, y: 150 + Math.sin(radians) * 9000 },
        FRAME,
        INSET,
      );
      expect(result).not.toBeNull();
      if (result) assertInsideFrame(result);
    }
  });
});

describe('edgeIndicatorFor — είσοδοι που δεν είναι απάντηση', () => {
  it('NaN στόχος ⇒ null, ΟΧΙ δείκτης στη γωνία', () => {
    expect(edgeIndicatorFor({ x: NaN, y: 10 }, FRAME, INSET)).toBeNull();
    expect(edgeIndicatorFor({ x: 10, y: NaN }, FRAME, INSET)).toBeNull();
    expect(edgeIndicatorFor({ x: Infinity, y: 10 }, FRAME, INSET)).toBeNull();
  });

  it('κάδρο χωρίς διαστάσεις ⇒ null', () => {
    expect(edgeIndicatorFor({ x: 5000, y: 5000 }, { width: 0, height: 0 }, INSET)).toBeNull();
    expect(edgeIndicatorFor({ x: 5000, y: 5000 }, { width: NaN, height: 300 }, INSET)).toBeNull();
  });

  it('περιθώριο μεγαλύτερο από το μισό κάδρο ⇒ null (δεν υπάρχει άκρη να δείξει)', () => {
    expect(edgeIndicatorFor({ x: 5000, y: 150 }, FRAME, 200)).toBeNull();
  });

  it('αρνητικό περιθώριο ⇒ null', () => {
    expect(edgeIndicatorFor({ x: 5000, y: 150 }, FRAME, -1)).toBeNull();
  });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΛΥΦΟΣ ΤΟΥ ΧΑΡΤΗ — μετρημένο ελάττωμα, 2026-09-05
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ζωντανή μέτρηση στην οθόνη «Διευθύνσεις Έργου»: ο δείκτης του υποψήφιου «Άγιοι
 * Ανάργυροι» — **σχεδόν ακριβώς νότια** του εργοταξίου Θεσσαλονίκης — κάθισε πάνω στο
 * κουμπί «Δες όλες τις πιθανές τοποθεσίες», με επικάλυψη **15×23 px**. Και τα δύο
 * είναι **κάτω κεντρικά**, άρα η σύγκρουση δεν ήταν ατυχία: ήταν **βεβαιότητα** για
 * κάθε υποψήφιο σε φορά κοντά στις 180°.
 */
describe('edgeIndicatorFor — τα περιθώρια τοποθέτησης κρατούν το κέλυφος καθαρό', () => {
  /** Δέσμευση κάτω ζώνης: `bottom-3` (12) + ύψος κουμπιού (30) + διάκενο (6) + μισό τονισμένο σήμα (18). */
  const RESERVED_BOTTOM = 66;
  const PLACEMENT = { top: INSET, right: INSET, bottom: RESERVED_BOTTOM, left: INSET };

  it('🔴 ΚΑΝΕΝΑΣ δείκτης δεν μπαίνει στη δεσμευμένη ζώνη, για 360 κατευθύνσεις', () => {
    for (let deg = 0; deg < 360; deg += 1) {
      const radians = (deg * Math.PI) / 180;
      const result = edgeIndicatorFor(
        { x: 200 + Math.cos(radians) * 9000, y: 150 + Math.sin(radians) * 9000 },
        FRAME,
        INSET,
        PLACEMENT,
      );
      expect(result).not.toBeNull();
      if (!result) continue;
      expect(result.y).toBeLessThanOrEqual(
        FRAME.height - RESERVED_BOTTOM + FLOAT_TOLERANCE_PX,
      );
      assertInsideFrame(result);
    }
  });

  it('ο υποψήφιος ΑΚΡΙΒΩΣ νότια κάθεται στο όριο της δεσμευμένης ζώνης — όχι στην ακμή', () => {
    const result = edgeIndicatorFor({ x: 200, y: 9000 }, FRAME, INSET, PLACEMENT);
    expect(result?.x).toBeCloseTo(200, 9);
    expect(result?.y).toBeCloseTo(FRAME.height - RESERVED_BOTTOM, 9);
    expect(result?.angleDeg).toBeCloseTo(180, 9);
  });

  it('η δέσμευση είναι ΑΝΑ ΠΛΕΥΡΑ — η πάνω ακμή δεν πληρώνει για την κάτω', () => {
    const result = edgeIndicatorFor({ x: 200, y: -9000 }, FRAME, INSET, PLACEMENT);
    expect(result?.y).toBeCloseTo(INSET, 9);
    expect(result?.angleDeg).toBeCloseTo(0, 9);
  });

  /**
   * 🔑 **Η ΑΓΚΥΡΑ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΤΗ ΔΕΥΤΕΡΗ ΠΑΡΑΜΕΤΡΟ.** Αν η δέσμευση του κελύφους
   * έκρινε **και** την ορατότητα, τότε μια πινέζα 50 px πάνω από την κάτω ακμή — που ο
   * άνθρωπος **βλέπει** — θα έπαιρνε δείκτη: δύο σημεία για μία διεύθυνση.
   */
  it('🔴 πινέζα ΟΡΑΤΗ αλλά μέσα στη δεσμευμένη ζώνη ⇒ ΚΑΝΕΝΑΣ δείκτης (όχι διπλή αναπαράσταση)', () => {
    // y = 250: μέσα στο ορατό ορθογώνιο (|dy| = 100 ≤ 130) αλλά κάτω από το 300-66 = 234.
    expect(edgeIndicatorFor({ x: 200, y: 250 }, FRAME, INSET, PLACEMENT)).toBeNull();
  });

  it('περιθώριο τοποθέτησης ΜΙΚΡΟΤΕΡΟ από το ορατό δεν μπορεί να παρασταθεί — ισχύει το ορατό', () => {
    const shrunk = { top: 0, right: 0, bottom: 5, left: 0 };
    const result = edgeIndicatorFor({ x: 200, y: 9000 }, FRAME, INSET, shrunk);
    expect(result?.y).toBeCloseTo(FRAME.height - INSET, 9);
  });

  it('πλευρά δεσμευμένη ΟΛΟΚΛΗΡΗ ⇒ null — δεν έμεινε άκρη να δείξει κάτι', () => {
    const swallowed = { top: INSET, right: INSET, bottom: 150, left: INSET };
    expect(edgeIndicatorFor({ x: 200, y: 9000 }, FRAME, INSET, swallowed)).toBeNull();
  });

  it('περιθώριο τοποθέτησης που δεν είναι αριθμός ⇒ null, ΟΧΙ δείκτης στη γωνία', () => {
    const broken = { top: INSET, right: INSET, bottom: NaN, left: INSET };
    expect(edgeIndicatorFor({ x: 200, y: 9000 }, FRAME, INSET, broken)).toBeNull();
  });
});
