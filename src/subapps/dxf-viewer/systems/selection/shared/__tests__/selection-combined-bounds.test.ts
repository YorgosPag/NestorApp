/**
 * ADR-394 — Unit tests for calculateCombinedEntityBounds.
 *
 * Verifies the combined-AABB SSoT used by 'Z' (Fit to View Selected) merges
 * DXF, BIM, and mixed selections, and returns null for empty / boundless sets.
 */

import { calculateCombinedEntityBounds } from '../selection-duplicate-utils';
import type { AnySceneEntity } from '../../../../types/scene';

const line = (id: string, x1: number, y1: number, x2: number, y2: number) =>
  ({ id, type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as AnySceneEntity;

const circle = (id: string, cx: number, cy: number, r: number) =>
  ({ id, type: 'circle', center: { x: cx, y: cy }, radius: r }) as unknown as AnySceneEntity;

const wall = (id: string, minX: number, minY: number, maxX: number, maxY: number) =>
  ({
    id,
    type: 'wall',
    geometry: { bbox: { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 3 } } },
  }) as unknown as AnySceneEntity;

describe('calculateCombinedEntityBounds (ADR-394)', () => {
  it('merges two DXF lines into one AABB', () => {
    const result = calculateCombinedEntityBounds([line('a', 0, 0, 10, 5), line('b', -3, 2, 4, 20)]);
    expect(result).toEqual({ min: { x: -3, y: 0 }, max: { x: 10, y: 20 } });
  });

  it('handles a single DXF circle (center ± radius)', () => {
    const result = calculateCombinedEntityBounds([circle('c', 100, 50, 25)]);
    expect(result).toEqual({ min: { x: 75, y: 25 }, max: { x: 125, y: 75 } });
  });

  it('projects a BIM wall geometry.bbox onto XY', () => {
    const result = calculateCombinedEntityBounds([wall('w', 10, 20, 30, 40)]);
    expect(result).toEqual({ min: { x: 10, y: 20 }, max: { x: 30, y: 40 } });
  });

  it('merges a mixed DXF + BIM selection', () => {
    const result = calculateCombinedEntityBounds([line('a', 0, 0, 5, 5), wall('w', 10, 20, 30, 40)]);
    expect(result).toEqual({ min: { x: 0, y: 0 }, max: { x: 30, y: 40 } });
  });

  it('returns null for an empty selection', () => {
    expect(calculateCombinedEntityBounds([])).toBeNull();
  });

  it('skips entities that yield no bounds and returns null when none do', () => {
    const boundless = { id: 'x', type: 'xline' } as unknown as AnySceneEntity;
    expect(calculateCombinedEntityBounds([boundless])).toBeNull();
  });

  it('ignores boundless entities while keeping valid ones', () => {
    const boundless = { id: 'x', type: 'xline' } as unknown as AnySceneEntity;
    const result = calculateCombinedEntityBounds([boundless, line('a', 1, 1, 2, 8)]);
    expect(result).toEqual({ min: { x: 1, y: 1 }, max: { x: 2, y: 8 } });
  });
});
