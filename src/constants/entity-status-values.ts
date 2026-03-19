/**
 * 🏢 ENTERPRISE ENTITY STATUS VALUES
 *
 * Single source of truth για status string values ανά domain.
 * Αποτρέπει typo bugs σε .where() clauses, === comparisons, και assignments.
 *
 * ADR-245B: Hardcoded Strings Audit — Phase C
 *
 * ALREADY CENTRALIZED (do NOT duplicate here):
 * - Property statuses → src/constants/property-statuses-enterprise.ts
 * - Triage statuses   → src/constants/triage-statuses.ts
 * - Pipeline states   → src/types/ai-pipeline.ts (PipelineState)
 *
 * @module constants/entity-status-values
 */

// ============================================================================
// GENERIC ENTITY STATUS — Used across projects, contacts, companies, relationships
// ============================================================================

/**
 * Generic entity lifecycle status values.
 * Used when an entity can be active, archived, or inactive.
 */
export const ENTITY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  SUSPENDED: 'suspended',
} as const;

export type EntityStatus = typeof ENTITY_STATUS[keyof typeof ENTITY_STATUS];

// ============================================================================
// PROJECT STATUS
// ============================================================================

export const PROJECT_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  COMPLETED: 'completed',
  SUSPENDED: 'suspended',
  CONSTRUCTION: 'construction',
} as const;

export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

// ============================================================================
// QUEUE STATUS — Email ingestion, AI pipeline, and other async queues
// ============================================================================

/**
 * Shared queue status values.
 * Both EmailIngestionQueueStatus and PipelineQueueStatus use these same values.
 */
export const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter',
} as const;

export type QueueStatus = typeof QUEUE_STATUS[keyof typeof QUEUE_STATUS];
