/**
 * Gantt Export Utilities (ADR-034)
 *
 * Shared helpers for all export formats:
 * - DOM capture (expand overflow → capture → restore)
 * - Data flattening (TaskGroup[] → GanttTaskExportRow[])
 * - Client-side file download trigger
 */

import { toPng, toSvg } from 'html-to-image';
import type { TaskGroup } from 'react-modern-gantt';
import { designTokens } from '@/styles/design-tokens';
import type { GanttTaskExportRow } from './types';

// ─── DOM Capture ──────────────────────────────────────────────────────────

/**
 * Captures the Gantt chart DOM as a data URL (PNG or SVG).
 *
 * The `.rmg-timeline-container` has `overflow-x: auto` which clips scrolled content.
 * This function temporarily expands the overflow, captures the full chart,
 * then restores the original styles.
 */
export async function captureGanttAsDataUrl(
  element: HTMLElement,
  format: 'png' | 'svg',
): Promise<string> {
  // Find the scrollable timeline container within the chart
  const scrollContainer = element.querySelector(
    '.rmg-timeline-container',
  ) as HTMLElement | null;

  // Save original inline styles for restoration
  const origStyles = scrollContainer
    ? {
        overflow: scrollContainer.style.overflow,
        width: scrollContainer.style.width,
        maxWidth: scrollContainer.style.maxWidth,
      }
    : null;

  try {
    // Temporarily expand to reveal full timeline (including scrolled areas)
    if (scrollContainer) {
      scrollContainer.style.overflow = 'visible';
      scrollContainer.style.width = 'auto';
      scrollContainer.style.maxWidth = 'none';
    }

    const captureFunc = format === 'png' ? toPng : toSvg;
    return await captureFunc(element, {
      backgroundColor: designTokens.colors.background.primary,
      quality: 1.0,
      pixelRatio: 2, // 2x DPI for crisp text
    });
  } finally {
    // Always restore original styles (even on error)
    if (scrollContainer && origStyles) {
      scrollContainer.style.overflow = origStyles.overflow;
      scrollContainer.style.width = origStyles.width;
      scrollContainer.style.maxWidth = origStyles.maxWidth;
    }
  }
}

// ─── Data Flattening ──────────────────────────────────────────────────────

/**
 * Flattens TaskGroup[] into a flat array of export rows.
 * Used by both PDF (autotable) and Excel export.
 */
export function flattenTaskGroupsToRows(
  taskGroups: TaskGroup[],
): GanttTaskExportRow[] {
  const rows: GanttTaskExportRow[] = [];

  for (const group of taskGroups) {
    for (const task of group.tasks) {
      const start =
        task.startDate instanceof Date
          ? task.startDate
          : new Date(task.startDate);
      const end =
        task.endDate instanceof Date ? task.endDate : new Date(task.endDate);
      const durationDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      rows.push({
        phaseName: group.name,
        taskName: task.name,
        startDate: start.toLocaleDateString('el-GR'),
        endDate: end.toLocaleDateString('el-GR'),
        duration: durationDays,
        progress: (task.progress as number) ?? 0,
        status: (task.taskStatus as string) ?? 'notStarted',
      });
    }
  }

  return rows;
}

// ─── Download Trigger ─────────────────────────────────────────────────────

/**
 * Triggers a browser download from a data URL or Blob.
 * Uses the standard anchor-click pattern (same as src/services/pdf/utils/download.ts).
 */
export function triggerDownload(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers a browser download from a Blob (for binary formats like Excel).
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

