/**
 * ADR-501 fix — `isClickActionGripKind` SSoT predicate.
 *
 * These grips must EXECUTE on a plain zero-delta click (not arm for multi-grip
 * move): opening flip-hand / flip-facing (Revit toggles) + manifold outlet ▲/▼.
 * Everything else must return false so the arm-click path stays intact.
 */

import { isClickActionGripKind } from '../grip-click-action';
import type { UnifiedGripInfo } from '../unified-grip-types';
import type { EntityGripKind } from '../../grip-kinds';

function grip(gripKind: EntityGripKind): UnifiedGripInfo {
  return { gripKind } as unknown as UnifiedGripInfo;
}

describe('isClickActionGripKind (ADR-501 fix)', () => {
  it('true for opening flip toggles (rotation flip-hand + facing)', () => {
    expect(isClickActionGripKind(grip({ on: 'opening', kind: 'opening-rotation' }))).toBe(true);
    expect(isClickActionGripKind(grip({ on: 'opening', kind: 'opening-facing' }))).toBe(true);
  });

  it('true for manifold outlet add/remove (Revit array ▲/▼)', () => {
    expect(isClickActionGripKind(grip({ on: 'mep-manifold', kind: 'mep-manifold-outlet-add' }))).toBe(true);
    expect(isClickActionGripKind(grip({ on: 'mep-manifold', kind: 'mep-manifold-outlet-remove' }))).toBe(true);
  });

  it('false for reshape / move grips (must ARM on click, not commit)', () => {
    expect(isClickActionGripKind(grip({ on: 'opening', kind: 'opening-corner-ne' }))).toBe(false);
    expect(isClickActionGripKind(grip({ on: 'opening', kind: 'opening-move' }))).toBe(false);
    expect(isClickActionGripKind(grip({ on: 'wall', kind: 'wall-start' }))).toBe(false);
    expect(isClickActionGripKind(grip({ on: 'mep-manifold', kind: 'mep-manifold-move' }))).toBe(false);
  });

  it('false when the grip carries no tagged gripKind', () => {
    expect(isClickActionGripKind({} as UnifiedGripInfo)).toBe(false);
  });
});
