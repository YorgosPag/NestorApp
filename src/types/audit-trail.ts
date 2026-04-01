/**
 * 📜 Entity Audit Trail — Type Definitions
 *
 * Centralized types for entity-level change tracking.
 * Used by EntityAuditService (server), API routes, and client hooks.
 *
 * @module types/audit-trail
 * @enterprise ADR-195 — Entity Audit Trail
 */

// ============================================================================
// CORE UNION TYPES
// ============================================================================

/** Entity types that support audit trail */
export type AuditEntityType =
  | 'contact'
  | 'building'
  | 'property'
  | 'floor'
  | 'project'
  | 'company'
  | 'parking'
  | 'storage'
  | 'purchase_order';

/** Actions that can be recorded in the audit trail */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'linked'
  | 'unlinked'
  | 'professional_assigned'
  | 'professional_removed'
  | 'email_sent'
  | 'invoice_created';

// ============================================================================
// FIELD-LEVEL DIFF
// ============================================================================

/** A single field change within an audit entry */
export interface AuditFieldChange {
  /** Field name (e.g. 'status', 'price') */
  field: string;
  /** Value before the change (serialized) */
  oldValue: string | number | boolean | null;
  /** Value after the change (serialized) */
  newValue: string | number | boolean | null;
  /** Optional human-readable label (e.g. 'Κατάσταση') */
  label?: string;
}

// ============================================================================
// AUDIT ENTRY (Firestore Document)
// ============================================================================

/** Full audit trail entry as stored in Firestore */
export interface EntityAuditEntry {
  /** Firestore document ID (populated on read) */
  id?: string;
  /** Entity type (e.g. 'unit', 'building') */
  entityType: AuditEntityType;
  /** Entity document ID */
  entityId: string;
  /** Entity display name at time of change */
  entityName: string | null;
  /** Action performed */
  action: AuditAction;
  /** Field-level changes (for 'updated' action) */
  changes: AuditFieldChange[];
  /** User ID who performed the action */
  performedBy: string;
  /** User display name (denormalized) */
  performedByName: string | null;
  /** Company ID for tenant isolation */
  companyId: string;
  /** Timestamp (ISO string on read, serverTimestamp on write) */
  timestamp: string;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

/** Options for querying audit trail entries */
export interface EntityAuditQueryOptions {
  /** Entity type filter */
  entityType: AuditEntityType;
  /** Entity ID filter */
  entityId: string;
  /** Max entries to return (default: 20) */
  limit?: number;
  /** Cursor for pagination (Firestore doc ID) */
  startAfter?: string;
}

// ============================================================================
// API RESPONSE
// ============================================================================

/** Response from the audit trail API endpoint */
export interface EntityAuditResponse {
  entries: EntityAuditEntry[];
  hasMore: boolean;
  nextCursor?: string;
}
