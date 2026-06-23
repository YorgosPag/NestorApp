/**
 * ADR-507 — tests για το `pickTopHatchAt` (hatch-only even-odd pick, topmost-first).
 */

import { pickTopHatchAt } from '../hatch-pick-at';
import type { Entity } from '../../../types/entities';

function hatch(id: string, minX: number, minY: number, size: number): Entity {
  return {
    id,
    type: 'hatch',
    boundaryPaths: [[
      { x: minX, y: minY },
      { x: minX + size, y: minY },
      { x: minX + size, y: minY + size },
      { x: minX, y: minY + size },
    ]],
  } as unknown as Entity;
}

describe('pickTopHatchAt', () => {
  it('returns the hatch id when the point is inside (even-odd)', () => {
    expect(pickTopHatchAt({ x: 5, y: 5 }, [hatch('h1', 0, 0, 10)])).toBe('h1');
  });

  it('returns null when the point is outside every hatch', () => {
    expect(pickTopHatchAt({ x: 50, y: 50 }, [hatch('h1', 0, 0, 10)])).toBeNull();
  });

  it('returns the topmost (last-painted) hatch when several overlap', () => {
    const entities = [hatch('under', 0, 0, 20), hatch('over', 0, 0, 20)];
    expect(pickTopHatchAt({ x: 5, y: 5 }, entities)).toBe('over');
  });

  it('ignores non-hatch entities', () => {
    const line = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } } as unknown as Entity;
    expect(pickTopHatchAt({ x: 5, y: 5 }, [line])).toBeNull();
  });
});
