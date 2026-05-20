/**
 * file-download-writer — ADR-366 §B.5
 * Pure helper. No React. Downloads stats JSON + screenshot PNG (no JSZip — 2-blob fallback).
 */

import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

export async function downloadStatsAndScreenshot(
  metrics: PerformanceMetricsSnapshot,
  renderMode: string,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const iso = nowISO();
  const stamp = iso.replace(/[:.]/g, '-');

  const jsonBlob = new Blob(
    [JSON.stringify({ version: 1, renderMode, timestamp: iso, metrics }, null, 2)],
    { type: 'application/json' },
  );
  triggerExportDownload({ blob: jsonBlob, filename: `bim3d-stats-${stamp}.json` });

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
        triggerExportDownload({ blob, filename: `bim3d-screenshot-${stamp}.png` });
        resolve();
      },
      'image/png',
    );
  });
}
