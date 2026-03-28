/**
 * @module reports/sections/construction/types
 * @enterprise ADR-265 Phase 11 — Construction & Timeline view-model types
 */

import type { EVMResult } from '@/services/report-engine';

export interface ConstructionReportPayload {
  evmByBuilding: Record<string, EVMResult>;
  milestonesByStatus: Record<string, number>;
  totalMilestones: number;
  completedMilestones: number;
  phasesCount: number;
  averagePhaseProgress: number;
  boqEstimatedTotal: number;
  boqActualTotal: number;
  boqVariance: number;
  generatedAt: string;
}

export interface EVMBuildingItem {
  building: string;
  earnedValue: number;
  actualCost: number;
  budgetAtCompletion: number;
  cpi: number;
  spi: number;
}

export interface BOQComparisonItem {
  building: string;
  estimated: number;
  actual: number;
}
