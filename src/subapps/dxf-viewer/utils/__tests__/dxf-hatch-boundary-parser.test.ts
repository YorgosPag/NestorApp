/**
 * ADR-507 — HATCH boundary path parser (τόξα / ελλείψεις / splines + η διπλή σημασία του `93`).
 *
 * Τα δεδομένα του πρώτου describe είναι **ΠΡΑΓΜΑΤΙΚΑ BYTES** από το `47_ergasia.dxf`
 * (τοπογραφικό ΕΓΣΑ87 του Giorgio) — όχι κατασκευασμένα. Εξήχθησαν με άμεση ανάγνωση
 * του αρχείου· η κατανομή των flags `92` σε ολόκληρο το αρχείο ήταν:
 *   { 1: 47, 7: 6, 16: 24, 33: 1, 49: 1 }   ⇒ 6 POLYLINE paths (bit 2), 73 EDGE-BASED.
 */

import { parseHatchBoundaryPaths, type DxfPairs } from '../dxf-hatch-boundary-parser';

/** Πραγματικό boundary ενός HATCH του `47_ergasia.dxf`: κυκλικό όριο ως ΜΙΑ ακμή τόξου. */
const REAL_CIRCLE_BOUNDARY: DxfPairs = [
  ['91', '1'],
  ['92', '1'],   // external — bit «polyline» ΔΕΝ είναι set ⇒ edge-based
  ['93', '1'],   // ⇒ 1 ΑΚΜΗ (όχι 1 κορυφή!)
  ['72', '2'],   // circular arc
  ['10', '407790.8902768107'],  // ΚΕΝΤΡΟ — όχι κορυφή
  ['20', '4502375.545898673'],
  ['40', '1.573240352872401'],  // ακτίνα
  ['50', '0.0'],
  ['51', '360.0'],
  ['73', '1'],   // CCW
  ['97', '0'],
  ['75', '1'],
  ['76', '1'],
];

const CENTER = { x: 407790.8902768107, y: 4502375.545898673 };
const RADIUS = 1.573240352872401;

describe('parseHatchBoundaryPaths — πραγματικά bytes (47_ergasia.dxf)', () => {
  it('ΔΕΝ χάνει τη γραμμοσκίαση με κυκλικό όριο (ΠΡΙΝ: 1 σημείο ⇒ απορριπτόταν ολόκληρη)', () => {
    const paths = parseHatchBoundaryPaths(REAL_CIRCLE_BOUNDARY, 0);

    // Το κρίσιμο: ο παλιός parser έβγαζε 1 σημείο (το κέντρο) ⇒ < 3 ⇒ 0 paths ⇒ η
    // γραμμοσκίαση απορριπτόταν με «no usable boundary vertices».
    expect(paths).toHaveLength(1);
    expect(paths[0].length).toBeGreaterThanOrEqual(3);
  });

  it('αναπτύσσει τον κύκλο — ΚΑΘΕ κορυφή σε ακτίνα R από το κέντρο', () => {
    const [circle] = parseHatchBoundaryPaths(REAL_CIRCLE_BOUNDARY, 0);

    for (const p of circle) {
      expect(Math.hypot(p.x - CENTER.x, p.y - CENTER.y)).toBeCloseTo(RADIUS, 6);
    }
  });

  it('ΤΟ ΚΕΝΤΡΟ ΔΕΝ ΕΙΝΑΙ ΚΟΡΥΦΗ — ο παλιός parser το έσπρωχνε στο πολύγωνο', () => {
    const [circle] = parseHatchBoundaryPaths(REAL_CIRCLE_BOUNDARY, 0);

    const containsCenter = circle.some(
      p => Math.abs(p.x - CENTER.x) < 1e-9 && Math.abs(p.y - CENTER.y) < 1e-9,
    );
    expect(containsCenter).toBe(false);
  });

  it('ο κύκλος περικλείει το κέντρο του (bbox sanity — δεν κατέρρευσε σε γραμμή)', () => {
    const [circle] = parseHatchBoundaryPaths(REAL_CIRCLE_BOUNDARY, 0);
    const xs = circle.map(p => p.x);
    const ys = circle.map(p => p.y);

    expect(Math.min(...xs)).toBeLessThan(CENTER.x);
    expect(Math.max(...xs)).toBeGreaterThan(CENTER.x);
    expect(Math.min(...ys)).toBeLessThan(CENTER.y);
    expect(Math.max(...ys)).toBeGreaterThan(CENTER.y);
  });
});

describe('parseHatchBoundaryPaths — φορά τόξου (73) σε WORLD, όχι σε οθόνη', () => {
  /** Τεταρτημόριο 0°→90°, ακτίνα 10, κέντρο (0,0). Το `73` αλλάζει ΠΟΙΑ πλευρά διατρέχεται. */
  const quadrant = (ccwFlag: string): DxfPairs => [
    ['91', '1'], ['92', '1'], ['93', '1'],
    ['72', '2'],
    ['10', '0'], ['20', '0'],
    ['40', '10'],
    ['50', '0.0'], ['51', '90.0'],
    ['73', ccwFlag],
    ['97', '0'],
  ];

  it('73=1 (CCW σε world) ⇒ το τόξο μένει στο ΠΡΩΤΟ τεταρτημόριο (x≥0, y≥0)', () => {
    const [arc] = parseHatchBoundaryPaths(quadrant('1'), 0);

    for (const p of arc) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 6);
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('73=0 (CW σε world) ⇒ διατρέχει τη ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ πλευρά (270°) — περνά από αρνητικά', () => {
    const [arc] = parseHatchBoundaryPaths(quadrant('0'), 0);

    for (const p of arc) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 6);
    // Η μεγάλη πλευρά περνά από το 3ο τεταρτημόριο — αν η αντιστροφή του flag χαθεί,
    // αυτό το τόξο θα ταυτιζόταν με το 73=1 και το test κοκκινίζει.
    expect(arc.some(p => p.x < -1 && p.y < -1)).toBe(true);
  });

  it('οι δύο φορές ΔΕΝ δίνουν το ίδιο σχήμα (η αντιστροφή δεν είναι no-op)', () => {
    const [ccw] = parseHatchBoundaryPaths(quadrant('1'), 0);
    const [cw] = parseHatchBoundaryPaths(quadrant('0'), 0);
    expect(ccw).not.toEqual(cw);
  });
});

describe('parseHatchBoundaryPaths — η διπλή σημασία του κωδικού 93', () => {
  // Τετράγωνο ως POLYLINE path: 92 bit 2 set ⇒ 93 = 4 ΚΟΡΥΦΕΣ.
  const POLYLINE_SQUARE: DxfPairs = [
    ['91', '1'],
    ['92', '7'],   // external | POLYLINE | derived  ← το flag που υπάρχει 6× στο πραγματικό αρχείο
    ['72', '0'],   // has-bulge = 0  (ΠΡΟΣΟΧΗ: σε polyline path το 72 ΔΕΝ είναι edge type)
    ['73', '1'],   // closed
    ['93', '4'],   // ⇒ 4 ΚΟΡΥΦΕΣ
    ['10', '0'], ['20', '0'],
    ['10', '10'], ['20', '0'],
    ['10', '10'], ['20', '10'],
    ['10', '0'], ['20', '10'],
    ['97', '0'],
  ];

  // Το ΙΔΙΟ τετράγωνο ως EDGE-BASED path: 93 = 4 ΑΚΜΕΣ, κάθε μία 72=1 με 10/20 + 11/21.
  const EDGE_SQUARE: DxfPairs = [
    ['91', '1'],
    ['92', '1'],   // ΟΧΙ polyline ⇒ 93 = ΑΚΜΕΣ
    ['93', '4'],
    ['72', '1'], ['10', '0'], ['20', '0'], ['11', '10'], ['21', '0'],
    ['72', '1'], ['10', '10'], ['20', '0'], ['11', '10'], ['21', '10'],
    ['72', '1'], ['10', '10'], ['20', '10'], ['11', '0'], ['21', '10'],
    ['72', '1'], ['10', '0'], ['20', '10'], ['11', '0'], ['21', '0'],
    ['97', '0'],
  ];

  it('POLYLINE path (92 bit 2): 93 = κορυφές', () => {
    const [square] = parseHatchBoundaryPaths(POLYLINE_SQUARE, 0);
    expect(square).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
  });

  it('EDGE-BASED path: 93 = ακμές — ίδιο τετράγωνο, IMPLICIT CLOSING (4 κορυφές, όχι 5)', () => {
    const [square] = parseHatchBoundaryPaths(EDGE_SQUARE, 0);

    // Δύο κανόνες μαζί: (α) οι διαδοχικές ακμές μοιράζονται κορυφή — δεν γράφεται δύο φορές·
    // (β) το τελικό σημείο της τελευταίας ακμής ταυτίζεται με το πρώτο ⇒ κόβεται, γιατί το
    // συμβόλαιο `boundaryPaths` όλου του repo είναι implicit closing.
    expect(square).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
  });

  it('τα δύο σχήματα περιγράφουν το ΙΔΙΟ τετράγωνο (ίδιο bbox)', () => {
    const [a] = parseHatchBoundaryPaths(POLYLINE_SQUARE, 0);
    const [b] = parseHatchBoundaryPaths(EDGE_SQUARE, 0);
    const bbox = (pts: { x: number; y: number }[]) => ({
      minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)),
      minY: Math.min(...pts.map(p => p.y)), maxY: Math.max(...pts.map(p => p.y)),
    });
    expect(bbox(a)).toEqual(bbox(b));
  });

  it('σε polyline path το 72 ΔΕΝ διαβάζεται ως edge type (72=0 ≠ «άγνωστη ακμή»)', () => {
    // Αν το `72=0` περνούσε στον edge dispatcher θα γύριζε [] ⇒ κανένα path.
    const paths = parseHatchBoundaryPaths(POLYLINE_SQUARE, 0);
    expect(paths).toHaveLength(1);
  });
});

describe('parseHatchBoundaryPaths — bulges, ελλείψεις, splines', () => {
  it('polyline με bulge αναπτύσσεται σε τόξο (όχι χορδή)', () => {
    const BULGED: DxfPairs = [
      ['91', '1'],
      ['92', '7'],
      ['72', '1'],   // has bulge
      ['73', '1'],
      ['93', '2'],
      ['10', '0'], ['20', '0'], ['42', '1'],    // ημικύκλιο προς (10,0)
      ['10', '10'], ['20', '0'], ['42', '0'],
      ['97', '0'],
    ];
    const [path] = parseHatchBoundaryPaths(BULGED, 0);

    // Χορδή = 2 σημεία. Τόξο = πολλά, και κάποιο ΕΚΤΟΣ του άξονα y=0.
    expect(path.length).toBeGreaterThan(4);
    expect(path.some(p => Math.abs(p.y) > 1)).toBe(true);
  });

  it('ακμή έλλειψης (72=3) δίνει καμπύλη με τους σωστούς ημιάξονες', () => {
    const ELLIPSE: DxfPairs = [
      ['91', '1'],
      ['92', '1'],
      ['93', '1'],
      ['72', '3'],
      ['10', '0'], ['20', '0'],      // κέντρο
      ['11', '10'], ['21', '0'],     // άκρο μεγάλου ημιάξονα ΩΣ ΠΡΟΣ το κέντρο ⇒ a=10, rot=0
      ['40', '0.5'],                 // λόγος ⇒ b=5
      ['50', '0.0'], ['51', '360.0'],
      ['73', '1'],
      ['97', '0'],
    ];
    const [path] = parseHatchBoundaryPaths(ELLIPSE, 0);

    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...path.map(p => Math.abs(p.x)))).toBeCloseTo(10, 1);
    expect(Math.max(...path.map(p => Math.abs(p.y)))).toBeCloseTo(5, 1);
  });

  it('ακμή spline (72=4) δειγματοληπτείται από τα control points (10/20), όχι τα fit (11/21)', () => {
    const SPLINE: DxfPairs = [
      ['91', '1'],
      ['92', '1'],
      ['93', '1'],
      ['72', '4'],
      ['94', '3'], ['73', '0'], ['74', '0'],
      ['95', '8'], ['96', '4'],
      ['10', '0'], ['20', '0'],
      ['10', '5'], ['20', '10'],
      ['10', '15'], ['20', '10'],
      ['10', '20'], ['20', '0'],
      ['97', '0'],
    ];
    const [path] = parseHatchBoundaryPaths(SPLINE, 0);

    expect(path.length).toBeGreaterThan(4);        // τεσσελοποιήθηκε, δεν είναι τα 4 CP
    expect(path[0]).toEqual({ x: 0, y: 0 });        // ξεκινά στο πρώτο control point
    expect(Math.max(...path.map(p => p.y))).toBeGreaterThan(5); // ανεβαίνει — δεν είναι ευθεία
  });
});

describe('parseHatchBoundaryPaths — ανθεκτικότητα', () => {
  it('πολλαπλά paths διαβάζονται ξεχωριστά (νησί μέσα σε περίγραμμα)', () => {
    const TWO_PATHS: DxfPairs = [
      ['91', '2'],
      ['92', '7'], ['72', '0'], ['73', '1'], ['93', '3'],
      ['10', '0'], ['20', '0'], ['10', '10'], ['20', '0'], ['10', '0'], ['20', '10'],
      ['97', '0'],
      ['92', '7'], ['72', '0'], ['73', '1'], ['93', '3'],
      ['10', '1'], ['20', '1'], ['10', '3'], ['20', '1'], ['10', '1'], ['20', '3'],
      ['97', '0'],
    ];
    const paths = parseHatchBoundaryPaths(TWO_PATHS, 0);

    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveLength(3);
    expect(paths[1]).toHaveLength(3);
  });

  it('path με < 3 κορυφές απορρίπτεται (εκφυλισμένο όριο)', () => {
    const DEGENERATE: DxfPairs = [
      ['91', '1'],
      ['92', '7'], ['72', '0'], ['73', '0'], ['93', '2'],
      ['10', '0'], ['20', '0'], ['10', '10'], ['20', '0'],
      ['97', '0'],
    ];
    expect(parseHatchBoundaryPaths(DEGENERATE, 0)).toHaveLength(0);
  });

  it('τα seed points (98) ΔΕΝ μολύνουν το τελευταίο path', () => {
    const WITH_SEED: DxfPairs = [
      ['91', '1'],
      ['92', '7'], ['72', '0'], ['73', '1'], ['93', '3'],
      ['10', '0'], ['20', '0'], ['10', '10'], ['20', '0'], ['10', '0'], ['20', '10'],
      ['97', '0'],
      ['98', '1'],
      ['10', '999'], ['20', '999'],   // seed point — ΔΕΝ είναι κορυφή ορίου
    ];
    const [path] = parseHatchBoundaryPaths(WITH_SEED, 0);

    expect(path).toHaveLength(3);
    expect(path.some(p => p.x === 999)).toBe(false);
  });

  it('άδειο / χαλασμένο input δεν πετάει', () => {
    expect(parseHatchBoundaryPaths([['91', '0']], 0)).toEqual([]);
    expect(parseHatchBoundaryPaths([], 0)).toEqual([]);
    expect(parseHatchBoundaryPaths([['91', 'άκυρο']], 0)).toEqual([]);
  });
});
