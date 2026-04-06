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

import { generateAuditId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { DEFAULT_AUDIT_CONFIG } from './audit-types';
import type {
  AuditAction,
  AuditSeverity,
  AuditLogEntry,
  AuditLogParams,
  AuditConfig,
} from './audit-types';

// Re-export types for backward compatibility
export type { AuditAction, AuditSeverity, AuditLogEntry, AuditLogParams, AuditConfig } from './audit-types';
export { DEFAULT_AUDIT_CONFIG } from './audit-types';

import type { EntityType } from '../types';

const auditModuleLogger = createModuleLogger('AuditLogger');

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
    auditModuleLogger.info('Configuration updated', { config: this.config });
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
    auditModuleLogger.info('Buffer cleared');
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
   * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
   */
  private static generateId(): string {
    return generateAuditId();
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
        auditModuleLogger.error(`${prefix} ${message}`, { entry });
        break;
      case 'WARN':
        auditModuleLogger.warn(`${prefix} ${message}`, { entry });
        break;
      case 'DEBUG':
        auditModuleLogger.debug(`${prefix} ${message}`);
        break;
      default:
        auditModuleLogger.info(`${prefix} ${message}`);
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
