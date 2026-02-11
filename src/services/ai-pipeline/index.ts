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
  getProposedPipelineItems,
  updateApprovalDecision,
  getProposedItemStats,
} from './pipeline-queue-service';
export type {
  EnqueuePipelineParams,
  PipelineQueueStats,
  ProposedItemsQuery,
  ProposedItemStats,
} from './pipeline-queue-service';

// Operator Inbox service (UC-009)
export {
  processOperatorDecision,
} from './operator-inbox-service';
export type {
  OperatorApprovalParams,
  OperatorApprovalResult,
} from './operator-inbox-service';

// UC Modules
export { AppointmentModule } from './modules/uc-001-appointment';
export { PropertySearchModule } from './modules/uc-003-property-search';
export { registerAllPipelineModules } from './modules/register-modules';

// Channel adapters
export { EmailChannelAdapter } from './channel-adapters/email-channel-adapter';
export type {
  FeedToPipelineParams,
  FeedToPipelineResult,
} from './channel-adapters/email-channel-adapter';

// ADR-174: Messenger + Instagram channel adapters
export { MessengerChannelAdapter } from './channel-adapters/messenger-channel-adapter';
export type { MessengerFeedParams, MessengerFeedResult } from './channel-adapters/messenger-channel-adapter';
export { InstagramChannelAdapter } from './channel-adapters/instagram-channel-adapter';
export type { InstagramFeedParams, InstagramFeedResult } from './channel-adapters/instagram-channel-adapter';

// ADR-171: Agentic Loop
export { executeAgenticLoop } from './agentic-loop';
export type { AgenticResult, ChatMessage, AgenticLoopConfig } from './agentic-loop';

// ADR-171: Chat History Service
export { ChatHistoryService, getChatHistoryService } from './chat-history-service';

// ADR-171: Agentic Tools
export { getAgenticToolExecutor } from './tools/agentic-tool-executor';
export { AGENTIC_TOOL_DEFINITIONS } from './tools/agentic-tool-definitions';

// ADR-173: AI Self-Improvement
export { FeedbackService, getFeedbackService } from './feedback-service';
export type { FeedbackSnapshot, FeedbackRating, NegativeFeedbackCategory } from './feedback-service';
export {
  createFeedbackKeyboard,
  createNegativeCategoryKeyboard,
  createSuggestedActionsKeyboard,
  isFeedbackCallback,
  isCategoryCallback,
  isSuggestionCallback,
  parseFeedbackCallback,
  parseCategoryCallback,
  parseSuggestionCallback,
} from './feedback-keyboard';
export { LearningService, getLearningService } from './learning-service';
export { ToolAnalyticsService, getToolAnalyticsService } from './tool-analytics-service';
export { enhanceSystemPrompt } from './prompt-enhancer';

// ADR-173: Prompt Sanitizer (OWASP LLM01:2025)
export { sanitizeForPromptInjection, containsPromptInjection } from './shared/prompt-sanitizer';
