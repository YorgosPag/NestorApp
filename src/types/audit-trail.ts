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
  | 'purchase_order'
  | 'quote'
  | 'material';

/** Actions that can be recorded in the audit trail */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'soft_deleted'
  | 'restored'
  | 'status_changed'
  | 'linked'
  | 'unlinked'
  | 'professional_assigned'
  | 'professional_removed'
  | 'email_sent'
  | 'vendor_notified'
  | 'invoice_created'
  | 'document_added'
  | 'document_removed';

// ============================================================================
// FIELD-LEVEL DIFF
// ============================================================================

/**
 * Operation type for collection-aware audit entries (ADR-195 Phase 11).
 * Scalar entries omit `op` (and `kind`).
 */
export type AuditCollectionOp = 'added' | 'removed' | 'modified';

/**
 * Sub-field change within a `modified` collection item.
 * Used when an existing item in a tracked collection has one or more
 * inner fields edited (e.g. an address whose street changed).
 */
export interface AuditSubChange {
  /** Sub-field name within the collection item (e.g. 'street') */
  subField: string;
  /** Optional human-readable label for the sub-field */
  label?: string;
  /** Value before the change (serialized) */
  oldValue: string | number | boolean | null;
  /** Value after the change (serialized) */
  newValue: string | number | boolean | null;
}

/**
 * A single field change within an audit entry.
 *
 * **Scalar** (legacy + current): `oldValue → newValue` describes a primitive
 * field change. `kind` is omitted (treated as 'scalar').
 *
 * **Collection** (ADR-195 Phase 11): for tracked array fields, the diff
 * engine emits one entry per item operation (added/removed/modified) with
 * `kind: 'collection'`, a stable `itemKey`, a human `itemLabel`, and (for
 * `modified`) granular `subChanges`. Legacy scalar entries continue to
 * render unchanged — the new fields are strictly optional.
 */
export interface AuditFieldChange {
  /** Field name (e.g. 'status', 'price', 'addresses') */
  field: string;
  /** Value before the change (serialized) — for collection ops, typically null */
  oldValue: string | number | boolean | null;
  /** Value after the change (serialized) — for collection ops, typically null */
  newValue: string | number | boolean | null;
  /** Optional human-readable label (e.g. 'Κατάσταση', 'Διευθύνσεις') */
  label?: string;

  // ── Collection-aware extension (ADR-195 Phase 11) ──
  /** Discriminator. Omitted = scalar (legacy). */
  kind?: 'scalar' | 'collection';
  /** Operation kind for collection items. */
  op?: AuditCollectionOp;
  /** Stable identity of the collection item (e.g. address id). */
  itemKey?: string;
  /** Human display label for the collection item (e.g. 'Εργοτάξιο — Σαμοθράκης'). */
  itemLabel?: string;
  /** Granular sub-field changes for `op === 'modified'`. */
  subChanges?: AuditSubChange[];
}

// ============================================================================
// AUDIT ENTRY (Firestore Document)
// ============================================================================

/**
 * Writer identity for an audit entry. ADR-195 Phase 1 CDC dual-write:
 *   - `'service'` — written by `EntityAuditService.recordChange` (service-layer,
 *     curated tracked fields, authoritative `performedBy`).
 *   - `'cdc'` — written by Cloud Function `auditContactWrite` (Firestore
 *     onWrite trigger, full automatic deep diff).
 * Client dedup prefers `'cdc'` when both coexist for the same logical action.
 */
export type AuditSource = 'service' | 'cdc';

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
  /**
   * Writer that produced this entry. Optional for backward compatibility
   * with entries written before Phase 1 CDC rollout. Missing = legacy
   * service-layer (pre-CDC) semantics.
   */
  source?: AuditSource;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================
// ============================================================================
// API RESPONSE
// ============================================================================

/** Response from the audit trail API endpoint */
export interface EntityAuditResponse {
  entries: EntityAuditEntry[];
  hasMore: boolean;
  nextCursor?: string;
}
