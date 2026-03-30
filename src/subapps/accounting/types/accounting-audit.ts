/**
 * @fileoverview Accounting Audit Trail — Types & Event Definitions
 * @description Immutable audit log types for ΚΦΔ compliance (5-year retention)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-1c.md Q1-Q3
 * @compliance SAP CDHDR/NetSuite system_note pattern — append-only, zero delete
 */

// ============================================================================
// AUDIT EVENT TYPES (Q1 — Medium Scope, 15 events)
// ============================================================================

/**
 * 15 accounting audit event types — financial + period + admin
 *
 * Covers ΑΑΔΕ/myDATA compliance + enterprise visibility.
 * Expandable to full field-level (SAP CDPOS) in future phase.
 */
export type AccountingAuditEventType =
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_CANCELLED'
  | 'INVOICE_CREDIT_NOTE'
  | 'JOURNAL_CREATED'
  | 'JOURNAL_REVERSED'
  | 'PAYMENT_RECORDED'
  | 'BALANCE_UPDATED'
  | 'BALANCE_RECONCILED'
  | 'PERIOD_CLOSED'
  | 'PERIOD_LOCKED'
  | 'PERIOD_REOPENED'
  | 'CREDIT_LIMIT_CHANGED'
  | 'DISPUTE_FLAGGED'
  | 'BANK_MATCHED'
  | 'BANK_RECONCILED'
  | 'BANK_RECONCILE_UNLOCKED';

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | 'invoice'
  | 'journal'
  | 'balance'
  | 'period'
  | 'bank_transaction';

// ============================================================================
// AUDIT ENTRY (Q2 — Flat collection + composite indexes)
// ============================================================================

/**
 * Immutable audit log entry — SAP CDHDR / NetSuite system_note pattern
 *
 * CRITICAL: ΜΟΝΟ create + list. ΚΑΝΕΝΑ update/delete (Q3 — ΚΦΔ 5 χρόνια)
 */
export interface AccountingAuditEntry {
  /** Enterprise ID (prefix: alog_) */
  auditId: string;
  /** One of 15 event types */
  eventType: AccountingAuditEventType;
  /** Entity domain */
  entityType: AuditEntityType;
  /** ID of the affected document */
  entityId: string;
  /** Who performed the action */
  userId: string;
  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Human-readable description */
  details: string;
  /** Extra context (amounts, status transitions, etc.) */
  metadata: Record<string, string | number | boolean | null>;
}

// ============================================================================
// AUDIT QUERY FILTERS
// ============================================================================

/**
 * Filters for querying audit entries
 *
 * Maps to the 3 composite indexes:
 * 1. entityType + entityId + timestamp
 * 2. eventType + timestamp
 * 3. userId + timestamp
 */
export interface AuditEntryFilters {
  entityType?: AuditEntityType;
  entityId?: string;
  eventType?: AccountingAuditEventType;
  userId?: string;
  startDate?: string;
  endDate?: string;
}
