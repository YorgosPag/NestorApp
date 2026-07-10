/**
 * ADR-619 v2 — tests για τον walkline tracer «Σκάλα από περιοχή» + τον params builder.
 *
 * Ο χρήστης σχεδιάζει το ΟΡΘΟΓΩΝΙΟ ΟΡΙΟ του κλιμακοστασίου (corridor/λούκι)· η
 * `classifyStairRegion` επιστρέφει τη ΣΥΝΕΧΗ walkline (κεντρική γραμμή + winder τόξα).
 * Καλύπτει: ευθύ, Γ (1 τόξο), Π/U (2 τόξα), στενό (<1.20 → warning), κοντό (going
 * compressed → warning), εκφυλισμένο (<3 κορυφές → fallback+warning), base = πιο κοντά
 * στην 1η κορυφή. Επιπλέον integration: το variant `'sketch'` παράγει geometry χωρίς throw.
 */

import type { Point2D } from '../../../../rendering/types/Types';
import {
  classifyStairRegion,
  WARNING_BELOW_MIN_WIDTH,
  WARNING_DEGENERATE,
} from '../stair-region-classifier';
import {
  buildStairParamsFromRegion,
  computeWalklineStairFit,
  WARNING_GOING_COMPRESSED,
} from '../stair-params-from-region';
import { walklineSegmentLength } from '../stair-region-walkline';
import { computeStairGeometry } from '../StairGeometryService';

const QUARTER_ARC_600 = 600 * (Math.PI / 2); // ≈ 942.478 (r=600, quarter turn)

/** Ορθογώνιος διάδρομος πλάτους `w`, μήκους `len` κατά τον X (CCW από (0,0)). */
function straightCorridor(len: number, w: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: len, y: 0 },
    { x: len, y: w },
    { x: 0, y: w },
  ];
}

describe('classifyStairRegion — ευθύς διάδρομος (single corridor)', () => {
  it('L ≈ μήκος ακμής, width από το ζεύγος, direction κατά τον άξονα, base στην κοντή ακμή', () => {
    const c = classifyStairRegion(straightCorridor(4000, 1200));
    expect(c.warnings).toEqual([]);
    expect(c.walkline).toHaveLength(1);
    expect(c.walkline[0].type).toBe('line');
    expect(c.length).toBeCloseTo(4000, 3);
    expect(c.width).toBeCloseTo(1200, 3);
    // centerline y = 600· base = ελεύθερο άκρο κοντά στην 1η κορυφή (0,0) → (0,600).
    expect(c.basePoint.x).toBeCloseTo(0, 3);
    expect(c.basePoint.y).toBeCloseTo(600, 3);
    expect(c.topPoint.x).toBeCloseTo(4000, 3);
    expect(c.direction.x).toBeCloseTo(1, 6);
    expect(c.direction.y).toBeCloseTo(0, 6);
  });
});

describe('classifyStairRegion — Γ διάδρομος (ένα winder τόξο)', () => {
  // Οριζόντιος βραχίονας x∈[0,4000] y∈[0,1200]· κάθετος x∈[0,1200] y∈[0,3000].
  const lCorridor: Point2D[] = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 1200 },
    { x: 1200, y: 1200 },
    { x: 1200, y: 3000 },
    { x: 0, y: 3000 },
  ];

  it('walkline = ευθεία + τόξο + ευθεία, συνεχής, length = ευθείες + τόξο', () => {
    const c = classifyStairRegion(lCorridor);
    expect(c.warnings).toEqual([]);
    expect(c.walkline.map((s) => s.type)).toEqual(['line', 'arc', 'line']);
    // Ακτίνα τόξου = offset = w/2 = 600.
    const arc = c.walkline[1];
    if (arc.type === 'arc') {
      expect(arc.radius).toBeCloseTo(600, 3);
      expect(Math.abs(arc.deltaAngle)).toBeCloseTo(Math.PI / 2, 4);
    }
    // Συνέχεια: τέλος κάθε segment = αρχή του επόμενου.
    // Μήκος: (3000−1200) + τόξο + (4000−1200) = 1800 + 942.48 + 2800.
    expect(c.length).toBeCloseTo(1800 + QUARTER_ARC_600 + 2800, 2);
    expect(c.width).toBeCloseTo(1200, 3);
    // base = ελεύθερο άκρο κοντά στην (0,0): κάθετο cap (600,3000) < οριζόντιο (4000,600).
    expect(c.basePoint.x).toBeCloseTo(600, 3);
    expect(c.basePoint.y).toBeCloseTo(3000, 3);
  });

  it('τα segments είναι συνεχή (χωρίς κενά)', () => {
    const c = classifyStairRegion(lCorridor);
    // Σύγκριση διαδοχικών endpoints μέσω δειγματοληψίας ακραίων σημείων.
    const endsOf = (i: number): { s: Point2D; e: Point2D } => {
      const seg = c.walkline[i];
      const s = pointAt(c, i, 0);
      const e = pointAt(c, i, walklineSegmentLength(seg));
      return { s, e };
    };
    for (let i = 0; i < c.walkline.length - 1; i++) {
      const a = endsOf(i).e;
      const b = endsOf(i + 1).s;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-6);
    }
  });
});

describe('classifyStairRegion — Π/U διάδρομος (δύο winder τόξα)', () => {
  // Αριστ. x∈[0,1200] y∈[0,4000]· κάτω x∈[0,4000] y∈[0,1200]· δεξ. x∈[2800,4000] y∈[0,4000].
  const uCorridor: Point2D[] = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 4000 },
    { x: 2800, y: 4000 },
    { x: 2800, y: 1200 },
    { x: 1200, y: 1200 },
    { x: 1200, y: 4000 },
    { x: 0, y: 4000 },
  ];

  it('walkline = ευθεία/τόξο/ευθεία/τόξο/ευθεία, δύο τόξα, συνεχής', () => {
    const c = classifyStairRegion(uCorridor);
    expect(c.warnings).toEqual([]);
    expect(c.walkline.map((s) => s.type)).toEqual(['line', 'arc', 'line', 'arc', 'line']);
    const arcs = c.walkline.filter((s) => s.type === 'arc');
    expect(arcs).toHaveLength(2);
    // length = 2800 + τόξο + 1600 + τόξο + 2800.
    expect(c.length).toBeCloseTo(2800 + QUARTER_ARC_600 + 1600 + QUARTER_ARC_600 + 2800, 2);
    expect(c.width).toBeCloseTo(1200, 3);
    // base = αριστερό cap (600,4000) (πιο κοντά στην (0,0) από το δεξί (3400,4000)).
    expect(c.basePoint.x).toBeCloseTo(600, 3);
    expect(c.basePoint.y).toBeCloseTo(4000, 3);
  });
});

describe('classifyStairRegion — στενός διάδρομος (<1.20m → warning)', () => {
  it('width 1000 < 1200 → below-min-width warning αλλά προχωρά με το μετρημένο πλάτος', () => {
    const c = classifyStairRegion(straightCorridor(3000, 1000));
    expect(c.warnings).toContain(WARNING_BELOW_MIN_WIDTH);
    expect(c.width).toBeCloseTo(1000, 3);
    expect(c.length).toBeCloseTo(3000, 3);
  });

  it('width ακριβώς 1200 → ΧΩΡΙΣ warning', () => {
    const c = classifyStairRegion(straightCorridor(3000, 1200));
    expect(c.warnings).not.toContain(WARNING_BELOW_MIN_WIDTH);
  });
});

describe('classifyStairRegion — base = πιο κοντά στην 1η κορυφή σχεδίασης', () => {
  it('αντιστροφή σειράς κορυφών → base αντιστρέφεται', () => {
    const forward = straightCorridor(4000, 1200); // 1η κορυφή (0,0)
    const reversedStart: Point2D[] = [
      { x: 4000, y: 0 },
      { x: 4000, y: 1200 },
      { x: 0, y: 1200 },
      { x: 0, y: 0 },
    ]; // 1η κορυφή (4000,0)
    const a = classifyStairRegion(forward);
    const b = classifyStairRegion(reversedStart);
    expect(a.basePoint.x).toBeCloseTo(0, 3);
    expect(b.basePoint.x).toBeCloseTo(4000, 3);
  });
});

describe('classifyStairRegion — εκφυλισμένο (ΠΟΤΕ throw, fallback + warning)', () => {
  it('< 3 κορυφές → minimal ευθεία fallback + degenerate warning', () => {
    const c = classifyStairRegion([{ x: 0, y: 0 }, { x: 3000, y: 0 }]);
    expect(c.warnings).toContain(WARNING_DEGENERATE);
    expect(c.walkline).toHaveLength(1);
    expect(c.walkline[0].type).toBe('line');
  });

  it('κενή είσοδος → fallback + warning (χωρίς crash)', () => {
    const c = classifyStairRegion([]);
    expect(c.warnings).toContain(WARNING_DEGENERATE);
    expect(c.walkline).toHaveLength(1);
  });

  it('μηδενικό εμβαδόν (συγγραμμικά) → fallback + warning', () => {
    const c = classifyStairRegion([
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 10000, y: 0 },
    ]);
    expect(c.warnings).toContain(WARNING_DEGENERATE);
  });
});

describe('computeWalklineStairFit — fit / συμπίεση πατήματος (STEP 3)', () => {
  it('required ≤ L → χωράει, going = default (280), χωρίς warning', () => {
    // H=3000, r=175 → N_risers=17, N_goings=16, required=16*280=4480 ≤ 6000.
    const fit = computeWalklineStairFit(6000, 3000, 175, 280);
    expect(fit.nRisers).toBe(17);
    expect(fit.nGoings).toBe(16);
    expect(fit.riseActual).toBeCloseTo(3000 / 17, 6);
    expect(fit.goingEffective).toBeCloseTo(280, 6);
    expect(fit.compressed).toBe(false);
    expect(fit.warnings).toEqual([]);
    expect(fit.occupiedLength).toBeCloseTo(16 * 280, 6);
  });

  it('required > L → COMPRESS going = L/N_goings + going-compressed warning', () => {
    // required=4480 > 3000 → going_effective = 3000/16 = 187.5.
    const fit = computeWalklineStairFit(3000, 3000, 175, 280);
    expect(fit.compressed).toBe(true);
    expect(fit.goingEffective).toBeCloseTo(3000 / 16, 6);
    expect(fit.warnings).toContain(WARNING_GOING_COMPRESSED);
    expect(fit.occupiedLength).toBeCloseTo(3000, 6);
  });
});

describe('buildStairParamsFromRegion — walkline-driven sketch StairParams (STEP 5)', () => {
  const lCorridor: Point2D[] = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 1200 },
    { x: 1200, y: 1200 },
    { x: 1200, y: 3000 },
    { x: 0, y: 3000 },
  ];

  it('straight (χωράει) → variant sketch, stepCount = N_goings, walklinePath = stepCount+1, width, geometry OK', () => {
    const c = classifyStairRegion(straightCorridor(6000, 1200));
    const params = buildStairParamsFromRegion(c, 'mm');
    expect(params.variant.kind).toBe('sketch');
    expect(params.stepCount).toBe(16); // N_goings
    if (params.variant.kind === 'sketch') {
      expect(params.variant.walklinePath).toHaveLength(params.stepCount + 1);
    }
    expect(params.width).toBeCloseTo(1200, 3);
    expect(params.tread).toBeCloseTo(280, 3); // going_default (fits)
    expect(params.rise).toBeCloseTo(3000 / 17, 4);
    expect(params.totalRise).toBeCloseTo(3000, 3);
    expect(Number.isFinite(params.direction)).toBe(true);
    // Integration: το sketch geometry παράγεται χωρίς throw (walklinePath === stepCount+1).
    expect(() => computeStairGeometry(params)).not.toThrow();
  });

  it('φαρδύς διάδρομος (2450) → πλάτος ΚΛΕΙΔΩΝΕΤΑΙ στο type default (1200), όχι το μετρημένο', () => {
    // Regression bug #1: ο tracer μετρά 2450mm πλάτος διαδρόμου· η σκάλα ΠΡΕΠΕΙ να μπει
    // 1200mm (type default «Κεντρικό Κλιμακοστάσιο»), αποσυνδεδεμένη από τον διάδρομο.
    const c = classifyStairRegion(straightCorridor(6000, 2450));
    expect(c.width).toBeCloseTo(2450, 3); // ο classifier ΜΕΤΡΑ σωστά το 2450
    const params = buildStairParamsFromRegion(c, 'mm');
    expect(params.width).toBeCloseTo(1200, 3); // αλλά η σκάλα ΚΛΕΙΔΩΝΕΤΑΙ στο 1200
    expect(params.width).toBeLessThan(c.width);
    expect(() => computeStairGeometry(params)).not.toThrow();
  });

  it('στενός διάδρομος (900 < 1200) → πλάτος ΠΑΡΑΜΕΝΕΙ type default (1200), warning στον classifier', () => {
    // Type parameter δεν συρρικνώνεται· ο διάδρομος απλώς προειδοποιεί (below-min-width).
    const c = classifyStairRegion(straightCorridor(6000, 900));
    expect(c.warnings).toContain(WARNING_BELOW_MIN_WIDTH);
    const params = buildStairParamsFromRegion(c, 'mm');
    expect(params.width).toBeCloseTo(1200, 3);
  });

  it('scene units «m» → πλάτος = 1200 * s (type default scene-scaled)', () => {
    const c = classifyStairRegion(straightCorridor(6, 2.45)); // ήδη σε m-scale corridor
    const params = buildStairParamsFromRegion(c, 'm');
    expect(params.width).toBeCloseTo(1.2, 4); // 1200mm * (1/1000) = 1.2 scene units
  });

  it('κοντός διάδρομος → tread συμπιεσμένο (< default), geometry OK', () => {
    const c = classifyStairRegion(straightCorridor(3000, 1200));
    const params = buildStairParamsFromRegion(c, 'mm');
    expect(params.stepCount).toBe(16);
    expect(params.tread).toBeCloseTo(3000 / 16, 3); // 187.5 συμπιεσμένο
    expect(params.tread).toBeLessThan(280);
    expect(() => computeStairGeometry(params)).not.toThrow();
  });

  it('Γ διάδρομος → sketch με δειγματοληπτημένη walkline (arcs), geometry OK', () => {
    const params = buildStairParamsFromRegion(classifyStairRegion(lCorridor), 'mm');
    expect(params.variant.kind).toBe('sketch');
    if (params.variant.kind === 'sketch') {
      expect(params.variant.walklinePath).toHaveLength(params.stepCount + 1);
    }
    expect(() => computeStairGeometry(params)).not.toThrow();
  });

  it('εκφυλισμένη περιοχή → έγκυρα sketch params (χωρίς crash)', () => {
    const params = buildStairParamsFromRegion(classifyStairRegion([]), 'mm');
    expect(params.variant.kind).toBe('sketch');
    expect(params.stepCount).toBeGreaterThanOrEqual(1);
  });
});

describe('buildStairParamsFromRegion — multi-flight fill + πλατύσκαλα (bug #2, ADR-619)', () => {
  // U/switchback διάδρομος (2 τόξα, 3 κλάδοι), πλάτος 1200 — ο tracer βγάζει σταθερά
  // line/arc/line/arc/line. Με ύψος 5μ (~29 ρίχτια) τα πατήματα ΑΠΛΩΝΟΝΤΑΙ σε όλους.
  const uCorridor: Point2D[] = [
    { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 },
    { x: 2800, y: 4000 }, { x: 2800, y: 1200 }, { x: 1200, y: 1200 },
    { x: 1200, y: 4000 }, { x: 0, y: 4000 },
  ];
  const FLOOR_5M = { floorId: 'f1', name: 'L1', height: 5 };

  /** Συνολική |γωνία στροφής| (rad) κατά μήκος της διαδρομής — ίσια σκάλα ≈ 0. */
  function totalTurning(path: readonly Point2D[]): number {
    let sum = 0;
    for (let i = 2; i < path.length; i++) {
      const ax = path[i - 1].x - path[i - 2].x;
      const ay = path[i - 1].y - path[i - 2].y;
      const bx = path[i].x - path[i - 1].x;
      const by = path[i].y - path[i - 1].y;
      if (Math.hypot(ax, ay) < 1e-6 || Math.hypot(bx, by) < 1e-6) continue;
      const cross = ax * by - ay * bx;
      const dot = ax * bx + ay * by;
      sum += Math.abs(Math.atan2(cross, dot));
    }
    return sum;
  }

  it('η σκάλα ΣΤΡΙΒΕΙ (περνά τις στροφές), δεν μένει ίσια σε έναν κλάδο', () => {
    const c = classifyStairRegion(uCorridor, 'mm');
    // Ο tracer βλέπει 2 στροφές (line/arc/line/arc/line).
    expect(c.walkline.filter((seg) => seg.type === 'arc')).toHaveLength(2);
    const params = buildStairParamsFromRegion(c, 'mm', FLOOR_5M);
    if (params.variant.kind !== 'sketch') throw new Error('expected sketch');
    // U-switchback = 2×90° → συνολική στροφή ~π· ίσια σκάλα θα ήταν ~0.
    expect(totalTurning(params.variant.walklinePath)).toBeGreaterThan(Math.PI / 2);
    expect(() => computeStairGeometry(params)).not.toThrow();
  });

  it('τα τόξα (στροφές) γίνονται ΕΠΙΠΕΔΑ πλατύσκαλα (μεικτά z: ανοδικά + επίπεδα)', () => {
    const c = classifyStairRegion(uCorridor, 'mm');
    const params = buildStairParamsFromRegion(c, 'mm', FLOOR_5M);
    if (params.variant.kind !== 'sketch') throw new Error('expected sketch');
    expect(params.variant.preserveZ).toBe(true);
    const path = params.variant.walklinePath;
    let rising = 0;
    let flat = 0;
    for (let i = 1; i < path.length; i++) {
      if (Math.abs(path[i].z - path[i - 1].z) > 1e-6) rising += 1;
      else flat += 1;
    }
    expect(rising).toBeGreaterThan(0); // πατήματα
    expect(flat).toBeGreaterThan(0);   // πλατύσκαλα στις στροφές
  });

  it('ΟΛΑ τα ρίχτια τοποθετούνται → η σκάλα φτάνει τον όροφο (top z = rise·nGoings)', () => {
    const c = classifyStairRegion(uCorridor, 'mm');
    const params = buildStairParamsFromRegion(c, 'mm', FLOOR_5M);
    if (params.variant.kind !== 'sketch') throw new Error('expected sketch');
    const path = params.variant.walklinePath;
    const topZ = path[path.length - 1].z;
    // Ανοδικά βήματα = topZ / rise· πρέπει nGoings = nRisers − 1 (nRisers = round(5000/rise)).
    const nRisers = Math.round(5000 / params.rise);
    expect(Math.round(topZ / params.rise)).toBe(nRisers - 1);
  });

  it('μακρύς ίσιος διάδρομος → going παραμένει ~280 (όχι απλωμένο σε όλο το μήκος)', () => {
    // Ο χρήστης απέρριψε το «άπλωμα»· going σταθερό, το πλεόνασμα = top landing (δεν
    // τοποθετούμε πάτημα πέρα από τα ρίχτια — σταματά όταν φτάσει ο όροφος).
    const c = classifyStairRegion(straightCorridor(20000, 1200), 'mm');
    const params = buildStairParamsFromRegion(c, 'mm', { floorId: 'f1', name: 'L1', height: 3 });
    expect(params.tread).toBeCloseTo(280, 3);
    if (params.variant.kind !== 'sketch') throw new Error('expected sketch');
    // Η σκάλα καταλαμβάνει ~4.5μ (16×280), όχι τα 20μ.
    const path = params.variant.walklinePath;
    const spanned = Math.hypot(
      path[path.length - 1].x - path[0].x,
      path[path.length - 1].y - path[0].y,
    );
    expect(spanned).toBeLessThan(6000);
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Σημείο σε τοπική απόσταση `local` πάνω στο i-οστό walkline segment. */
function pointAt(
  c: ReturnType<typeof classifyStairRegion>,
  i: number,
  local: number,
): Point2D {
  const seg = c.walkline[i];
  if (seg.type === 'line') {
    const len = Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y);
    const t = len > 0 ? local / len : 0;
    return { x: seg.start.x + (seg.end.x - seg.start.x) * t, y: seg.start.y + (seg.end.y - seg.start.y) * t };
  }
  const len = seg.radius * Math.abs(seg.deltaAngle);
  const frac = len > 0 ? local / len : 0;
  const ang = seg.startAngle + seg.deltaAngle * frac;
  return { x: seg.center.x + seg.radius * Math.cos(ang), y: seg.center.y + seg.radius * Math.sin(ang) };
}
