/**
 * AUDIT TRAIL
 *
 * 🏢 ENTERPRISE (2026-01-25): Compliance logging for command history
 * SAP/Salesforce requirement for enterprise applications.
 *
 * Features:
 * - Full audit log of all command executions
 * - Export to JSON/CSV for compliance reports
 * - Session tracking
 * - Pruning for storage management
 */

import type { IAuditTrail, AuditLogEntry, AuditLogFilter, ICommand } from './interfaces';
import { generateEntityId } from '../../systems/entity-creation/utils';

/**
 * Audit Trail implementation
 * Tracks all command executions for compliance and debugging
 */
export class AuditTrail implements IAuditTrail {
  private entries: AuditLogEntry[] = [];
  private sessionId: string;
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.sessionId = generateEntityId();
    this.maxEntries = maxEntries;
  }

  /**
   * Log a command execution
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: generateEntityId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.entries.push(fullEntry);

    // Trim if over max
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('[AuditTrail]', entry.action, entry.commandType, entry.description);
    }
  }

  /**
   * Log a command with standard format
   */
  logCommand(command: ICommand, action: 'execute' | 'undo' | 'redo', success: boolean, error?: string): void {
    this.log({
      commandId: command.id,
      commandType: command.type,
      description: command.getDescription(),
      action,
      affectedEntities: command.getAffectedEntityIds(),
      success,
      error,
    });
  }

  /**
   * Get audit log entries with optional filter
   */
  getEntries(filter?: AuditLogFilter): AuditLogEntry[] {
    let result = [...this.entries];

    if (filter) {
      if (filter.commandType) {
        result = result.filter((e) => e.commandType === filter.commandType);
      }

      if (filter.action) {
        result = result.filter((e) => e.action === filter.action);
      }

      if (filter.startDate) {
        const startTime = filter.startDate.getTime();
        result = result.filter((e) => e.timestamp >= startTime);
      }

      if (filter.endDate) {
        const endTime = filter.endDate.getTime();
        result = result.filter((e) => e.timestamp <= endTime);
      }

      if (filter.entityId) {
        result = result.filter((e) => e.affectedEntities.includes(filter.entityId!));
      }

      if (filter.limit) {
        result = result.slice(-filter.limit);
      }
    }

    return result;
  }

  /**
   * Export audit log to JSON or CSV format
   */
  export(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.entries, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'timestamp',
      'sessionId',
      'commandId',
      'commandType',
      'description',
      'action',
      'affectedEntities',
      'success',
      'error',
    ];

    const rows = this.entries.map((entry) => [
      entry.id,
      new Date(entry.timestamp).toISOString(),
      entry.sessionId,
      entry.commandId,
      entry.commandType,
      `"${entry.description.replace(/"/g, '""')}"`,
      entry.action,
      `"${entry.affectedEntities.join(';')}"`,
      entry.success.toString(),
      entry.error ? `"${entry.error.replace(/"/g, '""')}"` : '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Clear entries older than specified date
   */
  prune(olderThan: Date): number {
    const threshold = olderThan.getTime();
    const originalLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.timestamp >= threshold);
    return originalLength - this.entries.length;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get total entry count
   */
  count(): number {
    return this.entries.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get statistics
   */
  getStats(): AuditTrailStats {
    const stats: AuditTrailStats = {
      totalEntries: this.entries.length,
      executeCount: 0,
      undoCount: 0,
      redoCount: 0,
      successCount: 0,
      failureCount: 0,
      commandTypes: {},
    };

    for (const entry of this.entries) {
      if (entry.action === 'execute') stats.executeCount++;
      else if (entry.action === 'undo') stats.undoCount++;
      else if (entry.action === 'redo') stats.redoCount++;

      if (entry.success) stats.successCount++;
      else stats.failureCount++;

      stats.commandTypes[entry.commandType] = (stats.commandTypes[entry.commandType] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Audit trail statistics
 */
export interface AuditTrailStats {
  totalEntries: number;
  executeCount: number;
  undoCount: number;
  redoCount: number;
  successCount: number;
  failureCount: number;
  commandTypes: Record<string, number>;
}
