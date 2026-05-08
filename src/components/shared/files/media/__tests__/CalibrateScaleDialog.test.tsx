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

function mkProps(overrides = {}) {
  return {
    open: true,
    onOpenChange: jest.fn(),
    backgroundId: 'bg-001',
    imageSrc: null,
    onCalibrated: jest.fn(),
    ...overrides,
  };
}

/** Simulate two canvas clicks at different positions */
function clickCanvas(canvas: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
  Object.defineProperty(canvas, 'width', { value: 640, configurable: true });
  Object.defineProperty(canvas, 'height', { value: 420, configurable: true });
  jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, right: 640, bottom: 420, width: 640, height: 420, x: 0, y: 0 } as DOMRect,
  );
  fireEvent.click(canvas, { clientX: x1, clientY: y1 });
  fireEvent.click(canvas, { clientX: x2, clientY: y2 });
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

  it('2-click + distance → POST called with computed scale', async () => {
    mockPost.mockResolvedValueOnce({});
    const onCalibrated = jest.fn();
    const onOpenChange = jest.fn();
    render(<CalibrateScaleDialog {...mkProps({ onCalibrated, onOpenChange })} />);

    const canvas = document.querySelector('canvas') as HTMLElement;
    clickCanvas(canvas, 100, 100, 200, 200);

    const distInput = document.getElementById('cal-distance') as HTMLInputElement;
    fireEvent.change(distInput, { target: { value: '1' } });

    const saveBtn = screen.getByText('floorplan.calibrate.save');
    expect(saveBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0] as [string, { scale: { unitsPerMeter: number } }];
    expect(url).toContain('bg-001');
    expect(body.scale.unitsPerMeter).toBeGreaterThan(0);
    expect(onCalibrated).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error message when POST rejects', async () => {
    mockPost.mockRejectedValueOnce(new Error('network failure'));
    render(<CalibrateScaleDialog {...mkProps()} />);

    const canvas = document.querySelector('canvas') as HTMLElement;
    clickCanvas(canvas, 100, 100, 200, 200);

    const distInput = document.getElementById('cal-distance') as HTMLInputElement;
    fireEvent.change(distInput, { target: { value: '1' } });

    await act(async () => {
      fireEvent.click(screen.getByText('floorplan.calibrate.save'));
    });

    await waitFor(() => expect(screen.getByText('network failure')).toBeInTheDocument());
  });

  it('zero-distance points shows error without POST', async () => {
    render(<CalibrateScaleDialog {...mkProps()} />);

    const canvas = document.querySelector('canvas') as HTMLElement;
    // Both clicks same pixel → dist = 0
    clickCanvas(canvas, 100, 100, 100, 100);

    const distInput = document.getElementById('cal-distance') as HTMLInputElement;
    fireEvent.change(distInput, { target: { value: '1' } });

    await act(async () => {
      fireEvent.click(screen.getByText('floorplan.calibrate.save'));
    });

    expect(screen.getByText('floorplan.calibrate.errorZeroDistance')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
