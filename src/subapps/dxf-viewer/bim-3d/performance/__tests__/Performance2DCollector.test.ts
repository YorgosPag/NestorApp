/**
 * Performance2DCollector — ADR-366 §B.5.U
 *
 * Verifies the 2D source writes the shared HUD + history stores only when the
 * HUD is enabled AND the active viewport is 2D, reports WebGL-only metrics as
 * null, and tears down its frame subscription + interval on stop().
 */

// Mock the frame scheduler so the test can drive frame metrics deterministically.
jest.mock('../../../rendering/core/UnifiedFrameScheduler', () => {
  const listeners: Array<(m: { averageFps: number }) => void> = [];
  return {
    UnifiedFrameScheduler: {
      onFrame: (cb: (m: { averageFps: number }) => void) => {
        listeners.push(cb);
        return () => {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      __emit: (averageFps: number) => listeners.forEach((l) => l({ averageFps })),
      __count: () => listeners.length,
    },
  };
});

import { Performance2DCollector } from '../Performance2DCollector';
import { usePerformanceHUDStore } from '../PerformanceHUDStore';
import { usePerformanceHistoryStore } from '../PerformanceHistoryStore';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { UnifiedFrameScheduler } from '../../../rendering/core/UnifiedFrameScheduler';

const scheduler = UnifiedFrameScheduler as unknown as {
  __emit: (fps: number) => void;
  __count: () => number;
};

function setMemory(usedMb: number | null): void {
  if (usedMb === null) {
    Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
  } else {
    Object.defineProperty(performance, 'memory', {
      value: { usedJSHeapSize: usedMb * 1_048_576 },
      configurable: true,
    });
  }
}

describe('Performance2DCollector', () => {
  let collector: Performance2DCollector;

  beforeEach(() => {
    jest.useFakeTimers();
    usePerformanceHUDStore.setState({ enabled: false, metrics: null });
    usePerformanceHistoryStore.setState({ enabled: true, writeIndex: 0, samplesWritten: 0 });
    useViewMode3DStore.setState({ mode: '2d' });
    setMemory(50);
    collector = new Performance2DCollector();
  });

  afterEach(() => {
    collector.dispose();
    jest.useRealTimers();
  });

  it('writes a real-fps snapshot when enabled and mode === "2d"', () => {
    usePerformanceHUDStore.setState({ enabled: true });
    collector.start();
    scheduler.__emit(31);
    jest.advanceTimersByTime(250);

    const m = usePerformanceHUDStore.getState().metrics;
    expect(m).not.toBeNull();
    expect(m!.fps).toBe(31);
    expect(m!.cpuMemoryMb).toBeCloseTo(50, 1);
  });

  it('reports all WebGL-only metrics as null in 2D', () => {
    usePerformanceHUDStore.setState({ enabled: true });
    collector.start();
    scheduler.__emit(60);
    jest.advanceTimersByTime(250);

    const m = usePerformanceHUDStore.getState().metrics!;
    expect(m.triangles).toBeNull();
    expect(m.vertices).toBeNull();
    expect(m.drawCalls).toBeNull();
    expect(m.objectsVisible).toBeNull();
    expect(m.objectsTotal).toBeNull();
    expect(m.gpuMemoryMb).toBeNull();
    expect(m.samplesPerSec).toBeNull();
  });

  it('does NOT write when the HUD is disabled', () => {
    usePerformanceHUDStore.setState({ enabled: false });
    collector.start();
    scheduler.__emit(45);
    jest.advanceTimersByTime(250);
    expect(usePerformanceHUDStore.getState().metrics).toBeNull();
  });

  it('does NOT write when the active viewport is not 2D', () => {
    usePerformanceHUDStore.setState({ enabled: true });
    useViewMode3DStore.setState({ mode: '3d-raster' });
    collector.start();
    scheduler.__emit(45);
    jest.advanceTimersByTime(250);
    expect(usePerformanceHUDStore.getState().metrics).toBeNull();
  });

  it('reports cpuMemoryMb null when performance.memory is unavailable', () => {
    setMemory(null);
    usePerformanceHUDStore.setState({ enabled: true });
    collector.start();
    scheduler.__emit(30);
    jest.advanceTimersByTime(250);
    expect(usePerformanceHUDStore.getState().metrics!.cpuMemoryMb).toBeNull();
  });

  it('stop() unsubscribes from frames and clears the interval', () => {
    usePerformanceHUDStore.setState({ enabled: true });
    collector.start();
    expect(scheduler.__count()).toBe(1);

    collector.stop();
    expect(scheduler.__count()).toBe(0);

    // No further writes after stop.
    usePerformanceHUDStore.setState({ metrics: null });
    scheduler.__emit(30);
    jest.advanceTimersByTime(500);
    expect(usePerformanceHUDStore.getState().metrics).toBeNull();
  });
});
