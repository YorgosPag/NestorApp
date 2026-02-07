/**
 * =============================================================================
 * AI PIPELINE CONFIGURATION
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Centralized configuration for the Universal AI Pipeline.
 * All thresholds, timeouts, and limits in one place — config-driven, not hardcoded.
 *
 * @module config/ai-pipeline-config
 * @see ADR-080 (Pipeline Implementation)
 * @see docs/centralized-systems/ai/reliability.md (Timeouts, Retries)
 * @see docs/centralized-systems/ai/contracts.md (Auto-approve threshold)
 */

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const PIPELINE_QUEUE_CONFIG = {
  /** Maximum retry attempts before dead letter */
  MAX_RETRIES: 3,

  /** Retry delay intervals (exponential backoff) in ms */
  RETRY_DELAYS_MS: [1_000, 4_000, 16_000] as const,

  /** Maximum items to claim per batch */
  BATCH_SIZE: 5,

  /** Maximum concurrent pipeline executions */
  MAX_CONCURRENCY: 3,

  /** Time after which a 'processing' item is considered stale (5 min) */
  STALE_PROCESSING_THRESHOLD_MS: 300_000,

  /** Queue polling interval in ms (used by cron/worker) */
  POLL_INTERVAL_MS: 15_000,
} as const;

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

export const PIPELINE_TIMEOUT_CONFIG = {
  /** Single AI API call timeout (30s) */
  SINGLE_AI_CALL_MS: 30_000,

  /** Individual pipeline step timeout (60s) */
  PIPELINE_STEP_MS: 60_000,

  /** Total pipeline execution timeout (5 min) */
  TOTAL_PIPELINE_MS: 300_000,
} as const;

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

export const PIPELINE_CONFIDENCE_CONFIG = {
  /**
   * Minimum confidence for auto-approval (no human review)
   * @see docs/centralized-systems/ai/contracts.md
   */
  AUTO_APPROVE_THRESHOLD: 90,

  /**
   * Below this threshold → always manual triage
   * Between MANUAL_TRIAGE and AUTO_APPROVE → module decides
   */
  MANUAL_TRIAGE_THRESHOLD: 60,

  /**
   * Below this threshold → quarantine (suspicious)
   */
  QUARANTINE_THRESHOLD: 30,
} as const;

// ============================================================================
// SCHEMA & PROTOCOL
// ============================================================================

export const PIPELINE_PROTOCOL_CONFIG = {
  /** Current schema version for all pipeline contracts */
  SCHEMA_VERSION: 1,

  /** Request ID prefix for correlation */
  REQUEST_ID_PREFIX: 'req',

  /** Maximum age of a duplicate check window (24h in ms) */
  DEDUP_WINDOW_MS: 86_400_000,
} as const;

// ============================================================================
// THREAT FILTERING
// ============================================================================

export const PIPELINE_THREAT_CONFIG = {
  /** Sender types that are automatically quarantined */
  QUARANTINE_SENDER_TYPES: ['spam', 'phishing'] as const,

  /** Threat level that triggers quarantine */
  QUARANTINE_THREAT_LEVEL: 'high' as const,
} as const;

// ============================================================================
// AGGREGATE CONFIG (convenience export)
// ============================================================================

export const AI_PIPELINE_CONFIG = {
  queue: PIPELINE_QUEUE_CONFIG,
  timeouts: PIPELINE_TIMEOUT_CONFIG,
  confidence: PIPELINE_CONFIDENCE_CONFIG,
  protocol: PIPELINE_PROTOCOL_CONFIG,
  threat: PIPELINE_THREAT_CONFIG,
} as const;
