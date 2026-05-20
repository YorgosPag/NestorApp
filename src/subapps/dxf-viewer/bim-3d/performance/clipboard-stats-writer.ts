/**
 * clipboard-stats-writer — ADR-366 §B.5
 * Pure helper. No React. Copies metrics snapshot to clipboard as JSON.
 */

import { nowISO } from '@/lib/date-local';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

export async function copyStatsToClipboard(
  metrics: PerformanceMetricsSnapshot,
  renderMode: string,
): Promise<void> {
  const payload = JSON.stringify(
    {
      version: 1,
      renderMode,
      timestamp: nowISO(),
      metrics,
    },
    null,
    2,
  );
  await navigator.clipboard.writeText(payload);
}
