/**
 * Shared types for the AI Pipeline orchestrator and its extracted modules.
 * Prevents circular dependencies between pipeline-orchestrator and sub-modules.
 *
 * @module services/ai-pipeline/pipeline-types
 */

import type { PipelineContext, PipelineStateValue } from '@/types/ai-pipeline';

/** Result returned by pipeline execution (full or resumed) */
export interface PipelineExecutionResult {
  success: boolean;
  requestId: string;
  finalState: PipelineStateValue;
  context: PipelineContext;
  auditId?: string;
  error?: string;
}
