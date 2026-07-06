/**
 * ADR-537 — dxf-grip-drag-access guards.
 *
 * `resolveDraggedDxfGrip` is the ONE accessor the three raw-DXF overlay passes share. These cover the
 * early-return guards (no drag in flight / empty grip set / grip with no source id) WITHOUT a 3D scene —
 * the happy path (entity resolved in scope) is exercised end-to-end by the passes + the browser verify.
 */

import type { GripInfo } from '../../../hooks/grip-types';
import { grip3DOverlayInteraction, resetGrip3DInteraction } from '../../stores/Grip3DOverlayStore';
import { resolveDraggedDxfGrip } from '../dxf-grip-drag-access';

const grip = (p: Partial<GripInfo>): GripInfo =>
  ({ entityId: 'e', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, ...p });

afterEach(() => resetGrip3DInteraction());

describe('resolveDraggedDxfGrip — guards', () => {
  it('no drag in flight → null', () => {
    resetGrip3DInteraction(); // drag = null
    expect(resolveDraggedDxfGrip([grip({})])).toBeNull();
  });

  it('empty grip set → null (even with a drag)', () => {
    grip3DOverlayInteraction.drag = { index: 0, livePlanPos: { x: 1, y: 2 } };
    expect(resolveDraggedDxfGrip([])).toBeNull();
  });

  it('dragged grip has no source entityId → null (never calls scope lookup)', () => {
    grip3DOverlayInteraction.drag = { index: 0, livePlanPos: { x: 1, y: 2 } };
    expect(resolveDraggedDxfGrip([grip({ entityId: '' })])).toBeNull();
  });
});
