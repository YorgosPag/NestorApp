/**
 * @module schedule-dashboard.types
 * @enterprise ADR-266 Phase A — Schedule Dashboard view-model types
 *
 * Types consumed by the dashboard components. All data is computed
 * client-side from existing ConstructionPhase/Task/BOQ data.
 */

import type { ConstructionPhaseStatus, ConstructionTaskStatus, DelayReason } from '@/types/building/construction';
import type { RAGStatus } from '@/components/reports/core/ReportTrafficLight';
import type { SCurveDataPoint } from '@/services/report-engine/evm-calculator';

// ─── Variance Table ──────────────────────────────────────────────────────

export interface ScheduleVarianceRow {
  id: string;
  name: string;
  code: string;
  type: 'phase' | 'task';
  /** phaseId for tasks — undefined for phases */
  parentId?: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  /** Positive = late (days behind schedule) */
  varianceDays: number;
  status: ConstructionPhaseStatus | ConstructionTaskStatus;
  progress: number;
  ragStatus: RAGStatus;
}

// ─── Lookahead Table ─────────────────────────────────────────────────────

export interface LookaheadRow {
  id: string;
  taskName: string;
  phaseName: string;
  phaseCode: string;
  start: string;
  end: string;
  durationDays: number;
  status: ConstructionTaskStatus;
}

// ─── KPIs ────────────────────────────────────────────────────────────────

export interface ScheduleKPIs {
  overallProgress: number;
  expectedProgress: number;
  spi: number;
  cpi: number;
  daysRemaining: number;
  phasesOnTrack: number;
  totalPhases: number;
  delayedTasks: number;
  totalTasks: number;
}

// ─── Delay Breakdown ────────────────────────────────────────────────

export interface DelayBreakdownDataPoint {
  phaseId: string;
  phaseName: string;
  phaseCode: string;
  /** Tasks with status === 'delayed' */
  delayed: number;
  /** Tasks with status === 'blocked' */
  blocked: number;
  /** delayed + blocked */
  total: number;
  /** Per-reason breakdown for delayed+blocked combined (ADR-266 Phase C) */
  byReason: Record<DelayReason | 'unspecified', number>;
}

// ─── Hook Return ─────────────────────────────────────────────────────────

export interface ScheduleDashboardData {
  kpis: ScheduleKPIs;
  sCurveData: SCurveDataPoint[];
  varianceRows: ScheduleVarianceRow[];
  lookaheadRows: LookaheadRow[];
  delayBreakdownData: DelayBreakdownDataPoint[];
  loading: boolean;
  boqLoading: boolean;
  lastUpdated: Date | null;
}
