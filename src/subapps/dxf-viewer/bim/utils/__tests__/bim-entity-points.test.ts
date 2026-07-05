/**
 * ADR-370 §κεντρικοποίηση (2026-07-05) — bim-entity-points column SSoT unification guard.
 *
 * Root cause of «κόκκινα τετράγωνα στο κενό» σε L/Γ κολόνα: `getBimEntityKeyPoints2D` (fed to
 * the ENDPOINT snap via `GeometricCalculations`) returned a column's 9 BBOX anchors — for a
 * non-rectangular column those cardinals/diagonals sit in the empty notch → ghost ■ markers
 * OUTSIDE the body. Fix: column key points now delegate to the ONE characteristic-corner SSoT
 * (real footprint vertices). This guard locks that so the bbox-anchor duplicate cannot return.
 */

import { getBimEntityKeyPoints2D } from '../bim-entity-points';
import { getBimCharacteristicPointsOfCategory } from '../bim-characteristic-points';
import type { ColumnEntity, ColumnParams, ColumnKind } from '../../types/column-types';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';

function makeColumn(kind: ColumnKind, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x: 0, y: 0 }, kind);
  return {
    id: 'col_1', type: 'column', kind, layerId: '0',
    params: { ...base, ...overrides },
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as ColumnEntity;
}

describe('getBimEntityKeyPoints2D — column κεντρικοποίηση (ADR-370)', () => {
  it('rectangular column → 4 REAL footprint corners', () => {
    expect(getBimEntityKeyPoints2D(makeColumn('rectangular'))).toHaveLength(4);
  });

  it('L-shape column → 6 REAL footprint corners (reentrant INSIDE bbox), NOT 9 bbox anchors', () => {
    const pts = getBimEntityKeyPoints2D(makeColumn('L-shape'));
    expect(pts).toHaveLength(6); // 9 bbox anchors → regression; 6 real vertices → correct
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // A reentrant corner strictly inside the bbox proves these are real footprint vertices,
    // not the 4 bounding-box corners (which a 9-anchor grid would have emitted in the notch).
    expect(pts.some((p) => p.x > minX && p.x < maxX && p.y > minY && p.y < maxY)).toBe(true);
  });

  it('column key points ARE the ONE characteristic-corner SSoT (zero duplication)', () => {
    const col = makeColumn('L-shape');
    expect(getBimEntityKeyPoints2D(col)).toEqual(getBimCharacteristicPointsOfCategory(col, 'corner'));
  });
});
