/**
 * =============================================================================
 * AI PIPELINE — BARREL EXPORTS
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Central export point for the Universal AI Pipeline module.
 *
 * @module services/ai-pipeline
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 */

// Core services
export { PipelineOrchestrator } from './pipeline-orchestrator';
export type { PipelineExecutionResult } from './pipeline-orchestrator';

export { ModuleRegistry, getModuleRegistry } from './module-registry';

export { IntentRouter } from './intent-router';
export type { IntentRoutingResult } from './intent-router';

export { PipelineAuditService, getPipelineAuditService } from './audit-service';

// Queue service
export {
  enqueuePipelineItem,
  claimNextPipelineItems,
  claimRetryablePipelineItems,
  markPipelineItemCompleted,
  markPipelineItemFailed,
  recoverStalePipelineItems,
  getPipelineQueueStats,
} from './pipeline-queue-service';
export type {
  EnqueuePipelineParams,
  PipelineQueueStats,
} from './pipeline-queue-service';

// Channel adapters
export { EmailChannelAdapter } from './channel-adapters/email-channel-adapter';
export type {
  FeedToPipelineParams,
  FeedToPipelineResult,
} from './channel-adapters/email-channel-adapter';
