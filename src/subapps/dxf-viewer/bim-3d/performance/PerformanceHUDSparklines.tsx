'use client';

/**
 * PerformanceHUDSparklines — ADR-366 §C.7.Q1
 *
 * Micro-leaf wrapper (ADR-040): one useSyncExternalStore per metric.
 * Subscribes to PerformanceHistoryStore.revision so only the affected
 * sparkline re-renders when new samples land.
 */

import { useSyncExternalStore } from 'react';
import { Sparkline } from './Sparkline';
import {
  usePerformanceHistoryStore,
  type SparklineMetric,
} from './PerformanceHistoryStore';
import type { MetricTier } from './performance-thresholds';

interface Props {
  metricKey: SparklineMetric;
  tier: MetricTier;
  ariaLabel: string;
}

export function PerformanceHUDSparklines({ metricKey, tier, ariaLabel }: Props) {
  // Subscribe to `revision` so the leaf re-renders on every pushSample / clear.
  useSyncExternalStore(
    usePerformanceHistoryStore.subscribe,
    () => usePerformanceHistoryStore.getState().revision,
    () => 0,
  );

  const samples = usePerformanceHistoryStore.getState().getSeries(metricKey);

  return <Sparkline samples={samples} tier={tier} ariaLabel={ariaLabel} />;
}
