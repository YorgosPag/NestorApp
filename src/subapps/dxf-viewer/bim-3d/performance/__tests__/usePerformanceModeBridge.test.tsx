/**
 * usePerformanceModeBridge — ADR-366 §B.5.U
 *
 * Verifies the bridge mirrors ViewMode3DStore.mode into the HUD store and drives
 * the 2D collector lifecycle (start in 2D, stop in 3D, dispose on unmount).
 */

const startSpy = jest.fn();
const stopSpy = jest.fn();
const disposeSpy = jest.fn();

jest.mock('../Performance2DCollector', () => ({
  Performance2DCollector: jest.fn().mockImplementation(() => ({
    start: startSpy,
    stop: stopSpy,
    dispose: disposeSpy,
  })),
}));

import { act, renderHook } from '@testing-library/react';
import { usePerformanceModeBridge } from '../usePerformanceModeBridge';
import { usePerformanceHUDStore } from '../PerformanceHUDStore';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';

describe('usePerformanceModeBridge', () => {
  beforeEach(() => {
    startSpy.mockClear();
    stopSpy.mockClear();
    disposeSpy.mockClear();
    useViewMode3DStore.setState({ mode: '2d' });
    usePerformanceHUDStore.setState({ renderMode: '3d-raster' });
  });

  it('on mount in 2D → mirrors mode and starts the 2D collector', () => {
    renderHook(() => usePerformanceModeBridge());
    expect(usePerformanceHUDStore.getState().renderMode).toBe('2d');
    expect(startSpy).toHaveBeenCalled();
    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('switching to 3D → mirrors mode and stops the 2D collector', () => {
    renderHook(() => usePerformanceModeBridge());
    startSpy.mockClear();

    act(() => { useViewMode3DStore.setState({ mode: '3d-raster' }); });

    expect(usePerformanceHUDStore.getState().renderMode).toBe('3d-raster');
    expect(stopSpy).toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('unmount → disposes the 2D collector', () => {
    const { unmount } = renderHook(() => usePerformanceModeBridge());
    unmount();
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('returns the current mode', () => {
    const { result } = renderHook(() => usePerformanceModeBridge());
    expect(result.current).toBe('2d');
  });
});
