/**
 * Regression anchor — an ARC selects by its ACTUAL curve, not by the far centre /
 * full-circle bounding box (Giorgio 2026-07-21).
 *
 * ΙΣΤΟΡΙΚΟ: το `arc` δεν είχε δικό του case στη selection. Το bbox του έπαιρνε
 * `center ± radius` (bounding box ΟΛΟΚΛΗΡΟΥ του κύκλου) και το lasso/window fallback
 * το αναπαριστούσε ΜΟΝΟ με το κέντρο. Έτσι ένα πλαίσιο κοντά στο (μακρινό) κέντρο
 * τραβούσε πάντα το τόξο μέσα στην επιλογή — «κουράζει τον χρήστη».
 *
 * Η ΔΙΟΡΘΩΣΗ: precise arc geometry (sampled curve μέσω του `arcToPolyline` SSoT) και
 * στα δύο marquee paths (crossing + window). Το test round-trip-άρει μέσω του
 * ΠΡΑΓΜΑΤΙΚΟΥ `worldToScreen` ώστε να μην εξαρτάται από margins / Y-inversion.
 */
import { UnifiedEntitySelection } from '../utils';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { Entity } from '../../../types/entities';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';

const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const viewport: Viewport = { width: 1000, height: 1000 };
const canvasRect = { width: 1000, height: 1000, left: 0, top: 0 } as DOMRect;

const toScreen = (w: Point2D): Point2D =>
  CoordinateTransforms.worldToScreen(w, transform, viewport);

// Quarter arc in the +x/+y world quadrant: curve occupies x∈[0,100], y∈[0,100],
// midpoint ≈ (70.7, 70.7). The centre (0,0) is the far corner of its full-circle bbox.
const arc = {
  id: 'ARC1', type: 'arc', center: { x: 0, y: 0 }, radius: 100,
  startAngle: 0, endAngle: 90,
} as unknown as Entity;

const entities: Entity[] = [arc];

/**
 * Build the marquee screen endpoints from two world corners.
 * `crossing` (R→L) requires startPoint.x > endPoint.x; `window` (L→R) the opposite.
 */
function marquee(worldA: Point2D, worldB: Point2D, crossing: boolean): [Point2D, Point2D] {
  const a = toScreen(worldA);
  const b = toScreen(worldB);
  const [right, left] = a.x >= b.x ? [a, b] : [b, a];
  return crossing ? [right, left] : [left, right];
}

describe('arc precise selection (ADR-561)', () => {
  it('CROSSING near the far centre — but NOT touching the curve — does NOT select the arc', () => {
    // A rect on the OPPOSITE side of the centre from the arc. It overlaps the OLD
    // full-circle bbox (center±100) but never the actual curve → must NOT select.
    const [start, end] = marquee({ x: -40, y: -40 }, { x: -10, y: -10 }, true);
    const ids = UnifiedEntitySelection.findEntitiesInMarquee(start, end, entities, transform, canvasRect);
    expect(ids).not.toContain('ARC1');
  });

  it('CROSSING that clips the arc midpoint DOES select the arc', () => {
    const [start, end] = marquee({ x: 50, y: 50 }, { x: 90, y: 90 }, true);
    const ids = UnifiedEntitySelection.findEntitiesInMarquee(start, end, entities, transform, canvasRect);
    expect(ids).toContain('ARC1');
  });

  it('WINDOW that fully encloses the curve selects the arc', () => {
    const [start, end] = marquee({ x: -10, y: -10 }, { x: 110, y: 110 }, false);
    const ids = UnifiedEntitySelection.findEntitiesInMarquee(start, end, entities, transform, canvasRect);
    expect(ids).toContain('ARC1');
  });

  it('WINDOW that covers only the midpoint region (endpoints outside) does NOT select', () => {
    // Endpoints (100,0) & (0,100) lie outside this box → not fully enclosed.
    const [start, end] = marquee({ x: 40, y: 40 }, { x: 90, y: 90 }, false);
    const ids = UnifiedEntitySelection.findEntitiesInMarquee(start, end, entities, transform, canvasRect);
    expect(ids).not.toContain('ARC1');
  });

  it('LASSO over only the centre region does NOT select (curve, not centre, is the target)', () => {
    // A small lasso polygon around the far centre, away from the curve.
    const lassoWorld: Point2D[] = [
      { x: -30, y: -30 }, { x: -5, y: -30 }, { x: -5, y: -5 }, { x: -30, y: -5 },
    ];
    const lassoScreen = lassoWorld.map(toScreen);
    const ids = UnifiedEntitySelection.findEntitiesInLasso(lassoScreen, entities, transform, canvasRect, 'crossing');
    expect(ids).not.toContain('ARC1');
  });

  it('LASSO crossing the arc curve DOES select', () => {
    const lassoWorld: Point2D[] = [
      { x: 50, y: 50 }, { x: 95, y: 50 }, { x: 95, y: 95 }, { x: 50, y: 95 },
    ];
    const lassoScreen = lassoWorld.map(toScreen);
    const ids = UnifiedEntitySelection.findEntitiesInLasso(lassoScreen, entities, transform, canvasRect, 'crossing');
    expect(ids).toContain('ARC1');
  });
});
