/**
 * @module reports/sections/crm
 * @enterprise ADR-265 Phase 8 — CRM & Pipeline section components
 */

export { CrmKPIs } from './CrmKPIs';
export { PipelineFunnelChart } from './PipelineFunnelChart';
export { TaskDistributionChart } from './TaskDistributionChart';
export { CommunicationChannelChart } from './CommunicationChannelChart';
export { LeadSourceChart } from './LeadSourceChart';
export { TeamPerformanceChart } from './TeamPerformanceChart';

export type {
  CrmReportPayload,
  PipelineStageItem,
  TaskDistributionItem,
  ChannelItem,
  AssigneeItem,
  SourceItem,
} from './types';
