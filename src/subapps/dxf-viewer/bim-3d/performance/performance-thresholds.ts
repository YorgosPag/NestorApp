/**
 * PERFORMANCE_THRESHOLDS — ADR-366 §B.5.Q2
 *
 * 3-tier color coding for the Performance HUD.
 * invert: true  → higher value is better (fps)
 * invert: false → lower value is better (frameTime, drawCalls, memory)
 */

export const PERFORMANCE_THRESHOLDS = {
  fps:          { good: 45,        warn: 25,        invert: true  },
  frameTimeMs:  { good: 22,        warn: 40,        invert: false },
  drawCalls:    { good: 1500,      warn: 3000,      invert: false },
  gpuMemoryPct: { good: 60,        warn: 85,        invert: false },
  triangles:    { good: 1_000_000, warn: 3_000_000, invert: false },
} as const;

export type MetricTier = 'good' | 'warn' | 'critical';

type ThresholdKey = keyof typeof PERFORMANCE_THRESHOLDS;

/** Maps MetricTier to ADR-365 semantic Tailwind token (text utility). */
export const TIER_TEXT_CLASS: Record<MetricTier, string> = {
  good:     'text-[hsl(var(--text-success))]',
  warn:     'text-[hsl(var(--text-warning))]',
  critical: 'text-destructive',
};

/** Maps MetricTier to ADR-365 semantic Tailwind token (bg utility, subtle). */
export const TIER_BG_CLASS: Record<MetricTier, string> = {
  good:     'bg-[hsl(var(--bg-success)/0.15)]',
  warn:     'bg-[hsl(var(--bg-warning)/0.15)]',
  critical: 'bg-destructive/10',
};

export function getMetricTier(name: string, value: number): MetricTier {
  if (!(name in PERFORMANCE_THRESHOLDS)) return 'good';
  const t = PERFORMANCE_THRESHOLDS[name as ThresholdKey];
  if (t.invert) {
    if (value >= t.good) return 'good';
    if (value >= t.warn) return 'warn';
    return 'critical';
  } else {
    if (value <= t.good) return 'good';
    if (value <= t.warn) return 'warn';
    return 'critical';
  }
}
