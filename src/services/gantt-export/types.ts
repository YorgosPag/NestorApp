/**
 * Gantt Chart Export — Types & Interfaces (ADR-034)
 *
 * Type definitions for the Gantt export pipeline.
 * Supports PDF, PNG, SVG, and Excel export formats.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import type { TaskGroup } from 'react-modern-gantt';

/** Supported export formats */
export type GanttExportFormat = 'pdf' | 'png' | 'svg' | 'excel';

/** Options passed to each export function */
export interface GanttExportOptions {
  /** Target format */
  format: GanttExportFormat;
  /** Output filename (with extension) */
  filename: string;
  /** Building name — used as PDF header / Excel metadata */
  buildingName: string;
  /** Task data for PDF table & Excel sheets */
  taskGroups: TaskGroup[];
  /** DOM element ref to capture for image-based exports */
  chartElement: HTMLElement;
}

/** Flattened row for PDF table & Excel sheet */
export interface GanttTaskExportRow {
  phaseName: string;
  taskName: string;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  status: string;
}
