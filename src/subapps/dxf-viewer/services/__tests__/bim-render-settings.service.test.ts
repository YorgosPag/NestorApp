import { saveBimRenderSettings } from '../bim-render-settings.service';

const mockPatch = jest.fn();

jest.mock('@/services/dxf-level-mutation-gateway', () => ({
  updateDxfLevelWithPolicy: (...args: unknown[]) => mockPatch(...args),
}));

describe('saveBimRenderSettings', () => {
  beforeEach(() => mockPatch.mockResolvedValue({ success: true }));
  afterEach(() => jest.clearAllMocks());

  it('calls updateDxfLevelWithPolicy with correct payload', async () => {
    const settings = { drawingScale: 50 };
    await saveBimRenderSettings('level-abc', settings);
    expect(mockPatch).toHaveBeenCalledWith({
      payload: { levelId: 'level-abc', bimRenderSettings: settings },
    });
  });

  it('passes viewRange overrides to the gateway', async () => {
    const settings = {
      drawingScale: 100,
      viewRange: { cutPlaneMm: 900, topMm: 2500 },
    };
    await saveBimRenderSettings('lvl-1', settings);
    expect(mockPatch).toHaveBeenCalledWith({
      payload: { levelId: 'lvl-1', bimRenderSettings: settings },
    });
  });

  it('passes objectStyles overrides to the gateway', async () => {
    const settings = {
      drawingScale: 100,
      objectStyles: { wall: { projectionPen: 4, cutPen: 9 } },
    };
    await saveBimRenderSettings('lvl-2', settings as unknown as Parameters<typeof saveBimRenderSettings>[1]);
    expect(mockPatch).toHaveBeenCalledWith({
      payload: { levelId: 'lvl-2', bimRenderSettings: settings },
    });
  });

  it('propagates gateway errors', async () => {
    mockPatch.mockRejectedValueOnce(new Error('network'));
    await expect(saveBimRenderSettings('lvl-x', { drawingScale: 100 })).rejects.toThrow(
      'network',
    );
  });
});
