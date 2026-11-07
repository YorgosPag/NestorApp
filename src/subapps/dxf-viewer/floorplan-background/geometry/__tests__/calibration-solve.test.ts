/**
 * ADR-929 Φ5.2 — ο επιλυτής βαθμονόμησης. Κλειδώνει: μονάδες σκηνής (§6.1 #1, το σφάλμα ×1000 που
 * μετρήθηκε ζωντανά), άγκυρα στο πρώτο σημείο, ευθυγράμμιση στον πλησιέστερο άξονα, χωριστή κλίμακα X/Y
 * για τέντωμα σαρωτή, έλεγχο δεύτερης διάστασης, και ρητές αποτυχίες.
 */

import {
  CALIBRATION_LIMITS,
  calibrationNeedsReview,
  solveCalibration,
  type CalibrationSolution,
  type CalibrationSolveInput,
} from '../calibration-solve';
import { rasterPixelToScene, type RasterPlacement } from '../raster-scene-mapping';
import type { Point2D } from '../../../rendering/types/Types';

const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 1000, height: 800 },
  transform: { translateX: 37, translateY: -12, scaleX: 1, scaleY: 1, rotation: 0 },
};

/** Η αλυσίδα 10,30 m της πραγματικής κάτοψης: κατακόρυφη, 412 px στην εικόνα. */
const LEFT_SIDE = { a: { x: 100, y: 100 }, b: { x: 100, y: 512 }, lengthMm: 10300 };

function solved(input: CalibrationSolveInput): CalibrationSolution {
  const result = solveCalibration(input);
  if (!result.ok) throw new Error(`expected a solution, got ${result.reason}`);
  return result.solution;
}

function sceneLength(placement: RasterPlacement, a: Point2D, b: Point2D): number {
  const pa = rasterPixelToScene(a, placement);
  const pb = rasterPixelToScene(b, placement);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

describe('solveCalibration — μονάδες σκηνής (§6.1 #1)', () => {
  it.each([
    ['m', 10.3],
    ['cm', 1030],
    ['mm', 10300],
  ] as const)('σκηνή σε %s: η αναφορά μετρά %d μονάδες σκηνής', (sceneUnits, expected) => {
    const solution = solved({ placement: PLACEMENT, references: [LEFT_SIDE], sceneUnits, alignToAxis: false });
    const after = { ...PLACEMENT, transform: solution.transform };
    expect(sceneLength(after, LEFT_SIDE.a, LEFT_SIDE.b)).toBeCloseTo(expected, 6);
    expect(solution.mmPerPixelX).toBeCloseTo(10300 / 412, 9);
    expect(solution.mode).toBe('uniform');
  });

  it('η κλίμακα δεν εξαρτάται από την προηγούμενη (αντικατάσταση, όχι πολλαπλασιασμός)', () => {
    const zoomed = { ...PLACEMENT, transform: { ...PLACEMENT.transform, scaleX: 7, scaleY: 7 } };
    const a = solved({ placement: PLACEMENT, references: [LEFT_SIDE], sceneUnits: 'm', alignToAxis: false });
    const b = solved({ placement: zoomed, references: [LEFT_SIDE], sceneUnits: 'm', alignToAxis: false });
    expect(b.transform.scaleX).toBeCloseTo(a.transform.scaleX, 12);
  });
});

describe('solveCalibration — άγκυρα και άξονας', () => {
  it('το πρώτο σημείο μένει στη θέση του στη σκηνή (Revit: κλιμάκωση γύρω από το πρώτο κλικ)', () => {
    const before = rasterPixelToScene(LEFT_SIDE.a, PLACEMENT);
    const solution = solved({ placement: PLACEMENT, references: [LEFT_SIDE], sceneUnits: 'm', alignToAxis: false });
    const after = rasterPixelToScene(LEFT_SIDE.a, { ...PLACEMENT, transform: solution.transform });
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('κατακόρυφη αναφορά ⇒ μένει κατακόρυφη (όχι στροφή 90° όπως το παλιό «ορισμός ως οριζόντιο»)', () => {
    const slanted = { ...LEFT_SIDE, b: { x: 121, y: 512 } }; // ~3° από την κατακόρυφο
    const solution = solved({ placement: PLACEMENT, references: [slanted], sceneUnits: 'm', alignToAxis: true });
    const after = { ...PLACEMENT, transform: solution.transform };
    const pa = rasterPixelToScene(slanted.a, after);
    const pb = rasterPixelToScene(slanted.b, after);
    expect(Math.abs(pb.x - pa.x)).toBeLessThan(1e-9);
    const r = solution.transform.rotation; // [0, 360)
    expect(Math.min(r, 360 - r)).toBeLessThan(5);
  });
});

describe('solveCalibration — δεύτερη αναφορά', () => {
  const MM_X = 25;
  const MM_Y = 25 * 1.015; // σαρωτής που τέντωσε το Y κατά 1,5%
  const horizontal = { a: { x: 50, y: 700 }, b: { x: 450, y: 700 }, lengthMm: 400 * MM_X };
  const vertical = { a: { x: 600, y: 100 }, b: { x: 600, y: 400 }, lengthMm: 300 * MM_Y };

  it('κάθετες αναφορές ⇒ χωριστή κλίμακα X/Y που διορθώνει το τέντωμα', () => {
    const solution = solved({ placement: PLACEMENT, references: [horizontal, vertical], sceneUnits: 'mm', alignToAxis: false });
    expect(solution.mode).toBe('per-axis');
    expect(solution.mmPerPixelX).toBeCloseTo(MM_X, 9);
    expect(solution.mmPerPixelY).toBeCloseTo(MM_Y, 9);
    expect(solution.anisotropyRel).toBeCloseTo(0.015 / 1.015, 9);
    solution.residualsRel.forEach((r) => expect(Math.abs(r)).toBeLessThan(1e-9));
    expect(calibrationNeedsReview(solution)).toBe(false);
  });

  it('παράλληλες αναφορές ⇒ ενιαία κλίμακα + απόκλιση που ζητά έλεγχο όταν ξεπερνά το 1%', () => {
    const wrong = { a: { x: 50, y: 300 }, b: { x: 650, y: 300 }, lengthMm: 600 * MM_X * 1.02 };
    const solution = solved({ placement: PLACEMENT, references: [horizontal, wrong], sceneUnits: 'mm', alignToAxis: false });
    expect(solution.mode).toBe('uniform');
    expect(solution.residualsRel.some((r) => Math.abs(r) > CALIBRATION_LIMITS.residualWarnRel)).toBe(true);
    expect(calibrationNeedsReview(solution)).toBe(true);
  });

  it('λοξές κάθετες (45°/135°) δεν χωρίζουν τους άξονες ⇒ ενιαία κλίμακα', () => {
    const d1 = { a: { x: 100, y: 100 }, b: { x: 300, y: 300 }, lengthMm: 1000 };
    const d2 = { a: { x: 500, y: 100 }, b: { x: 300, y: 300 }, lengthMm: 1000 };
    const solution = solved({ placement: PLACEMENT, references: [d1, d2], sceneUnits: 'mm', alignToAxis: false });
    expect(solution.mode).toBe('uniform');
  });
});

describe('solveCalibration — ρητές αποτυχίες, ποτέ NaN', () => {
  it('σημεία στο ίδιο pixel ⇒ degenerate-reference', () => {
    const point = { a: { x: 10, y: 10 }, b: { x: 10.5, y: 10 }, lengthMm: 1000 };
    expect(solveCalibration({ placement: PLACEMENT, references: [point], sceneUnits: 'm', alignToAxis: false }))
      .toEqual({ ok: false, reason: 'degenerate-reference' });
  });

  it('μηδενική κλίμακα τοποθέτησης ⇒ degenerate-placement', () => {
    const flat = { ...PLACEMENT, transform: { ...PLACEMENT.transform, scaleX: 0 } };
    expect(solveCalibration({ placement: flat, references: [LEFT_SIDE], sceneUnits: 'm', alignToAxis: false }))
      .toEqual({ ok: false, reason: 'degenerate-placement' });
  });

  it('ασυμβίβαστα μήκη (αρνητικό sx²) ⇒ inconsistent-references', () => {
    const p = { a: { x: 0, y: 0 }, b: { x: 100, y: 10 }, lengthMm: 1 };
    const q = { a: { x: 0, y: 0 }, b: { x: 10, y: 100 }, lengthMm: 1000 };
    expect(solveCalibration({ placement: PLACEMENT, references: [p, q], sceneUnits: 'mm', alignToAxis: false }))
      .toEqual({ ok: false, reason: 'inconsistent-references' });
  });
});

describe('solveCalibration — N αναφορές (ADR-929 Φ5.3γ, κάρτα κλίμακας)', () => {
  const MM_X = 20;
  const MM_Y = 20 * 1.01; // τέντωμα 1% στο Y
  const h = (y: number, x0: number, x1: number) => ({ a: { x: x0, y }, b: { x: x1, y }, lengthMm: (x1 - x0) * MM_X });
  const v = (x: number, y0: number, y1: number) => ({ a: { x, y: y0 }, b: { x, y: y1 }, lengthMm: (y1 - y0) * MM_Y });

  it('πολλές οριζόντιες + κατακόρυφες ⇒ χωριστή κλίμακα X/Y, ακριβής, υπόλοιπο ανά αναφορά ≈ 0', () => {
    const refs = [h(50, 10, 410), v(600, 20, 320), h(500, 100, 300), v(700, 50, 650), h(750, 0, 900)] as const;
    const solution = solved({ placement: PLACEMENT, references: refs, sceneUnits: 'mm', alignToAxis: false });
    expect(solution.mode).toBe('per-axis');
    expect(solution.mmPerPixelX).toBeCloseTo(MM_X, 9);
    expect(solution.mmPerPixelY).toBeCloseTo(MM_Y, 9);
    expect(solution.residualsRel).toHaveLength(refs.length);
    solution.residualsRel.forEach((r) => expect(Math.abs(r)).toBeLessThan(1e-9));
  });

  it('μία λάθος γραμμένη διάσταση ανάμεσα σε πολλές ⇒ φαίνεται στο ΔΙΚΟ της υπόλοιπο', () => {
    const wrong = { ...h(300, 0, 500), lengthMm: 500 * MM_X * 1.05 };
    const refs = [h(50, 10, 410), v(600, 20, 320), h(500, 100, 300), v(700, 50, 650), wrong] as const;
    const solution = solved({ placement: PLACEMENT, references: refs, sceneUnits: 'mm', alignToAxis: false });
    const magnitudes = solution.residualsRel.map(Math.abs);
    expect(magnitudes.indexOf(Math.max(...magnitudes))).toBe(refs.length - 1);
    expect(calibrationNeedsReview(solution)).toBe(true);
  });

  it('όλες στον ίδιο άξονα ⇒ ενιαία κλίμακα ελαχίστων τετραγώνων', () => {
    const refs = [h(50, 10, 410), h(500, 100, 300), h(750, 0, 900)] as const;
    const solution = solved({ placement: PLACEMENT, references: refs, sceneUnits: 'mm', alignToAxis: false });
    expect(solution.mode).toBe('uniform');
    expect(solution.mmPerPixelX).toBeCloseTo(MM_X, 9);
  });

  it('η άγκυρα είναι το πρώτο σημείο της πρώτης αναφοράς, όποιο κι αν είναι το N', () => {
    const refs = [v(600, 20, 320), h(50, 10, 410), h(500, 100, 300)] as const;
    const solution = solved({ placement: PLACEMENT, references: refs, sceneUnits: 'm', alignToAxis: false });
    const before = rasterPixelToScene(refs[0].a, PLACEMENT);
    const after = rasterPixelToScene(refs[0].a, { ...PLACEMENT, transform: solution.transform });
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
});
