/**
 * ADR-363 §column-polygon-sketch — `buildColumnFromSketchedPolygon` tests.
 *
 * Ο λεπτός adapter «σχεδιασμένο πολύγωνο → ColumnEntity» πρέπει να περνά από τον ΙΔΙΟ
 * builder με το «από περίγραμμα» και να ταξινομεί το σχήμα στατικά τίμια:
 *   - ορθογώνιο aspect ≤ 4 → rectangular (κολώνα)
 *   - ορθογώνιο aspect > 4 → shear-wall (τοιχίο, Eurocode 8)
 *   - Γ (L) → composite (polygon-backed)
 *   - < 3 κορυφές → null
 */

import { buildColumnFromSketchedPolygon } from '../column-from-sketched-polygon';
import type { Point2D } from '../../../rendering/types/Types';

// Rectangle helper (CW/CCW-agnostic — ο builder κανονικοποιεί σε CCW).
function rect(w: number, h: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

describe('buildColumnFromSketchedPolygon', () => {
  it('rectangle aspect ≤ 4 → rectangular column', () => {
    const entity = buildColumnFromSketchedPolygon(rect(1000, 500), 'level-0', 'mm');
    expect(entity).not.toBeNull();
    expect(entity?.type).toBe('column');
    expect(entity?.kind).toBe('rectangular');
  });

  it('rectangle aspect > 4 → shear-wall (structural wall)', () => {
    const entity = buildColumnFromSketchedPolygon(rect(4000, 500), 'level-0', 'mm');
    expect(entity).not.toBeNull();
    expect(entity?.kind).toBe('shear-wall');
  });

  it('L-shape (6 vertices, 1 reflex) → composite (polygon-backed)', () => {
    const lshape: Point2D[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 400 },
      { x: 400, y: 400 },
      { x: 400, y: 1000 },
      { x: 0, y: 1000 },
    ];
    const entity = buildColumnFromSketchedPolygon(lshape, 'level-0', 'mm');
    expect(entity).not.toBeNull();
    expect(entity?.kind).toBe('composite');
  });

  it('< 3 vertices → null', () => {
    expect(buildColumnFromSketchedPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }], 'level-0', 'mm')).toBeNull();
    expect(buildColumnFromSketchedPolygon([], 'level-0', 'mm')).toBeNull();
  });
});
