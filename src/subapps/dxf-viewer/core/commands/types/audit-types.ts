/**
 * COMMAND AUDIT TYPES
 *
 * Extracted from `core/commands/interfaces.ts` (ADR-031) to keep that file
 * under the Google file-size limit. Lives in types/ which is exempt from
 * the line-count ratchet. Mirrors SAP/Salesforce enterprise audit-log
 * patterns that the command system was designed to satisfy.
 */

/**
 * 🏢 ENTERPRISE: Audit log entry for compliance
 * SAP/Salesforce requirement for enterprise applications
 */
export interface AuditLogEntry {
  /** Entry ID */
  id: string;

  /** Command that was executed */
  commandId: string;

  /** Command type */
  commandType: string;

  /** Command description */
  description: string;

  /** Timestamp */
  timestamp: number;

  /** Action type */
  action: 'execute' | 'undo' | 'redo';

  /** User ID (if available) */
  userId?: string;

  /** Session ID */
  sessionId: string;

  /** Affected entity IDs */
  affectedEntities: string[];

  /** Success/failure status */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * 🏢 ENTERPRISE: Audit trail interface
 */
export interface IAuditTrail {
  /** Log a command execution */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): void;

  /** Get audit log entries */
  getEntries(filter?: AuditLogFilter): AuditLogEntry[];

  /** Export audit log */
  export(format: 'json' | 'csv'): string;

  /** Clear old entries */
  prune(olderThan: Date): number;
}

/**
 * Filter for audit log queries
 */
export interface AuditLogFilter {
  commandType?: string;
  action?: 'execute' | 'undo' | 'redo';
  startDate?: Date;
  endDate?: Date;
  entityId?: string;
  limit?: number;
}
