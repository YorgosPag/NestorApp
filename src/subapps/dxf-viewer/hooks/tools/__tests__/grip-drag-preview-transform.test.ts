/**
 * ADR-408 Φ7 P2 — toEntityPreviewTransform: SSoT snapshot→transform mapping
 * shared by the live ghost (`useGripGhostPreview`) and the live home-run wire
 * (`HomeRunWiresOverlay`). Guards the extraction: required fields always pass
 * through; optional discriminators are spread ONLY when present (so the
 * `applyEntityPreview` `if (gripKind && …)` branches stay exact).
 */

import { toEntityPreviewTransform } from '../grip-drag-preview-transform';
import type { DxfGripDragPreview } from '../../grip-computation';

const base: DxfGripDragPreview = {
  entityId: 'e1',
  gripIndex: 2,
  delta: { x: 5, y: -3 },
  movesEntity: true,
};

describe('toEntityPreviewTransform', () => {
  it('passes the required fields through', () => {
    const t = toEntityPreviewTransform(base);
    expect(t.entityId).toBe('e1');
    expect(t.gripIndex).toBe(2);
    expect(t.delta).toEqual({ x: 5, y: -3 });
    expect(t.movesEntity).toBe(true);
  });

  it('omits absent optional discriminators (no undefined keys leak)', () => {
    const t = toEntityPreviewTransform(base);
    expect('mepFixtureGripKind' in t).toBe(false);
    expect('electricalPanelGripKind' in t).toBe(false);
    expect('rotatePivot' in t).toBe(false);
  });

  it('spreads the MEP fixture discriminator + rotation pivot when present', () => {
    const t = toEntityPreviewTransform({
      ...base,
      mepFixtureGripKind: 'mep-fixture-move',
      rotatePivot: { x: 1, y: 2 },
    });
    expect(t.mepFixtureGripKind).toBe('mep-fixture-move');
    expect(t.rotatePivot).toEqual({ x: 1, y: 2 });
  });

  it('spreads the electrical-panel discriminator when present', () => {
    const t = toEntityPreviewTransform({ ...base, electricalPanelGripKind: 'electrical-panel-move' });
    expect(t.electricalPanelGripKind).toBe('electrical-panel-move');
  });
});
