/**
 * ADR-357 ambient-alignment extension — `ambient-alignment-source` tests.
 *
 * Coverage:
 *   - empty scene / no columns → []
 *   - column outside radius → excluded
 *   - maxMembers cap honored (nearest-N)
 *   - non-column structural members (walls) also participate
 *   - axis gating: only points sharing the cursor's row/column are emitted
 *   - every emitted anchor: sourceSnapType 'ambient-column' & acquiredAt 0
 */

import {
  collectAmbientAlignmentAnchors,
  AMBIENT_SOURCE_TYPE,
  type AmbientAlignmentConfig,
} from '../ambient-alignment-source';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { Entity } from '../../../types/entities';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { WallEntity } from '../../../bim/types/wall-types';

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

/** Straight wall along y=0 from (x0,0) to (x1,0). */
function wallAlongX(x0: number, x1: number): WallEntity {
  const params = buildDefaultWallParams({ x: x0, y: 0 }, { x: x1, y: 0 });
  const built = buildWallEntity(params, '0', 'straight');
  if (!built.ok) throw new Error('wall fixture failed: ' + built.hardErrors.join(','));
  return built.entity;
}

const CFG = (over: Partial<AmbientAlignmentConfig> = {}): AmbientAlignmentConfig => ({
  radiusWorld: 100000,
  maxMembers: 6,
  axisToleranceWorld: 1,
  ...over,
});

describe('collectAmbientAlignmentAnchors (ADR-357 ambient)', () => {
  it('returns [] for an empty scene', () => {
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, [], CFG())).toEqual([]);
  });

  it('returns [] when no entity is a structural member', () => {
    const nonStructural = [{ id: 'x', type: 'line' } as unknown as Entity];
    expect(collectAmbientAlignmentAnchors({ x: 0, y: 0 }, nonStructural, CFG())).toEqual([]);
  });

  it('also emits anchors for non-column structural members (walls)', () => {
    // Wall centerline along y=0; cursor shares that row → its char points emit.
    const anchors = collectAmbientAlignmentAnchors({ x: -200, y: 0 }, [wallAlongX(0, 1000)], CFG());
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) expect(a.sourceSnapType).toBe(AMBIENT_SOURCE_TYPE);
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

  it('honors the maxMembers cap (nearest-N)', () => {
    // 10 columns along y=0 at x=100..1000 — all share the cursor row.
    const cols: Entity[] = [];
    for (let i = 1; i <= 10; i++) cols.push(rectColumnAt(i * 100, 0));
    const capped = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, cols, CFG({ maxMembers: 6 }));
    const uncapped = collectAmbientAlignmentAnchors({ x: 0, y: 0 }, cols, CFG({ maxMembers: 10 }));
    expect(capped.length).toBeGreaterThan(0);
    // Fewer columns considered → strictly fewer anchors.
    expect(capped.length).toBeLessThan(uncapped.length);
  });
});
