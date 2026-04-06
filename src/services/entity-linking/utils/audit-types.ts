/**
 * Audit Logging Types for Entity Linking
 *
 * Extracted from audit.ts (ADR-065 Phase 6).
 *
 * @module services/entity-linking/utils/audit-types
 */

import type { EntityType } from '../types';

// ============================================================================
// AUDIT TYPES
// ============================================================================

/**
 * Audit action types for entity linking
 */
export type AuditAction =
  | 'LINK_ENTITY'
  | 'UNLINK_ENTITY'
  | 'GET_AVAILABLE_ENTITIES'
  | 'VALIDATION_FAILED'
  | 'CACHE_HIT'
  | 'CACHE_MISS'
  | 'RETRY_ATTEMPT'
  | 'OPERATION_FAILED';

/**
 * Audit log severity levels
 */
export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly timestampMs: number;
  readonly action: AuditAction;
  readonly severity: AuditSeverity;
  readonly entityType?: EntityType;
  readonly entityId?: string;
  readonly targetId?: string;
  readonly targetType?: EntityType;
  readonly previousValue?: string | null;
  readonly newValue?: string | null;
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly errorCode?: string;
  readonly durationMs?: number;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly clientInfo?: string;
}

/**
 * Parameters for creating an audit log entry
 */
export interface AuditLogParams {
  readonly action: AuditAction;
  readonly entityType?: EntityType;
  readonly entityId?: string;
  readonly targetId?: string;
  readonly targetType?: EntityType;
  readonly previousValue?: string | null;
  readonly newValue?: string | null;
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly errorCode?: string;
  readonly durationMs?: number;
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// AUDIT CONFIGURATION
// ============================================================================

/**
 * Audit logger configuration
 */
export interface AuditConfig {
  readonly enabled: boolean;
  readonly minSeverity: AuditSeverity;
  readonly consoleOutput: boolean;
  readonly memoryBuffer: boolean;
  readonly maxBufferSize: number;
  readonly remoteLogging: boolean;
  readonly remoteEndpoint?: string;
}

/**
 * Default audit configuration
 */
export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  minSeverity: 'INFO',
  consoleOutput: true,
  memoryBuffer: true,
  maxBufferSize: 1000,
  remoteLogging: false,
} as const;
