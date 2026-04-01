/**
 * @module reports/sections/projects/types
 * @enterprise ADR-265 Phase 7 — Projects & Buildings view-model types
 */

import type {
  ProjectProgressItem,
  BuildingProgressItem,
  PricePerSqmItem,
  BOQVarianceItem,
} from '@/services/report-engine';

// ---------------------------------------------------------------------------
// API payload (returned by /api/reports/projects)
// ---------------------------------------------------------------------------

export interface ProjectsReportPayload {
  totalProjects: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalPortfolioValue: number;
  averageProgress: number;
  totalProperties: number;
  unitsByCommercialStatus: Record<string, number>;
  revenueByProject: Record<string, number>;
  projectNames: Record<string, string>;
  projectProgress: ProjectProgressItem[];
  buildingNames: Record<string, string>;
  buildingProgress: BuildingProgressItem[];
  unitsByBuilding: Record<string, Record<string, number>>;
  pricePerSqmByBuilding: PricePerSqmItem[];
  boqVarianceByBuilding: BOQVarianceItem[];
  energyClassDistribution: Record<string, number>;
  unitsByType: Record<string, number>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Chart-ready view-model types
// ---------------------------------------------------------------------------

export interface RevenueByProjectItem {
  project: string;
  revenue: number;
}

export interface PropertyStatusByBuildingItem {
  building: string;
  [status: string]: string | number;
}

export interface EnergyClassItem {
  name: string;
  value: number;
}

export {
  type ProjectProgressItem,
  type BuildingProgressItem,
  type PricePerSqmItem,
  type BOQVarianceItem,
};
