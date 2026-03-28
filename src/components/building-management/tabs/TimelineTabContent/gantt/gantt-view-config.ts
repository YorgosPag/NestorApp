/**
 * gantt-view-config — Types and constants for GanttView (ADR-034)
 *
 * Extracted from GanttView.tsx for SRP compliance (Google file-size standards).
 * Contains all shared interfaces, status color mapping, and view mode options.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import { ViewMode } from 'react-modern-gantt';
import type { GanttTaskStatus } from './gantt-mock-data';
import type { Building } from '../../../BuildingsPageContent';

// ─── Types ────────────────────────────────────────────────────────────────

export interface GanttViewProps {
  building: Building;
}

export interface GanttContextMenuState {
  x: number;
  y: number;
  taskId: string;
  groupId: string;
  isPhaseBar: boolean;
}

export interface ColorPickerTarget {
  id: string;
  isPhase: boolean;
  currentColor: string;
}

export interface HoverTooltipData {
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  x: number;
  y: number;
}

// ─── Gantt Bar Color Resolver ─────────────────────────────────────────────

export const STATUS_TO_CSS_COLOR: Record<GanttTaskStatus, string> = {
  completed: 'hsl(var(--status-success))', // eslint-disable-line custom/no-hardcoded-strings
  inProgress: 'hsl(var(--status-info))', // eslint-disable-line custom/no-hardcoded-strings
  notStarted: 'hsl(var(--muted-foreground))', // eslint-disable-line custom/no-hardcoded-strings
  delayed: 'hsl(var(--status-error))', // eslint-disable-line custom/no-hardcoded-strings
  blocked: 'hsl(var(--status-warning))', // eslint-disable-line custom/no-hardcoded-strings
};

// ─── View Mode Options ────────────────────────────────────────────────────

export const AVAILABLE_VIEW_MODES: ViewMode[] = [
  ViewMode.DAY,
  ViewMode.WEEK,
  ViewMode.MONTH,
  ViewMode.QUARTER,
  ViewMode.YEAR,
];
