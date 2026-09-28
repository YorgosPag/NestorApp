import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn() },
}));

jest.mock('@/config/domain-constants', () => ({
  API_ROUTES: {
    FLOORPLAN_BACKGROUNDS: {
      CALIBRATE: (id: string) => `/api/floorplan-backgrounds/${id}/calibrate`,
    },
  },
}));

import { CalibrateScaleDialog } from '../CalibrateScaleDialog';
import { apiClient } from '@/lib/api/enterprise-api-client';
const mockPost = apiClient.post as jest.Mock;

/**
 * 🔴 ADR-884 Φ2στ-β · §4.13: η εικόνα έχει **διπλάσιο** φυσικό μέγεθος από τον καμβά (1280×840 σε 640×420). Ένα κλικ
 * 100 pixel καμβά = 200 pixel εικόνας — αν ο διάλογος μετρούσε σε pixel καμβά (το σφάλμα ως 2026-09-27), η κλίμακα θα
 * έβγαινε η μισή.
 */
class LoadedImage {
  naturalWidth = 1280;
  naturalHeight = 840;
  crossOrigin = '';
  onload: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const RealImage = global.Image;
beforeAll(() => { global.Image = LoadedImage as unknown as typeof Image; });
afterAll(() => { global.Image = RealImage; });

function mkProps(overrides = {}) {
  return {
    open: true,
    onOpenChange: jest.fn(),
    backgroundId: 'bg-001',
    imageSrc: 'blob:plan',
    onCalibrated: jest.fn(),
    ...overrides,
  };
}

/** Περιμένει να «φορτώσει» η εικόνα, και κάνει δύο κλικ στον καμβά. */
async function clickCanvas(x1: number, y1: number, x2: number, y2: number) {
  await act(async () => { await Promise.resolve(); });
  const canvas = document.querySelector('canvas') as HTMLElement;
  Object.defineProperty(canvas, 'width', { value: 640, configurable: true });
  Object.defineProperty(canvas, 'height', { value: 420, configurable: true });
  jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, right: 640, bottom: 420, width: 640, height: 420, x: 0, y: 0 } as DOMRect,
  );
  fireEvent.click(canvas, { clientX: x1, clientY: y1 });
  fireEvent.click(canvas, { clientX: x2, clientY: y2 });
}

function typeDistance(value: string) {
  fireEvent.change(document.getElementById('cal-distance') as HTMLInputElement, { target: { value } });
}

describe('CalibrateScaleDialog', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('renders dialog title when open', () => {
    render(<CalibrateScaleDialog {...mkProps()} />);
    expect(screen.getByText('floorplan.calibrate.title')).toBeInTheDocument();
  });

  it('save button disabled until 2 points + real distance entered', async () => {
    render(<CalibrateScaleDialog {...mkProps()} />);
    const saveBtn = screen.getByText('floorplan.calibrate.save');
    expect(saveBtn).toBeDisabled();
  });

  it('2-click + distance → POST with the scale in IMAGE pixels (not canvas pixels)', async () => {
    mockPost.mockResolvedValueOnce({});
    const onCalibrated = jest.fn();
    const onOpenChange = jest.fn();
    render(<CalibrateScaleDialog {...mkProps({ onCalibrated, onOpenChange })} />);

    // 300 pixel καμβά οριζόντια = 600 pixel εικόνας · 3 μέτρα ⇒ 200 pixel εικόνας ανά μέτρο.
    await clickCanvas(100, 200, 400, 200);
    typeDistance('3');

    const saveBtn = screen.getByText('floorplan.calibrate.save');
    expect(saveBtn).not.toBeDisabled();
    await act(async () => { fireEvent.click(saveBtn); });

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0] as [string, { scale: { unitsPerMeter: number } }];
    expect(url).toContain('bg-001');
    expect(body.scale.unitsPerMeter).toBeCloseTo(200);
    expect(onCalibrated).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('onSave instead of backgroundId: the consumer persists, no POST', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<CalibrateScaleDialog open onOpenChange={jest.fn()} imageSrc="blob:plan" onSave={onSave} />);
    await clickCanvas(100, 200, 400, 200);
    typeDistance('300');
    await act(async () => { fireEvent.click(screen.getByText('floorplan.calibrate.save')); });
    // 600 pixel εικόνας για 300 m ⇒ 2 pixel εικόνας ανά μέτρο.
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBeCloseTo(2);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('pixelSpace: a derivative is shown, the scale is in the ORIGINAL pixels (ADR-884 §4.13, measured live)', async () => {
    // Φορτώνεται παράγωγο 1280×840· το πρωτότυπο είναι 2560×1680. Τα ίδια κλικ = 1200 pixel πρωτοτύπου ⇒ 4 px/m, όχι 2.
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<CalibrateScaleDialog open onOpenChange={jest.fn()} imageSrc="blob:plan" onSave={onSave}
      pixelSpace={{ width: 2560, height: 1680 }} />);
    await clickCanvas(100, 200, 400, 200);
    typeDistance('300');
    await act(async () => { fireEvent.click(screen.getByText('floorplan.calibrate.save')); });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBeCloseTo(4);
  });

  it('shows error message when POST rejects', async () => {
    mockPost.mockRejectedValueOnce(new Error('network failure'));
    render(<CalibrateScaleDialog {...mkProps()} />);
    await clickCanvas(100, 100, 200, 200);
    typeDistance('1');
    await act(async () => { fireEvent.click(screen.getByText('floorplan.calibrate.save')); });
    await waitFor(() => expect(screen.getByText('network failure')).toBeInTheDocument());
  });

  it('zero-distance points shows error without POST', async () => {
    render(<CalibrateScaleDialog {...mkProps()} />);
    // Both clicks same pixel → dist = 0
    await clickCanvas(100, 100, 100, 100);
    typeDistance('1');
    await act(async () => { fireEvent.click(screen.getByText('floorplan.calibrate.save')); });
    expect(screen.getByText('floorplan.calibrate.errorZeroDistance')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('without a loaded image a click is ignored — there is no image pixel to measure', async () => {
    render(<CalibrateScaleDialog {...mkProps({ imageSrc: null })} />);
    await clickCanvas(100, 100, 200, 200);
    typeDistance('1');
    expect(screen.getByText('floorplan.calibrate.save')).toBeDisabled();
  });
});
