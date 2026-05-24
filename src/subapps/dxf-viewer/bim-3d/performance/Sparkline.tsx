'use client';

/**
 * Sparkline — ADR-366 §C.7.Q1
 *
 * Pure presentational. Hand-rolled SVG polyline, zero dependencies.
 * Subsamples 240 → 40 points (every 6th sample) for cheap path generation.
 */

import { cn } from '@/lib/utils';
import { TIER_TEXT_CLASS, type MetricTier } from './performance-thresholds';

interface SparklineProps {
  samples: readonly number[];
  width?: number;
  height?: number;
  tier: MetricTier;
  ariaLabel: string;
}

const DEFAULT_WIDTH = 40;
const DEFAULT_HEIGHT = 16;
const TARGET_POINTS = 40;

export function Sparkline({
  samples,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  tier,
  ariaLabel,
}: SparklineProps) {
  if (samples.length === 0) return null;

  const step = Math.max(1, Math.floor(samples.length / TARGET_POINTS));
  const display: number[] = [];
  for (let i = 0; i < samples.length; i += step) display.push(samples[i]);

  let min = Infinity;
  let max = -Infinity;
  for (const v of display) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;

  const lastY = range === 0
    ? height / 2
    : height - ((display[display.length - 1] - min) / range) * height;

  const points = display.map((v, idx) => {
    const x = (idx / Math.max(1, display.length - 1)) * width;
    const y = range === 0 ? height / 2 : height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('inline-block align-middle', TIER_TEXT_CLASS[tier])}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={lastY} r="1.2" fill="currentColor" />
    </svg>
  );
}
