/**
 * performance-snapshot-service — ADR-366 §B.5 + §C.7.Q4
 *
 * One capture (3D via the scene manager, 2D via the canvas) and one send path
 * through apiClient (Idempotency-Key + safe retry), uploading the SAME data URL
 * the user previewed.
 */

const postMock = jest.fn();
const captureFrameMock = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: (...args: unknown[]) => postMock(...args) },
}));
jest.mock('../../scene/active-scene-manager-registry', () => ({
  getActiveSceneManager: () => ({ captureFrameDataURL: captureFrameMock }),
}));

import { captureDiagnosticScreenshot, sendDiagnostic } from '../performance-snapshot-service';
import type { PerformanceMetricsSnapshot } from '../PerformanceHUDStore';

const METRICS: PerformanceMetricsSnapshot = {
  fps: 6, frameTimeMs: 166.7, triangles: 1, vertices: 3, drawCalls: 1,
  objectsVisible: 1, objectsTotal: 1, gpuMemoryMb: 1, cpuMemoryMb: 1, samplesPerSec: null,
};

function canvasReturning(dataUrl: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.toDataURL = jest.fn(() => dataUrl);
  return canvas;
}

describe('captureDiagnosticScreenshot', () => {
  beforeEach(() => captureFrameMock.mockReset());

  it('3D → force-rendered frame from the scene manager (raw canvas would be blank)', () => {
    captureFrameMock.mockReturnValue('data:image/png;base64,FRAME');
    const canvas = canvasReturning('data:image/png;base64,BLANK');
    expect(captureDiagnosticScreenshot(canvas, '3d-raster')).toBe('data:image/png;base64,FRAME');
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it('3D with a disposed manager (empty string) → falls back to the canvas', () => {
    captureFrameMock.mockReturnValue('');
    const canvas = canvasReturning('data:image/png;base64,CANVAS');
    expect(captureDiagnosticScreenshot(canvas, '3d-preview')).toBe('data:image/png;base64,CANVAS');
  });

  it('2D → the canvas itself; the 3D manager is never consulted', () => {
    const canvas = canvasReturning('data:image/png;base64,PLAN');
    expect(captureDiagnosticScreenshot(canvas, '2d')).toBe('data:image/png;base64,PLAN');
    expect(captureFrameMock).not.toHaveBeenCalled();
  });
});

describe('sendDiagnostic', () => {
  beforeEach(() => postMock.mockReset().mockResolvedValue({ id: 'perfdiag_1' }));

  it('posts through apiClient with the previewed screenshot, unchanged', async () => {
    await sendDiagnostic({
      projectId: 'proj_1', metrics: METRICS, renderMode: '3d-raster',
      screenshotDataUrl: 'data:image/png;base64,PREVIEWED', comment: '', source: 'auto_submit',
    });
    expect(postMock).toHaveBeenCalledWith('/api/performance-diagnostics', {
      projectId: 'proj_1', metrics: METRICS, renderMode: '3d-raster',
      comment: null, source: 'auto_submit', screenshotBase64: 'PREVIEWED',
    });
  });

  it('propagates failure — the caller owns the user feedback', async () => {
    postMock.mockRejectedValue(new Error('503'));
    await expect(sendDiagnostic({
      projectId: null, metrics: METRICS, renderMode: '3d-raster',
      screenshotDataUrl: 'data:image/png;base64,X', comment: 'slow', source: 'manual',
    })).rejects.toThrow('503');
  });
});
