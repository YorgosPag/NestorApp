/**
 * @module reports/sections/projects
 * @enterprise ADR-265 Phase 7 — Projects & Buildings section components
 */

export { ProjectsKPIs } from './ProjectsKPIs';
export { ProjectStatusChart } from './ProjectStatusChart';
export { ProjectProgressChart } from './ProjectProgressChart';
export { PropertyStatusChart } from './PropertyStatusChart';
export { RevenueByProjectChart } from './RevenueByProjectChart';
export { PricePerSqmChart } from './PricePerSqmChart';
export { BOQVarianceChart } from './BOQVarianceChart';
export { EnergyClassDistribution } from './EnergyClassDistribution';

export type {
  ProjectsReportPayload,
  RevenueByProjectItem,
  PropertyStatusByBuildingItem,
  EnergyClassItem,
} from './types';
