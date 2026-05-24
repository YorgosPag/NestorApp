/**
 * UC-017 Gantt AI Module — Public API
 * @see ADR-034 §12 (UC-017 specification)
 */

export { GanttAIModule } from './gantt-ai-module';
export type {
  GanttAIFeature,
  GanttAITier,
  GanttAILookupData,
  DelayPrediction,
  RiskItem,
  ScheduleSuggestion,
  ResourceConflict,
  PhotoProgressResult,
  NLQueryResult,
} from './gantt-ai-types';
