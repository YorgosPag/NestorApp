/**
 * UC-017 Gantt AI Types — ADR-034 §12
 *
 * Types for the 6 AI features: delay prediction, auto-scheduling,
 * risk assessment, resource optimization, natural language, photo progress.
 */

import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionResourceAssignment,
} from '@/types/building/construction';

// ─── Feature Taxonomy ────────────────────────────────────────────────────────

export type GanttAIFeature =
  | 'delay_prediction'
  | 'auto_scheduling'
  | 'risk_assessment'
  | 'resource_optimization'
  | 'natural_language'
  | 'photo_progress';

export type GanttAITier = 'FAST' | 'QUALITY' | 'VISION';

export const GANTT_AI_FEATURE_TIER: Record<GanttAIFeature, GanttAITier> = {
  delay_prediction: 'FAST',
  natural_language: 'FAST',
  risk_assessment: 'QUALITY',
  auto_scheduling: 'QUALITY',
  resource_optimization: 'QUALITY',
  photo_progress: 'VISION',
} as const;

// ─── Severity ────────────────────────────────────────────────────────────────

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

// ─── Result Types ────────────────────────────────────────────────────────────

export interface DelayPrediction {
  phaseId: string;
  phaseName: string;
  delayDays: number;
  confidence: number;       // 0-100
  reason: string;
  severity: RiskSeverity;
}

export interface RiskItem {
  type: 'overdue_task' | 'blocked_dependency' | 'resource_conflict' | 'critical_path';
  description: string;
  affectedPhaseIds: string[];
  severity: RiskSeverity;
  recommendation: string;
}

export interface ScheduleSuggestion {
  taskId: string;
  taskName: string;
  suggestedStartDate: string;  // ISO 8601
  suggestedEndDate: string;    // ISO 8601
  rationale: string;
  priority: number;            // 1 = highest
}

export interface ResourceConflict {
  resourceName: string;
  conflictingTaskIds: string[];
  overlappingPeriod: string;
  suggestion: string;
}

export interface PhotoProgressResult {
  estimatedProgress: number;  // 0-100
  confidence: number;         // 0-100
  observations: string[];
  detectedElements: string[];
}

export type NLQueryType =
  | 'delayed_tasks'
  | 'blocked_tasks'
  | 'upcoming_tasks'
  | 'phase_status'
  | 'general';

export interface NLQueryResult {
  queryType: NLQueryType;
  answer: string;
  matchedItems: Array<{ id: string; name: string; status: string }>;
}

// ─── Lookup Data Carrier ─────────────────────────────────────────────────────

export interface GanttAILookupData {
  feature: GanttAIFeature;
  buildingId: string | null;
  companyId: string;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  resourceAssignments: ConstructionResourceAssignment[];
  nlQuery: string | null;
  photoUrls: string[];
  // Analyzer results
  delayPredictions: DelayPrediction[];
  risks: RiskItem[];
  scheduleSuggestions: ScheduleSuggestion[];
  resourceConflicts: ResourceConflict[];
  nlResult: NLQueryResult | null;
  photoResult: PhotoProgressResult | null;
  analyzerError: string | null;
}
