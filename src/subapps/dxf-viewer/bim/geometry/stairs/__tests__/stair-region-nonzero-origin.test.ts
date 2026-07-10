/**
 * ADR-619 v2 — regression: «Σκάλα από περιοχή» σε ΜΗ-ΜΗΔΕΝΙΚΗ world θέση + robust
 * επιλογή διαδρόμου (bug: μικροσκοπική + εκτός-πολυγώνου σκάλα).
 *
 * Root cause που φυλάει αυτό το test: το `findCorridorSegments` επέλεγε τον διάδρομο
 * με βάση το ΜΙΚΡΟΤΕΡΟ πλάτος (`wMin`). Μια ζωγραφισμένη-στο-χέρι περιοχή έχει σχεδόν
 * πάντα μια μικρή εγκοπή/jog στο περίγραμμα· αυτή έφτιαχνε ένα ζεύγος πολύ μικρού
 * πλάτους που «έκλεβε» την επιλογή → walkline μήκους ~εγκοπής (π.χ. 200mm) πάνω στην
 * εγκοπή → σκάλα ΜΙΚΡΟΣΚΟΠΙΚΗ (πάτημα ~12mm) και ΕΚΤΟΣ του διαδρόμου. Η διόρθωση
 * κρατά μόνο ζεύγη με κεντρική γραμμή ΜΕΣΑ στο πολύγωνο και διαλέγει το πλάτος του
 * ΜΑΚΡΥΤΕΡΟΥ (= πραγματικού διαδρόμου).
 */

import type { Point2D } from '../../../../rendering/types/Types';
import { classifyStairRegion, WARNING_NO_CORRIDOR, WARNING_DEGENERATE } from '../stair-region-classifier';
import { buildStairParamsFromRegion } from '../stair-params-from-region';
import { computeStairGeometry } from '../StairGeometryService';

interface Bbox { minX: number; minY: number; maxX: number; maxY: number; }

function bboxOf(pts: readonly { x: number; y: number }[]): Bbox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** True όταν το σημείο είναι εντός του bbox (με μικρό περιθώριο tol). */
function inBbox(p: { x: number; y: number }, b: Bbox, tol = 1e-6): boolean {
  return p.x >= b.minX - tol && p.x <= b.maxX + tol && p.y >= b.minY - tol && p.y <= b.maxY + tol;
}

// Ορθογώνιος διάδρομος 1200 × 6000 (κατά τον Y) σε world (50000, 30000) — ΜΙΚΡΗ
// εγκοπή 200mm στον δεξιό τοίχο (το κλασικό «χειροκίνητο» ατέλειωμα του περιγράμματος).
const NOTCH_CORRIDOR: Point2D[] = [
  { x: 50000, y: 30000 },
  { x: 51200, y: 30000 },
  { x: 51200, y: 30400 },
  { x: 51000, y: 30400 },
  { x: 51000, y: 30600 },
  { x: 51200, y: 30600 },
  { x: 51200, y: 36000 },
  { x: 50000, y: 36000 },
];

// Καθαρός ορθογώνιος διάδρομος 1200 × 5000 σε world (10000, 20000).
const CLEAN_CORRIDOR: Point2D[] = [
  { x: 10000, y: 20000 },
  { x: 11200, y: 20000 },
  { x: 11200, y: 25000 },
  { x: 10000, y: 25000 },
];

describe('stair-from-region — ΜΗ-μηδενική world θέση + εγκοπή (regression μικροσκοπικής/εκτός σκάλας)', () => {
  it('εγκοπή ΔΕΝ κλέβει τον διάδρομο: walkline down τον διάδρομο, πλήρους μήκους, ΜΕΣΑ στο πολύγωνο', () => {
    const c = classifyStairRegion(NOTCH_CORRIDOR, 'mm');
    // Η εγκοπή απορρίπτεται → βρίσκεται ΚΑΝΟΝΙΚΟΣ διάδρομος (όχι fallback).
    expect(c.warnings).not.toContain(WARNING_NO_CORRIDOR);
    expect(c.warnings).not.toContain(WARNING_DEGENERATE);
    // Πλάτος = πραγματικός διάδρομος 1200 (ΟΧΙ 200 της εγκοπής).
    expect(c.width).toBeCloseTo(1200, 3);
    // Μήκος ≈ επικάλυψη διαδρόμου (6000 − 600 του σπασμένου τοίχου) = 5400, ΟΧΙ ~200.
    expect(c.length).toBeGreaterThan(4000);

    const params = buildStairParamsFromRegion(c, 'mm');
    expect(params.variant.kind).toBe('sketch');
    const wp = params.variant.kind === 'sketch' ? params.variant.walklinePath : [];
    const polyBbox = bboxOf(NOTCH_CORRIDOR);

    // (a) ΚΑΘΕ σημείο της walkline είναι ΜΕΣΑ στο bbox του πολυγώνου (πιάνει mislocation).
    for (const p of wp) expect(inBbox(p, polyBbox)).toBe(true);

    // (b) Το walkline καλύπτει μήκος ≈ nGoings × tread (πιάνει «μικροσκοπική»).
    const first = wp[0];
    const last = wp[wp.length - 1];
    const span = Math.hypot(last.x - first.x, last.y - first.y);
    const expectedRun = params.stepCount * params.tread;
    expect(span).toBeGreaterThan(expectedRun * 0.9);
    expect(span).toBeGreaterThan(2000); // ΟΧΙ ~200mm (η μικροσκοπική περίπτωση)
    // tread ΔΕΝ είναι συμπιεσμένο σε μικροσκοπικό (ήταν ~12.5mm στο bug).
    expect(params.tread).toBeGreaterThan(100);

    // (c) Το geometry υπολογίζεται και βρίσκεται ΜΕΣΑ/κοντά στο bbox του πολυγώνου.
    const geo = computeStairGeometry(params);
    const treadPts = geo.treads.flat();
    expect(treadPts.length).toBeGreaterThan(0);
    const geoBbox = bboxOf(treadPts);
    const marginX = geoBbox.minX >= polyBbox.minX - 10 && geoBbox.maxX <= polyBbox.maxX + 10;
    const marginY = geoBbox.minY >= polyBbox.minY - 10 && geoBbox.maxY <= polyBbox.maxY + 10;
    expect(marginX && marginY).toBe(true);
  });

  it('καθαρό μεγάλο ορθογώνιο (μη-μηδενικό origin) → ΕΥΘΕΙΑ walkline κατά τον ΜΑΚΡΥ άξονα (όχι fallback)', () => {
    const c = classifyStairRegion(CLEAN_CORRIDOR, 'mm');
    expect(c.warnings).not.toContain(WARNING_NO_CORRIDOR);
    expect(c.warnings).not.toContain(WARNING_DEGENERATE);
    expect(c.walkline).toHaveLength(1);
    expect(c.walkline[0].type).toBe('line');
    // Μακρύς άξονας = Y (5000 > 1200).
    expect(c.length).toBeCloseTo(5000, 3);
    expect(c.width).toBeCloseTo(1200, 3);
    expect(c.direction.x).toBeCloseTo(0, 6);
    expect(Math.abs(c.direction.y)).toBeCloseTo(1, 6);
    // Κεντραρισμένο στον διάδρομο (x = 10600), ΜΕΣΑ στο πολύγωνο.
    expect(c.basePoint.x).toBeCloseTo(10600, 3);

    const params = buildStairParamsFromRegion(c, 'mm');
    const wp = params.variant.kind === 'sketch' ? params.variant.walklinePath : [];
    const polyBbox = bboxOf(CLEAN_CORRIDOR);
    for (const p of wp) expect(inBbox(p, polyBbox)).toBe(true);
    expect(() => computeStairGeometry(params)).not.toThrow();
  });
});
