/**
 * PerformanceAlertsLeaf — ADR-366 §C.7.Q4
 *
 * The low-FPS prompt is reachable: prompted → non-modal toast; «Αναφορά…» →
 * review dialog with the FROZEN detection-time metrics and one capture;
 * send → auto_submit report, no cooldown; «Όχι τώρα» → cooldown.
 */

interface ToastOptions {
  id: string;
  description: string;
  duration: number;
  action: { label: string; onClick: () => void };
  cancel: { label: string; onClick: () => void };
  onDismiss: () => void;
}

const warningMock = jest.fn<void, [string, ToastOptions]>();
const dismissMock = jest.fn();
const sendMock = jest.fn();
const captureMock = jest.fn(() => 'data:image/png;base64,SHOT');
interface DialogProps {
  metrics: { fps: number };
  screenshotDataUrl: string;
  variant: string;
  onSubmit: (comment: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}
const dialogProps: { current: DialogProps | null } = { current: null };

jest.mock('sonner', () => ({
  toast: {
    warning: (title: string, opts: ToastOptions) => warningMock(title, opts),
    dismiss: (id: string) => dismissMock(id),
    error: jest.fn(),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../PerformanceRegressionNotifier', () => ({ PerformanceRegressionNotifier: () => null }));
jest.mock('../PerformanceDiagnosticDialog', () => ({
  PerformanceDiagnosticDialog: (props: DialogProps) => {
    dialogProps.current = props;
    return null;
  },
}));
jest.mock('../performance-snapshot-service', () => ({
  captureDiagnosticScreenshot: (...args: unknown[]) => captureMock(...(args as [])),
  sendDiagnostic: (...args: unknown[]) => sendMock(...args),
}));

import { act, render } from '@testing-library/react';
import { PerformanceAlertsLeaf, LOW_FPS_TOAST_ID } from '../PerformanceAlertsLeaf';
import { autoSubmitStore } from '../auto-submit-store';
import { usePerformanceHUDStore } from '../PerformanceHUDStore';
import type { PerformanceMetricsSnapshot } from '../PerformanceHUDStore';

const FROZEN: PerformanceMetricsSnapshot = {
  fps: 6, frameTimeMs: 166.7, triangles: 9, vertices: 9, drawCalls: 9,
  objectsVisible: 9, objectsTotal: 9, gpuMemoryMb: 9, cpuMemoryMb: 9, samplesPerSec: null,
};

function lastToast(): ToastOptions {
  const call = warningMock.mock.calls[warningMock.mock.calls.length - 1];
  if (!call) throw new Error('no toast shown');
  return call[1];
}

function renderLeaf() {
  return render(<PerformanceAlertsLeaf canvas={document.createElement('canvas')} projectId="proj_1" />);
}

describe('PerformanceAlertsLeaf', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    dialogProps.current = null;
    sendMock.mockResolvedValue(undefined);
    usePerformanceHUDStore.setState({ renderMode: '3d-raster', enabled: false });
    autoSubmitStore.setState({
      phase: 'idle', triggerFps: null, triggerAt: null, triggerSnapshot: null,
      lastDeclinedAt: null, permanentOptOut: false,
    });
  });

  it('shows nothing while idle — even with the HUD closed the leaf is mounted', () => {
    renderLeaf();
    expect(warningMock).not.toHaveBeenCalled();
    expect(dialogProps.current).toBeNull();
  });

  it('prompted → one persistent toast with a fixed id (no duplicates)', () => {
    renderLeaf();
    act(() => autoSubmitStore.getState().openPrompt(6, Date.now(), FROZEN));
    const opts = lastToast();
    expect(opts.id).toBe(LOW_FPS_TOAST_ID);
    expect(opts.duration).toBe(Number.POSITIVE_INFINITY);
    expect(warningMock).toHaveBeenCalledTimes(1);
  });

  it('«Αναφορά…» → review dialog with the FROZEN metrics; the toast dismissal is no decline', () => {
    renderLeaf();
    act(() => autoSubmitStore.getState().openPrompt(6, Date.now(), FROZEN));
    act(() => lastToast().action.onClick());
    act(() => lastToast().onDismiss()); // sonner fires this on the follow-up dismiss

    expect(autoSubmitStore.getState().phase).toBe('reviewing');
    expect(autoSubmitStore.getState().lastDeclinedAt).toBeNull();
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(dialogProps.current?.metrics).toBe(FROZEN);
    expect(dialogProps.current?.screenshotDataUrl).toBe('data:image/png;base64,SHOT');
    expect(dialogProps.current?.variant).toBe('auto_submit');
    expect(dismissMock).toHaveBeenCalledWith(LOW_FPS_TOAST_ID);
  });

  it('send → auto_submit report with the previewed screenshot; prompt cleared, no cooldown', async () => {
    renderLeaf();
    act(() => autoSubmitStore.getState().openPrompt(6, Date.now(), FROZEN));
    act(() => lastToast().action.onClick());
    await act(async () => { await dialogProps.current?.onSubmit('heavy model'); });

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'auto_submit', metrics: FROZEN, comment: 'heavy model',
      screenshotDataUrl: 'data:image/png;base64,SHOT', projectId: 'proj_1',
    }));
    expect(autoSubmitStore.getState().phase).toBe('idle');
    expect(autoSubmitStore.getState().lastDeclinedAt).toBeNull();
  });

  it('a failed send keeps the review open (no silent loss)', async () => {
    sendMock.mockRejectedValue(new Error('503'));
    renderLeaf();
    act(() => autoSubmitStore.getState().openPrompt(6, Date.now(), FROZEN));
    act(() => lastToast().action.onClick());
    await act(async () => {
      await expect(dialogProps.current?.onSubmit('')).rejects.toThrow('503');
    });
    expect(autoSubmitStore.getState().phase).toBe('reviewing');
  });

  it('«Όχι τώρα» → idle + cooldown', () => {
    renderLeaf();
    act(() => autoSubmitStore.getState().openPrompt(6, Date.now(), FROZEN));
    act(() => lastToast().cancel.onClick());
    expect(autoSubmitStore.getState().phase).toBe('idle');
    expect(autoSubmitStore.getState().lastDeclinedAt).not.toBeNull();
  });
});
