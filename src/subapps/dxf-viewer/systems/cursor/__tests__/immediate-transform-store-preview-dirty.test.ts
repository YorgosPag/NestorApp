/**
 * ADR-398 §4 / ADR-040 — `preview-canvas` is part of the transform dirty SSoT.
 *
 * Every transform change (wheel-zoom / pan / fit / programmatic) flows through
 * the single writer `updateImmediateTransform`, which calls `markSystemsDirty`.
 * Adding `'preview-canvas'` to `TRANSFORM_CANVAS_IDS` is what makes the WYSIWYG
 * creation ghost repaint world-locked on zoom WITHOUT a mousemove — reusing the
 * SAME dirty mechanism as the main canvas instead of a separate subscription.
 */

jest.mock('../../../rendering/core/UnifiedFrameScheduler', () => ({
  markSystemsDirty: jest.fn(),
}));

import { updateImmediateTransform } from '../ImmediateTransformStore';
import { markSystemsDirty } from '../../../rendering/core/UnifiedFrameScheduler';

const mockMarkDirty = markSystemsDirty as jest.Mock;

describe('ImmediateTransformStore — preview-canvas in transform dirty SSoT', () => {
  beforeEach(() => mockMarkDirty.mockClear());

  it('marks preview-canvas dirty alongside the main canvases on a transform change', () => {
    updateImmediateTransform({ scale: 2, offsetX: 10, offsetY: 20 });
    expect(mockMarkDirty).toHaveBeenCalledTimes(1);
    expect(mockMarkDirty).toHaveBeenCalledWith(
      expect.arrayContaining(['dxf-canvas', 'layer-canvas', 'preview-canvas']),
    );
  });

  it('still marks dirty even when scale/offset are unchanged (idempotent guard is after)', () => {
    // markSystemsDirty is called before the no-op short-circuit, so a repeated
    // value still keeps every canvas in sync.
    updateImmediateTransform({ scale: 3, offsetX: 0, offsetY: 0 });
    mockMarkDirty.mockClear();
    updateImmediateTransform({ scale: 3, offsetX: 0, offsetY: 0 });
    expect(mockMarkDirty).toHaveBeenCalledWith(
      expect.arrayContaining(['preview-canvas']),
    );
  });
});
