/**
 * Milestone Export Types (ADR-034)
 *
 * Type definitions for milestone PDF & Excel export.
 */

import type { Milestone } from '@/components/building-management/tabs/TimelineTabContent/MilestoneItem';

export type MilestoneExportFormat = 'pdf' | 'excel';

export interface MilestoneExportOptions {
  format: MilestoneExportFormat;
  filename: string;
  buildingName: string;
  buildingProgress: number;
  milestones: Milestone[];
  /** Company name — shown in report header & Excel summary */
  companyName?: string;
  /** Project name — shown in report header & Excel summary */
  projectName?: string;
}

export interface MilestoneExportRow {
  index: number;
  title: string;
  description: string;
  date: string;
  status: string;
  statusRaw: string;
  progress: number;
  type: string;
}
