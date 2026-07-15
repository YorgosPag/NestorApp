/**
 * ADR-659 — resolveRepeatedClickCycle: ArchiCAD repeated-click overlap disambiguation.
 */

import type { HitTestResult } from '../../../services/HitTestingService';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';

// mock-prefixed for jest.mock factory hoisting.
const mockHitTestAll = jest.fn();
jest.mock('../../../services/ServiceRegistry', () => ({
  serviceRegistry: { get: () => ({ hitTestAll: mockHitTestAll }) },
}));
jest.mock('../../hover/HoverStore', () => ({
  setHoveredEntity: jest.fn(),
}));

import { resolveRepeatedClickCycle } from '../resolve-repeated-click-cycle';
import { SelectionCyclingStore } from '../SelectionCyclingStore';
import { setHoveredEntity } from '../../hover/HoverStore';

const hitTestAllMock = mockHitTestAll;
const setHoveredEntityMock = setHoveredEntity as jest.Mock;

const hit = (entityId: string): HitTestResult => ({ entityId, entityType: 'line', layer: '0', distance: 0 });

const baseParams = (overrides: Partial<Parameters<typeof resolveRepeatedClickCycle>[0]> = {}) => ({
  screenPos: { x: 100, y: 100 } as Point2D,
  clientX: 200,
  clientY: 220,
  transform: { scale: 1, offsetX: 0, offsetY: 0 } as ViewTransform,
  viewport: { width: 800, height: 600 } as Viewport,
  additive: false,
  selectEntityById: jest.fn(),
  ...overrides,
});

describe('resolveRepeatedClickCycle (ADR-659)', () => {
  beforeEach(() => {
    hitTestAllMock.mockReset();
    setHoveredEntityMock.mockReset();
    SelectionCyclingStore.cancel();
    SelectionCyclingStore.clearArmed();
  });

  it('additive click bypasses cycling (multi-select) without a hit-test', () => {
    const p = baseParams({ additive: true });
    expect(resolveRepeatedClickCycle(p)).toBe(false);
    expect(hitTestAllMock).not.toHaveBeenCalled();
  });

  it('single candidate → not a stack → falls through to normal top-1 select', () => {
    hitTestAllMock.mockReturnValue([hit('a')]);
    expect(resolveRepeatedClickCycle(baseParams())).toBe(false);
    expect(SelectionCyclingStore.matchesArmedPoint(100, 100, 4)).toBe(false);
  });

  it('1st click on a stack arms but does NOT consume (fast path top-1 runs)', () => {
    hitTestAllMock.mockReturnValue([hit('a'), hit('b')]);
    const p = baseParams();
    expect(resolveRepeatedClickCycle(p)).toBe(false);
    expect(p.selectEntityById).not.toHaveBeenCalled();
    expect(SelectionCyclingStore.matchesArmedPoint(100, 100, 4)).toBe(true);
  });

  it('2nd click same point → cycles to next, selects it, opens popover, pre-highlights', () => {
    hitTestAllMock.mockReturnValue([hit('a'), hit('b'), hit('c')]);
    resolveRepeatedClickCycle(baseParams());            // arm (index 0 = 'a')

    const p2 = baseParams({ screenPos: { x: 101, y: 100 } as Point2D }); // within threshold
    expect(resolveRepeatedClickCycle(p2)).toBe(true);   // consumed
    expect(p2.selectEntityById).toHaveBeenCalledWith('b');
    expect(setHoveredEntityMock).toHaveBeenLastCalledWith('b');
    expect(SelectionCyclingStore.isActive()).toBe(true);
    expect(SelectionCyclingStore.getCurrentId()).toBe('b');
  });

  it('3rd click same point → continues cycling (b → c)', () => {
    hitTestAllMock.mockReturnValue([hit('a'), hit('b'), hit('c')]);
    resolveRepeatedClickCycle(baseParams());            // arm 'a'
    resolveRepeatedClickCycle(baseParams());            // → 'b'
    const p3 = baseParams();
    expect(resolveRepeatedClickCycle(p3)).toBe(true);
    expect(p3.selectEntityById).toHaveBeenCalledWith('c');
  });

  it('2nd click on a FAR point re-arms instead of cycling', () => {
    hitTestAllMock.mockReturnValue([hit('a'), hit('b')]);
    resolveRepeatedClickCycle(baseParams());            // arm at (100,100)
    const far = baseParams({ screenPos: { x: 400, y: 400 } as Point2D });
    expect(resolveRepeatedClickCycle(far)).toBe(false); // new stack, arms fresh
    expect(far.selectEntityById).not.toHaveBeenCalled();
    expect(SelectionCyclingStore.matchesArmedPoint(400, 400, 4)).toBe(true);
  });
});
