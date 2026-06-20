/**
 * ADR-398 §4 — getCanonicalPreviewFrame unit test.
 *
 * Αποδεικνύει το SSoT contract: το canonical frame συνδυάζει (α) το cached viewport
 * του `viewportElement` (μέσω canvasBoundsService — ΙΔΙΑ πηγή με τον main render) +
 * (β) το live `getImmediateTransform()`. Αυτή η ΜΙΑ πηγή είναι που εξαλείφει την
 * απόκλιση που γέννησε το beam-ghost +Y offset (§3.4).
 */

import { getCanonicalPreviewFrame } from '../ghost-preview-frame';
import { canvasBoundsService } from '../../../services/CanvasBoundsService';
import { getImmediateTransform } from '../../cursor/ImmediateTransformStore';

jest.mock('../../../services/CanvasBoundsService', () => ({
  canvasBoundsService: { getBounds: jest.fn() },
}));
jest.mock('../../cursor/ImmediateTransformStore', () => ({
  getImmediateTransform: jest.fn(),
}));

const mockGetBounds = canvasBoundsService.getBounds as jest.Mock;
const mockGetTransform = getImmediateTransform as jest.Mock;

describe('ADR-398 §4 — getCanonicalPreviewFrame', () => {
  const fakeCanvas = {} as HTMLCanvasElement;

  beforeEach(() => {
    mockGetBounds.mockReset();
    mockGetTransform.mockReset();
  });

  it('viewport comes from canvasBoundsService.getBounds(viewportElement)', () => {
    mockGetBounds.mockReturnValue({ width: 1280, height: 720 });
    mockGetTransform.mockReturnValue({ scale: 1, offsetX: 0, offsetY: 0 });

    const frame = getCanonicalPreviewFrame(fakeCanvas);

    expect(mockGetBounds).toHaveBeenCalledWith(fakeCanvas);
    expect(frame.viewport).toEqual({ width: 1280, height: 720 });
  });

  it('transform comes from the live getImmediateTransform() singleton', () => {
    mockGetBounds.mockReturnValue({ width: 800, height: 600 });
    const live = { scale: 2.5, offsetX: -120, offsetY: 47 };
    mockGetTransform.mockReturnValue(live);

    const frame = getCanonicalPreviewFrame(fakeCanvas);

    expect(frame.transform).toBe(live);
  });

  it('reads BOTH sources on every call (zero-lag: no stale cache of its own)', () => {
    mockGetBounds.mockReturnValue({ width: 100, height: 100 });
    mockGetTransform.mockReturnValue({ scale: 1, offsetX: 0, offsetY: 0 });

    getCanonicalPreviewFrame(fakeCanvas);
    getCanonicalPreviewFrame(fakeCanvas);

    expect(mockGetBounds).toHaveBeenCalledTimes(2);
    expect(mockGetTransform).toHaveBeenCalledTimes(2);
  });
});
