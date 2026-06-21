/**
 * ADR-357 ambient-alignment extension — `ambient-alignment-source` tests.
 *
 * Coverage:
 *   - empty scene / no columns → []
 *   - column outside radius → excluded
 *   - maxColumns cap honored (nearest-N)
 *   - axis gating: only points sharing the cursor's row/column are emitted
 *   - every emitted anchor: sourceSnapType 'ambient-column' & acquiredAt 0
 */

import {
  collectAmbientAlignmentAnchors,
  AMBIENT_SOURCE_TYPE,
  type AmbientAlignmentConfig,
} from '../ambient-alignment-source';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { Entity } from '../../../types/entities';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';

function rectColumnAt(x: number, y: number, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x, y }, 'rectangular'), ...overrides };
  return {
    id: `col_${x}_${y}`,
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

const CFG = (over: Partial<AmbientAlignmentConfig> = {}): AmbientAlignmentConfig => ({
  radiusWorld: 100000,
  maxColumns: 6,
  axisToleranceWorld: 1,
  ...over,
});

describe('collectAmbientAlignmentAnchors (ADR-357 ambient)', () => {
  it('returns [] for an empty scene', () => {
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [], CFG())).toEqual([]);
  });

  it('returns [] when no entity is a column', () => {
    const notColumns = [{ id: 'x', type: 'line' } as unknown as Entity];
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, notColumns, CFG())).toEqual([]);
  });

  it('excludes a column outside the proximity radius', () => {
    const far = [rectColumnAt(10000, 10000)];
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, far, CFG({ radiusWorld: 10 }));
    expect(anchors).toEqual([]);
  });

  it('emits anchors for a column aligned with the cursor row', () => {
    // Column centered at (300,0); cursor at (0,0) shares y=0 → horizontal alignment.
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [rectColumnAt(300, 0)], CFG());
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a.sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
      expect(a.acquiredAt).toBe(0);
    }
  });

  it('drops every point of a column that is off both cursor axes', () => {
    // Column at (500,500); cursor at (0,0). No char point is near x=0 or y=0.
    const anchors = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [rectColumnAt(500, 500)], CFG());
    expect(anchors).toEqual([]);
  });

  it('honors the maxColumns cap (nearest-N)', () => {
    // 10 columns along y=0 at x=100..1000 — all share the cursor row.
    const cols: Entity[] = [];
    for (let i = 1; i <= 10; i++) cols.push(rectColumnAt(i * 100, 0));
    const capped = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, cols, CFG({ maxColumns: 6 }));
    const uncapped = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, cols, CFG({ maxColumns: 10 }));
    expect(capped.length).toBeGreaterThan(0);
    // Fewer columns considered → strictly fewer anchors.
    expect(capped.length).toBeLessThan(uncapped.length);
  });
});
