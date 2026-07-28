/**
 * ADR-725 — κάλυψη της επιφάνειας ΜΕΣΑ στο όριο του οικοπέδου.
 *
 * Κάθε σενάριο είναι αναλυτικό με **γνωστή απάντηση**: πλέγματα με μετρήσιμο βήμα, ορθογώνια
 * οικόπεδα με μετρήσιμο εμβαδόν, ώστε το ποσοστό να επαληθεύεται με το χέρι και όχι με snapshot.
 *
 * 🔴 Τα σημαντικότερα tests εδώ είναι τα **ΑΝΤΙΒΑΡΑ** (§«μηδέν ψευδώς θετικά»): ομοιόμορφη
 * αποτύπωση — πυκνή Ή αραιή — πρέπει να μένει **σιωπηλή**. Ένας έλεγχος QA που ανάβει σε κανονικό
 * αρχείο παύει να διαβάζεται, οπότε χωρίς αυτά τα tests ο έλεγχος δεν επιτρέπεται να υπάρχει.
 */

import { buildTin } from '../../tin-builder';
import type { TopoPoint, TopoBoundary } from '../../topo-types';
import type { Point2D } from '../../../../rendering/types/Types';
import { checkBoundaryElevationCoverage } from '../check-boundary-elevation-coverage';
import { runTopoQa } from '../run-topo-qa';
import { setTopoPoints, setTopoBoundary, clearTopo } from '../../TopoPointStore';
import { invalidateTopoSurface } from '../../topo-surface';

const M = 1000;

/** Ίδια νούμερα εργοταξίου με τα suites ADR-718/720 (Εύοσμος) — καθαρή μετάθεση ΕΓΣΑ'87. */
const EGSA_TRANSLATION: Point2D = { x: 407565290, y: 4502055670 };

/** Ορθογώνιο πλέγμα σε μέτρα, όλα στο ίδιο υψόμετρο (η κλίση δεν παίζει ρόλο στην κάλυψη). */
function grid(x0: number, x1: number, y0: number, y1: number, step: number, offset?: Point2D): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    for (let y = y0; y <= y1 + 1e-9; y += step) {
      pts.push({ x: x * M + (offset?.x ?? 0), y: y * M + (offset?.y ?? 0), z: 10 * M });
    }
  }
  return pts;
}

/** Ορθογώνιο όριο σε μέτρα (σιωπηρά κλειστό, όπως το `TopoBoundary.vertices`). */
function rect(x0: number, x1: number, y0: number, y1: number, offset?: Point2D): TopoBoundary {
  const w = (x: number, y: number): Point2D => ({
    x: x * M + (offset?.x ?? 0), y: y * M + (offset?.y ?? 0),
  });
  return { vertices: [w(x0, y0), w(x1, y0), w(x1, y1), w(x0, y1)] };
}

// ─── 1. ΑΝΤΙΒΑΡΑ — ομοιόμορφη αποτύπωση δεν ανάβει ΤΙΠΟΤΑ ──────────────────────

describe('checkBoundaryElevationCoverage — μηδέν ψευδώς θετικά σε κανονική αποτύπωση', () => {
  it('πυκνό ομοιόμορφο πλέγμα που περιβάλλει το οικόπεδο ⇒ καμία σημαία', () => {
    const points = grid(0, 34, 0, 34, 2);
    const flags = checkBoundaryElevationCoverage(buildTin(points), rect(10, 25, 10, 25), points);
    expect(flags).toEqual([]);
  });

  it('ΑΡΑΙΟ ομοιόμορφο πλέγμα ⇒ πάλι καμία σημαία (το κατώφλι είναι σχετικό, όχι απόλυτο)', () => {
    // Το ίδιο σχήμα με βήμα 10 m αντί για 2 m. Ένα ΑΠΟΛΥΤΟ κατώφλι μηκών ακμής (π.χ. «>5 m =
    // γέφυρα») θα άναβε εδώ, και θα κατήγγειλε ως ελαττωματική κάθε αγροτική αποτύπωση.
    const points = grid(0, 40, 0, 40, 10);
    const flags = checkBoundaryElevationCoverage(buildTin(points), rect(10, 30, 10, 30), points);
    expect(flags).toEqual([]);
  });

  it('🔴 οι γέφυρες δεν κρύβονται πίσω από τον ΔΙΚΟ ΤΟΥΣ αριθμό (γι΄ αυτό διάμεσος, όχι μέσος όρος)', () => {
    // Πυκνή συστάδα 7×7 (η αποτύπωση του εργοταξίου) + 9 βολές σε κύκλο 80 m (των ομόρων).
    // Μετρημένη κατανομή ακμών: **33 πυκνές ~2 m, 30 γέφυρες 54–80 m**. Οι γέφυρες είναι σχεδόν
    // οι μισές — αρκετές ώστε ένας ΜΕΣΟΣ ΟΡΟΣ να εκτοξευθεί στα 34,5 m και το κατώφλι `3 × mean`
    // = 103 m να προσπεράσει **κάθε μία από τις γέφυρες που έπρεπε να πιάσει**. Η διάμεσος μένει
    // αγκυρωμένη στα 2,8 m — στην πραγματική πυκνότητα της αποτύπωσης — και το κατώφλι πέφτει στα
    // 8,5 m. Ίδια λογική με το MAD fence των elevation busts: ο θόρυβος δεν ορίζει το κατώφλι του.
    // Χωρίς αυτό το test η επιλογή `median` θα ήταν διακοσμητική — η μετάλλαξη σε mean επιβίωνε.
    const far: TopoPoint[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      far.push({ x: Math.round(80 * Math.cos(a)) * M, y: Math.round(80 * Math.sin(a)) * M, z: 10 * M });
    }
    const points: TopoPoint[] = [...grid(0, 6, 0, 6, 2), ...far];
    const [flag] = checkBoundaryElevationCoverage(buildTin(points), rect(20, 30, 20, 30), points);

    expect(flag?.messageKey).toBe('topography.qa.flag.interpolatedSupport');
    expect(flag!.severity).toBe('high'); // 0 μετρημένα σημεία εντός, 100% γεφυρωμένο
  });

  it('ίδια σιωπή σε ΕΓΣΑ μεγέθη — το εμβαδόν δεν εξαρτάται από το πού κάθεται το εργοτάξιο', () => {
    const points = grid(0, 34, 0, 34, 2, EGSA_TRANSLATION);
    const boundary = rect(10, 25, 10, 25, EGSA_TRANSLATION);
    expect(checkBoundaryElevationCoverage(buildTin(points), boundary, points)).toEqual([]);
  });
});

// ─── 2. ΤΡΥΠΑ — το οικόπεδο ξεπερνά την επιφάνεια ──────────────────────────────

describe('checkBoundaryElevationCoverage — coverageGap', () => {
  it('όριο 20×20 m πάνω σε επιφάνεια 10×10 m ⇒ 75% ακάλυπτο, high', () => {
    const points = grid(0, 10, 0, 10, 2);
    const flags = checkBoundaryElevationCoverage(buildTin(points), rect(0, 20, 0, 20), points);

    const gap = flags.find((f) => f.messageKey === 'topography.qa.flag.coverageGap');
    expect(gap).toBeDefined();
    expect(gap!.kind).toBe('boundary-coverage');
    expect(gap!.severity).toBe('high');
    // (400 − 100) / 400. Ακέραιο ποσοστό: το κενό είναι γεωμετρικά ακριβές, όχι εκτίμηση.
    expect(gap!.messageParams.percent).toBe(75);
  });

  it('η σημαία κάθεται στο ΚΕΝΤΡΟ ΒΑΡΟΥΣ του οικοπέδου, χωρίς πλαστό υψόμετρο', () => {
    const points = grid(0, 10, 0, 10, 2);
    const [gap] = checkBoundaryElevationCoverage(buildTin(points), rect(0, 20, 0, 20), points);
    expect(gap!.at.x).toBeCloseTo(10 * M, 3);
    expect(gap!.at.y).toBeCloseTo(10 * M, 3);
    // Το εύρημα αφορά ΠΕΡΙΟΧΗ — δεν υπάρχει υψόμετρο να δηλωθεί, και το 0 θα ήταν ψέμα.
    expect(gap!.atZMm).toBeUndefined();
  });
});

// ─── 3. ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — το οικόπεδο γεφυρώνεται από βολές των ΟΜΟΡΩΝ ──────────

describe('checkBoundaryElevationCoverage — interpolatedSupport', () => {
  /**
   * Δύο πυκνές σειρές βολών (y=0 και y=4, ανά 2 m έως x=12) και ΜΙΑ μακρινή βολή στο x=40.
   * Το τρίγωνο που τις ενώνει πηδά 28 m πάνω από κενό — αυτό είναι το «γεμίζει το κενό με
   * τρίγωνα που φαίνονται μια χαρά» του ADR-720, στην καθαρότερη μορφή του.
   */
  function bridgedSurveyPoints(offset?: Point2D): TopoPoint[] {
    const pts = [...grid(0, 12, 0, 0, 2, offset), ...grid(0, 12, 4, 4, 2, offset)];
    pts.push({ x: 40 * M + (offset?.x ?? 0), y: 2 * M + (offset?.y ?? 0), z: 10 * M });
    return pts;
  }

  it('όριο μισό πάνω σε πυκνή αποτύπωση, μισό πάνω στη γέφυρα ⇒ ανάβει με το σωστό ποσοστό', () => {
    const points = bridgedSurveyPoints();
    const flags = checkBoundaryElevationCoverage(buildTin(points), rect(6, 16, 1, 3), points);

    const flag = flags.find((f) => f.messageKey === 'topography.qa.flag.interpolatedSupport');
    expect(flag).toBeDefined();
    // Οικόπεδο 10×2 = 20 m²· γεφυρωμένο x∈[12,16] ⇒ 4×2 = 8 m² ⇒ 40%.
    expect(flag!.messageParams.percent).toBe(40);
  });

  it('🔴 ΜΗΔΕΝ μετρημένα σημεία εντός ⇒ high, παρότι το ποσοστό είναι κάτω από το κατώφλι high', () => {
    const points = bridgedSurveyPoints(); // όλες οι βολές σε y=0 / y=4 — καμία μέσα στο [1,3]
    const [flag] = checkBoundaryElevationCoverage(buildTin(points), rect(6, 16, 1, 3), points);

    expect(flag!.messageParams.points).toBe(0);
    expect(flag!.severity).toBe('high'); // 40% < 50% ⇒ θα ήταν `medium` χωρίς την αναβάθμιση
  });

  it('τα ίδια τρίγωνα με μετρημένα σημεία ΜΕΣΑ στο όριο ⇒ medium, και τα μετρά σωστά', () => {
    const points = [
      ...bridgedSurveyPoints(),
      { x: 8 * M, y: 2 * M, z: 10 * M },
      { x: 10 * M, y: 2 * M, z: 10 * M },
    ];
    const [flag] = checkBoundaryElevationCoverage(buildTin(points), rect(6, 16, 1, 3), points);

    expect(flag!.messageParams.points).toBe(2);
    expect(flag!.severity).toBe('medium');
  });

  it('🔴 ΔΙΣΔΙΑΣΤΑΤΑ σημεία εντός δεν μετρούν ως στήριξη (ADR-720: δεν δίνουν κορυφή στο TIN)', () => {
    const points: TopoPoint[] = [
      ...bridgedSurveyPoints(),
      { x: 8 * M, y: 2 * M },  // κορυφή οικοπέδου, χωρίς υψόμετρο
      { x: 10 * M, y: 2 * M }, // idem — «29 σημεία εντός, μόνο 6 μετρημένα»
    ];
    const [flag] = checkBoundaryElevationCoverage(buildTin(points), rect(6, 16, 1, 3), points);

    expect(flag!.messageParams.points).toBe(0);
    expect(flag!.severity).toBe('high');
  });

  it('η ίδια ετυμηγορία σε ΕΓΣΑ μεγέθη — το LOCAL πλαίσιο δεν αφήνει το float να αλλάξει απάντηση', () => {
    const points = bridgedSurveyPoints(EGSA_TRANSLATION);
    const boundary = rect(6, 16, 1, 3, EGSA_TRANSLATION);
    const [flag] = checkBoundaryElevationCoverage(buildTin(points), boundary, points);

    expect(flag!.messageKey).toBe('topography.qa.flag.interpolatedSupport');
    expect(flag!.messageParams.percent).toBe(40);
    expect(flag!.severity).toBe('high');
  });
});

// ─── 4. Μη κυρτό όριο — ο κανόνας στα αστικά οικόπεδα, όχι η εξαίρεση ──────────

describe('checkBoundaryElevationCoverage — Γ-σχήμα οικόπεδο', () => {
  it('μετρά το ΠΡΑΓΜΑΤΙΚΟ εμβαδόν του Γ, όχι το περιβάλλον ορθογώνιο', () => {
    // Γ 20×20 με κομμένο το τεταρτημόριο [10,20]×[10,20] ⇒ 400 − 100 = 300 m².
    // Η επιφάνεια είναι 10×10 στη γωνία, άρα καλύπτει ακριβώς 100 m² ⇒ κενό 200/300 = 67%.
    const points = grid(0, 10, 0, 10, 2);
    const boundary: TopoBoundary = {
      vertices: [
        { x: 0, y: 0 }, { x: 20 * M, y: 0 }, { x: 20 * M, y: 10 * M },
        { x: 10 * M, y: 10 * M }, { x: 10 * M, y: 20 * M }, { x: 0, y: 20 * M },
      ],
    };
    const [gap] = checkBoundaryElevationCoverage(buildTin(points), boundary, points);
    expect(gap!.messageParams.percent).toBe(67);
  });
});

// ─── 5. Σιωπή όταν δεν υπάρχει ερώτημα ─────────────────────────────────────────

describe('checkBoundaryElevationCoverage — πότε ΔΕΝ μιλά', () => {
  it('χωρίς όριο ⇒ [] (δεν υπάρχει «πόσο του οικοπέδου» χωρίς οικόπεδο)', () => {
    const points = grid(0, 10, 0, 10, 2);
    expect(checkBoundaryElevationCoverage(buildTin(points), null, points)).toEqual([]);
  });

  it('όριο με 2 κορυφές ⇒ []', () => {
    const points = grid(0, 10, 0, 10, 2);
    const boundary: TopoBoundary = { vertices: [{ x: 0, y: 0 }, { x: 10 * M, y: 0 }] };
    expect(checkBoundaryElevationCoverage(buildTin(points), boundary, points)).toEqual([]);
  });

  it('χωρίς επιφάνεια ⇒ [] (το `notEnoughData` της αναφοράς το λέει ήδη, και καλύτερα)', () => {
    const empty = buildTin([]);
    expect(checkBoundaryElevationCoverage(empty, rect(0, 20, 0, 20), [])).toEqual([]);
  });

  it('αποτύπωση ΜΟΝΟ με δισδιάστατα σημεία ⇒ [] (κενή επιφάνεια, όχι ψευδές 100% κενό)', () => {
    const flat: TopoPoint[] = [{ x: 0, y: 0 }, { x: 10 * M, y: 0 }, { x: 0, y: 10 * M }];
    expect(checkBoundaryElevationCoverage(buildTin(flat), rect(0, 20, 0, 20), flat)).toEqual([]);
  });
});

// ─── 6. Ολοκλήρωση — το εύρημα φτάνει στην αναφορά ─────────────────────────────

describe('runTopoQa — ο έλεγχος κάλυψης είναι μέρος της αναφοράς', () => {
  beforeEach(() => {
    clearTopo();
    invalidateTopoSurface();
  });
  afterEach(() => {
    clearTopo();
    invalidateTopoSurface();
  });

  it('ένα οικόπεδο που ξεπερνά την αποτύπωση εμφανίζεται ως boundary-coverage', () => {
    setTopoPoints(grid(0, 10, 0, 10, 2));
    setTopoBoundary(rect(0, 20, 0, 20));
    invalidateTopoSurface();

    const report = runTopoQa('existing');
    const coverage = report.flags.filter((f) => f.kind === 'boundary-coverage');
    expect(coverage.length).toBeGreaterThan(0);
    expect(coverage[0]!.severity).toBe('high');
  });

  it('καθαρή αποτύπωση με το όριο μέσα της ⇒ κανένα boundary-coverage εύρημα', () => {
    setTopoPoints(grid(0, 34, 0, 34, 2));
    setTopoBoundary(rect(10, 25, 10, 25));
    invalidateTopoSurface();

    expect(runTopoQa('existing').flags.filter((f) => f.kind === 'boundary-coverage')).toEqual([]);
  });
});
