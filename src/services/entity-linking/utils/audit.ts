/**
 * 🏢 ENTERPRISE: Audit Logging System
 *
 * Structured audit logging for entity linking operations.
 * Follows enterprise compliance patterns (SOX, GDPR, ISO 27001).
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Audit Trail Pattern (Enterprise Compliance)
 *
 * @example
 * ```typescript
 * import { AuditLogger, AuditAction } from './audit';
 *
 * AuditLogger.log({
 *   action: 'LINK_ENTITY',
 *   entityType: 'building',
 *   entityId: 'building123',
 *   targetId: 'project456',
 *   success: true,
 * });
 * ```
 */

import type { EntityType } from '../types';

// ============================================================================
// 🏢 ENTERPRISE: Audit Types
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
  /** Unique log entry ID */
  readonly id: string;
  /** Timestamp in ISO format */
  readonly timestamp: string;
  /** Unix timestamp for sorting */
  readonly timestampMs: number;
  /** The action being logged */
  readonly action: AuditAction;
  /** Severity level */
  readonly severity: AuditSeverity;
  /** Entity type involved */
  readonly entityType?: EntityType;
  /** Entity ID involved */
  readonly entityId?: string;
  /** Target entity ID (for linking) */
  readonly targetId?: string;
  /** Target entity type (for linking) */
  readonly targetType?: EntityType;
  /** Previous value (for changes) */
  readonly previousValue?: string | null;
  /** New value (for changes) */
  readonly newValue?: string | null;
  /** Operation success status */
  readonly success: boolean;
  /** Error message if failed */
  readonly errorMessage?: string;
  /** Error code if failed */
  readonly errorCode?: string;
  /** Duration in milliseconds */
  readonly durationMs?: number;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
  /** Session/request ID for correlation */
  readonly correlationId?: string;
  /** User agent or client info */
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
// 🏢 ENTERPRISE: Audit Configuration
// ============================================================================

/**
 * Audit logger configuration
 */
export interface AuditConfig {
  /** Whether logging is enabled */
  readonly enabled: boolean;
  /** Minimum severity level to log */
  readonly minSeverity: AuditSeverity;
  /** Whether to include in console */
  readonly consoleOutput: boolean;
  /** Whether to store in memory buffer */
  readonly memoryBuffer: boolean;
  /** Maximum buffer size */
  readonly maxBufferSize: number;
  /** Whether to send to remote endpoint */
  readonly remoteLogging: boolean;
  /** Remote logging endpoint */
  readonly remoteEndpoint?: string;
}

/**
 * Default audit configuration
 */
const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  minSeverity: 'INFO',
  consoleOutput: true,
  memoryBuffer: true,
  maxBufferSize: 1000,
  remoteLogging: false,
} as const;

// ============================================================================
// 🏢 ENTERPRISE: Audit Logger Class
// ============================================================================

/**
 * 📋 Enterprise Audit Logger
 *
 * Provides structured audit logging for entity linking operations.
 *
 * Features:
 * - Structured log format (JSON)
 * - Severity levels
 * - Memory buffer for recent logs
 * - Correlation ID support
 * - Duration tracking
 * - Error capturing
 */
export class AuditLogger {
  private static config: AuditConfig = DEFAULT_AUDIT_CONFIG;
  private static buffer: AuditLogEntry[] = [];
  private static correlationId: string | null = null;

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Configure the audit logger
   */
  static configure(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('📋 [AuditLogger] Configuration updated:', this.config);
  }

  /**
   * Set correlation ID for request tracking
   */
  static setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Clear correlation ID
   */
  static clearCorrelationId(): void {
    this.correlationId = null;
  }

  // ==========================================================================
  // LOGGING METHODS
  // ==========================================================================

  /**
   * 📝 Log an audit entry
   *
   * @param params - Audit log parameters
   * @returns The created audit log entry
   */
  static log(params: AuditLogParams): AuditLogEntry {
    if (!this.config.enabled) {
      return this.createEmptyEntry();
    }

    const entry = this.createEntry(params);
    const severity = this.getSeverity(params);

    // Check minimum severity
    if (!this.shouldLog(severity)) {
      return entry;
    }

    // Console output
    if (this.config.consoleOutput) {
      this.logToConsole(entry, severity);
    }

    // Memory buffer
    if (this.config.memoryBuffer) {
      this.addToBuffer(entry);
    }

    // Remote logging (fire and forget)
    if (this.config.remoteLogging && this.config.remoteEndpoint) {
      this.logToRemote(entry).catch(() => {
        // Silent fail for remote logging
      });
    }

    return entry;
  }

  /**
   * Log a successful operation
   */
  static logSuccess(
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log({
      action,
      entityType,
      entityId,
      success: true,
      metadata,
    });
  }

  /**
   * Log a failed operation
   */
  static logError(
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    error: Error | string,
    errorCode?: string
  ): AuditLogEntry {
    const errorMessage = typeof error === 'string' ? error : error.message;

    return this.log({
      action,
      entityType,
      entityId,
      success: false,
      errorMessage,
      errorCode,
    });
  }

  /**
   * Log an entity linking operation
   */
  static logLink(
    entityType: EntityType,
    entityId: string,
    targetType: EntityType,
    targetId: string,
    previousTargetId: string | null,
    success: boolean,
    durationMs?: number,
    errorMessage?: string
  ): AuditLogEntry {
    return this.log({
      action: 'LINK_ENTITY',
      entityType,
      entityId,
      targetType,
      targetId,
      previousValue: previousTargetId,
      newValue: targetId,
      success,
      durationMs,
      errorMessage,
    });
  }

  /**
   * Log an entity unlinking operation
   */
  static logUnlink(
    entityType: EntityType,
    entityId: string,
    previousTargetId: string | null,
    success: boolean,
    durationMs?: number,
    errorMessage?: string
  ): AuditLogEntry {
    return this.log({
      action: 'UNLINK_ENTITY',
      entityType,
      entityId,
      previousValue: previousTargetId,
      newValue: null,
      success,
      durationMs,
      errorMessage,
    });
  }

  /**
   * Log a retry attempt
   */
  static logRetry(
    action: AuditAction,
    attempt: number,
    maxAttempts: number,
    delayMs: number
  ): AuditLogEntry {
    return this.log({
      action: 'RETRY_ATTEMPT',
      success: false,
      metadata: {
        originalAction: action,
        attempt,
        maxAttempts,
        delayMs,
      },
    });
  }

  // ==========================================================================
  // BUFFER OPERATIONS
  // ==========================================================================

  /**
   * Get recent audit logs from buffer
   */
  static getRecentLogs(count?: number): AuditLogEntry[] {
    const limit = count ?? this.buffer.length;
    return this.buffer.slice(-limit);
  }

  /**
   * Get logs filtered by action
   */
  static getLogsByAction(action: AuditAction): AuditLogEntry[] {
    return this.buffer.filter((entry) => entry.action === action);
  }

  /**
   * Get logs filtered by entity
   */
  static getLogsByEntity(entityType: EntityType, entityId: string): AuditLogEntry[] {
    return this.buffer.filter(
      (entry) => entry.entityType === entityType && entry.entityId === entityId
    );
  }

  /**
   * Get failed operations from buffer
   */
  static getFailedOperations(): AuditLogEntry[] {
    return this.buffer.filter((entry) => !entry.success);
  }

  /**
   * Clear the log buffer
   */
  static clearBuffer(): void {
    this.buffer = [];
    console.log('📋 [AuditLogger] Buffer cleared');
  }

  /**
   * Export buffer as JSON
   */
  static exportBuffer(): string {
    return JSON.stringify(this.buffer, null, 2);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Create an audit log entry
   */
  private static createEntry(params: AuditLogParams): AuditLogEntry {
    const now = new Date();

    return {
      id: this.generateId(),
      timestamp: now.toISOString(),
      timestampMs: now.getTime(),
      action: params.action,
      severity: this.getSeverity(params),
      entityType: params.entityType,
      entityId: params.entityId,
      targetId: params.targetId,
      targetType: params.targetType,
      previousValue: params.previousValue,
      newValue: params.newValue,
      success: params.success,
      errorMessage: params.errorMessage,
      errorCode: params.errorCode,
      durationMs: params.durationMs,
      metadata: params.metadata,
      correlationId: this.correlationId ?? undefined,
      clientInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    };
  }

  /**
   * Create an empty entry (when logging is disabled)
   */
  private static createEmptyEntry(): AuditLogEntry {
    return {
      id: '',
      timestamp: '',
      timestampMs: 0,
      action: 'LINK_ENTITY',
      severity: 'INFO',
      success: true,
    };
  }

  /**
   * Generate unique log entry ID
   */
  private static generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Determine severity based on params
   * Note: Action-specific severities take precedence over success status
   */
  private static getSeverity(params: AuditLogParams): AuditSeverity {
    // Action-specific severities (take precedence)
    if (params.action === 'RETRY_ATTEMPT') return 'WARN';
    if (params.action === 'VALIDATION_FAILED') return 'WARN';
    if (params.action === 'CACHE_HIT' || params.action === 'CACHE_MISS') return 'DEBUG';
    // General failure fallback
    if (!params.success) return 'ERROR';
    return 'INFO';
  }

  /**
   * Check if severity meets minimum threshold
   */
  private static shouldLog(severity: AuditSeverity): boolean {
    const severityOrder: Record<AuditSeverity, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };

    return severityOrder[severity] >= severityOrder[this.config.minSeverity];
  }

  /**
   * Log to console with appropriate styling
   */
  private static logToConsole(entry: AuditLogEntry, severity: AuditSeverity): void {
    const prefix = this.getConsolePrefix(severity);
    const message = this.formatConsoleMessage(entry);

    switch (severity) {
      case 'ERROR':
        console.error(prefix, message, entry);
        break;
      case 'WARN':
        console.warn(prefix, message, entry);
        break;
      case 'DEBUG':
        console.debug(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }

  /**
   * Get console prefix emoji based on severity
   */
  private static getConsolePrefix(severity: AuditSeverity): string {
    switch (severity) {
      case 'ERROR':
        return '❌ [AUDIT]';
      case 'WARN':
        return '⚠️ [AUDIT]';
      case 'DEBUG':
        return '🔍 [AUDIT]';
      default:
        return '📋 [AUDIT]';
    }
  }

  /**
   * Format console message
   */
  private static formatConsoleMessage(entry: AuditLogEntry): string {
    const parts: string[] = [entry.action];

    if (entry.entityType && entry.entityId) {
      parts.push(`${entry.entityType}:${entry.entityId}`);
    }

    if (entry.targetType && entry.targetId) {
      parts.push(`→ ${entry.targetType}:${entry.targetId}`);
    }

    if (entry.durationMs !== undefined) {
      parts.push(`(${entry.durationMs}ms)`);
    }

    if (entry.success) {
      parts.push('✓');
    } else {
      parts.push(`✗ ${entry.errorMessage ?? 'Failed'}`);
    }

    return parts.join(' ');
  }

  /**
   * Add entry to memory buffer
   */
  private static addToBuffer(entry: AuditLogEntry): void {
    this.buffer.push(entry);

    // Trim buffer if it exceeds max size
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.config.maxBufferSize);
    }
  }

  /**
   * Send log to remote endpoint
   */
  private static async logToRemote(entry: AuditLogEntry): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // Silent fail for remote logging
    }
  }
}

// Default export
export default AuditLogger;
