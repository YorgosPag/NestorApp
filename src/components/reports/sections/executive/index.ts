/**
 * @module reports/sections/executive
 * @enterprise ADR-265 Phase 4 — Executive Summary section components
 */

export { PortfolioKPIs } from './PortfolioKPIs';
export { ProjectHealthTable } from './ProjectHealthTable';
export { RevenueTrendChart } from './RevenueTrendChart';
export { TopOverdueCard } from './TopOverdueCard';
export { PipelineSummary } from './PipelineSummary';

export type {
  ProjectHealthRow,
  OverdueItem,
  RevenueTrendPoint,
  PipelineStageData,
} from './types';
