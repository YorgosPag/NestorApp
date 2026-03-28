/**
 * @module reports/sections/crm/types
 * @enterprise ADR-265 Phase 8 — CRM & Pipeline view-model types
 */

export interface CrmReportPayload {
  totalOpportunities: number;
  pipelineByStage: Record<string, number>;
  pipelineValueByStage: Record<string, number>;
  wonCount: number;
  lostCount: number;
  winRate: number;
  avgDealValue: number;
  leadsBySource: Record<string, number>;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  overdueTasks: number;
  tasksByAssignee: Record<string, number>;
  totalCommunications: number;
  communicationsByChannel: Record<string, number>;
  communicationsByDirection: Record<string, number>;
  generatedAt: string;
}

export interface PipelineStageItem {
  stage: string;
  count: number;
  value: number;
}

export interface TaskDistributionItem {
  name: string;
  value: number;
}

export interface ChannelItem {
  channel: string;
  count: number;
}

export interface AssigneeItem {
  assignee: string;
  completed: number;
}

export interface SourceItem {
  name: string;
  value: number;
}
