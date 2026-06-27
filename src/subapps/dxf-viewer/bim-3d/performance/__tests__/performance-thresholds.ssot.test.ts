/**
 * performance-thresholds — ADR-366 §B.5.U
 *
 * The single display-tier SSoT for the unified HUD. Boundary checks for the
 * invert (fps) and non-invert (frameTime / drawCalls / triangles / cpuMemory)
 * metrics, plus the unknown-metric fallback.
 */

import { getMetricTier, PERFORMANCE_THRESHOLDS } from '../performance-thresholds';

describe('getMetricTier — invert metric (fps, higher is better)', () => {
  it('>= good → good', () => {
    expect(getMetricTier('fps', 60)).toBe('good');
    expect(getMetricTier('fps', 45)).toBe('good');
  });
  it('in [warn, good) → warn', () => {
    expect(getMetricTier('fps', 44)).toBe('warn');
    expect(getMetricTier('fps', 25)).toBe('warn');
  });
  it('< warn → critical', () => {
    expect(getMetricTier('fps', 24)).toBe('critical');
  });
});

describe('getMetricTier — non-invert metrics (lower is better)', () => {
  it('frameTimeMs boundaries', () => {
    expect(getMetricTier('frameTimeMs', 22)).toBe('good');
    expect(getMetricTier('frameTimeMs', 40)).toBe('warn');
    expect(getMetricTier('frameTimeMs', 41)).toBe('critical');
  });
  it('drawCalls boundaries', () => {
    expect(getMetricTier('drawCalls', 1500)).toBe('good');
    expect(getMetricTier('drawCalls', 3000)).toBe('warn');
    expect(getMetricTier('drawCalls', 3001)).toBe('critical');
  });
  it('triangles boundaries', () => {
    expect(getMetricTier('triangles', 1_000_000)).toBe('good');
    expect(getMetricTier('triangles', 3_000_000)).toBe('warn');
    expect(getMetricTier('triangles', 3_000_001)).toBe('critical');
  });
  it('cpuMemoryMb boundaries (2D primary memory metric)', () => {
    expect(getMetricTier('cpuMemoryMb', 256)).toBe('good');
    expect(getMetricTier('cpuMemoryMb', 512)).toBe('warn');
    expect(getMetricTier('cpuMemoryMb', 513)).toBe('critical');
  });
});

describe('getMetricTier — unknown metric', () => {
  it('falls back to good', () => {
    expect(getMetricTier('nonexistent', 99999)).toBe('good');
  });
});

describe('PERFORMANCE_THRESHOLDS SSoT', () => {
  it('declares cpuMemoryMb so 2D memory is tiered', () => {
    expect(PERFORMANCE_THRESHOLDS.cpuMemoryMb).toEqual({ good: 256, warn: 512, invert: false });
  });
});
