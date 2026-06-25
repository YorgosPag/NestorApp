/**
 * ADR-529 — axis-justify SSoT (Revit Location-Line point-shift). Inverse property + center identity +
 * orientation-invariance. Κοινό math δοκαριού/τοίχου/πεδιλοδοκού.
 */

import { justifyAxisPoints, unjustifyAxisPoints } from '../axis-justify';
import type { Point2D } from '../../../rendering/types/Types';

const A: Point2D = { x: 1000, y: 5000 };
const B: Point2D = { x: 6000, y: 5000 }; // οριζόντιος άξονας (+X) → canonical normal = +Y

describe('axis-justify — Location-Line point-shift (ADR-529)', () => {
  it('center → identity (byte-for-byte)', () => {
    const j = justifyAxisPoints(A, B, 250, 'center', 'mm');
    expect(j.start).toEqual({ x: 1000, y: 5000 });
    expect(j.end).toEqual({ x: 6000, y: 5000 });
  });

  it('undefined justification → identity (back-compat)', () => {
    const j = justifyAxisPoints(A, B, 250, undefined, 'mm');
    expect(j.start).toEqual({ x: 1000, y: 5000 });
  });

  it('degenerate (μηδενικού μήκους) άξονας → identity', () => {
    const j = justifyAxisPoints(A, A, 250, 'left', 'mm');
    expect(j.start).toEqual({ x: 1000, y: 5000 });
    expect(j.end).toEqual({ x: 1000, y: 5000 });
  });

  it("'left' μετατοπίζει +canonical-normal (βόρεια), 'right' −normal (νότια)", () => {
    const left = justifyAxisPoints(A, B, 250, 'left', 'mm'); // +Y κατά hw=125
    expect(left.start.y).toBeCloseTo(5125, 6);
    const right = justifyAxisPoints(A, B, 250, 'right', 'mm'); // −Y κατά 125
    expect(right.start.y).toBeCloseTo(4875, 6);
  });

  it('unjustify ∘ justify = identity (inverse property), για ΟΛΑ τα justifications', () => {
    for (const j of ['center', 'left', 'right'] as const) {
      const body = justifyAxisPoints(A, B, 300, j, 'mm');
      const loc = unjustifyAxisPoints(body.start, body.end, 300, j, 'mm');
      expect(loc.start.x).toBeCloseTo(A.x, 6);
      expect(loc.start.y).toBeCloseTo(A.y, 6);
      expect(loc.end.x).toBeCloseTo(B.x, 6);
      expect(loc.end.y).toBeCloseTo(B.y, 6);
    }
  });

  it('orientation-invariant: αντίστροφη φορά σχεδίασης → ΙΔΙΑ πλευρά (canonical normal)', () => {
    // start→end +X vs −X πρέπει να δίνουν την ΙΔΙΑ φυσική πλευρά για ίδιο justification.
    const fwd = justifyAxisPoints(A, B, 250, 'left', 'mm'); // +X
    const rev = justifyAxisPoints(B, A, 250, 'left', 'mm'); // −X (ίδια γραμμή, ανάποδα)
    expect(fwd.start.y).toBeCloseTo(5125, 6); // βόρεια
    expect(rev.start.y).toBeCloseTo(5125, 6); // ΕΠΙΣΗΣ βόρεια (όχι 4875)
  });
});
