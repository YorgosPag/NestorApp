/**
 * Tests for the browser-performance-memory SSoT (ADR-546).
 */

import {
  readPerformanceMemory,
  readCpuMemoryMb,
} from '../browser-performance-memory';

interface MemoryShape {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function setMemory(value: MemoryShape | undefined): void {
  Object.defineProperty(performance, 'memory', { value, configurable: true });
}

describe('browser-performance-memory SSoT', () => {
  afterEach(() => {
    setMemory(undefined);
  });

  describe('readPerformanceMemory', () => {
    it('returns the raw byte snapshot when the Chrome API is present', () => {
      const snapshot: MemoryShape = {
        usedJSHeapSize: 12_582_912,
        totalJSHeapSize: 25_165_824,
        jsHeapSizeLimit: 2_147_483_648,
      };
      setMemory(snapshot);
      expect(readPerformanceMemory()).toEqual(snapshot);
    });

    it('returns null when performance.memory is unavailable', () => {
      setMemory(undefined);
      expect(readPerformanceMemory()).toBeNull();
    });
  });

  describe('readCpuMemoryMb', () => {
    it('converts used heap to MB rounded to 1 decimal', () => {
      // 52_428_800 bytes = exactly 50 MB
      setMemory({ usedJSHeapSize: 52_428_800, totalJSHeapSize: 0, jsHeapSizeLimit: 0 });
      expect(readCpuMemoryMb()).toBe(50);
    });

    it('rounds to 1 decimal place', () => {
      // 1_572_864 bytes = 1.5 MB
      setMemory({ usedJSHeapSize: 1_572_864, totalJSHeapSize: 0, jsHeapSizeLimit: 0 });
      expect(readCpuMemoryMb()).toBe(1.5);
    });

    it('returns null when the API is unavailable', () => {
      setMemory(undefined);
      expect(readCpuMemoryMb()).toBeNull();
    });
  });
});
