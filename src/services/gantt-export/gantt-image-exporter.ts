/**
 * Gantt Image Exporter (ADR-034)
 *
 * Exports the Gantt chart as PNG or SVG.
 * Uses html-to-image for DOM capture.
 * Captures full chart content including scrolled areas.
 */

import { captureGanttAsDataUrl, triggerDownload } from './gantt-export-utils';

/**
 * Exports the Gantt chart as a PNG or SVG image file.
 * Temporarily expands the overflow container to capture the full timeline.
 */
export async function exportGanttAsImage(
  chartElement: HTMLElement,
  format: 'png' | 'svg',
  filename: string,
): Promise<void> {
  const dataUrl = await captureGanttAsDataUrl(chartElement, format);
  triggerDownload(dataUrl, filename);
}
