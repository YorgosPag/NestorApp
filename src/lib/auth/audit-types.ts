/**
 * Audit trail contracts — registries των auditable ενεργειών/στόχων + το σχήμα της εγγραφής.
 *
 * Εξήχθη από το `./types.ts` (ADR-655): το types.ts είχε φτάσει το όριο των 500 γραμμών (N.7.1).
 * Ο διαχωρισμός είναι κατά ευθύνη — «ποιος επιτρέπεται τι» (auth) vs «τι καταγράφηκε» (audit).
 *
 * ⚠️ Το `./types.ts` κάνει re-export ΟΛΑ όσα ζουν εδώ ⇒ κάθε υπάρχον
 * `import { AuditAction } from '@/lib/auth/types'` δουλεύει αμετάβλητο. ΕΝΑ σημείο ορισμού,
 * δύο διαδρομές εισαγωγής — καμία δεύτερη πηγή αλήθειας.
 */

// =============================================================================
// AUDIT TYPES
// =============================================================================

/** Audit Actions Registry — all auditable actions. */
export const AUDIT_ACTIONS = {
  role_changed: true,
  permission_granted: true,
  permission_revoked: true,
  grant_created: true,
  grant_revoked: true,
  access_denied: true,
  claims_updated: true,
  ownership_changed: true,
  system_bootstrap: true,
  migration_executed: true,
  // Communications
  email_sent: true,
  message_sent: true,
  communication_created: true,
  communication_approved: true,
  communication_rejected: true,
  // Admin operations
  data_fix_executed: true,
  direct_operation_executed: true,
  system_configured: true,
  // Data access (AUTHZ Phase 2)
  data_accessed: true,
  data_created: true,
  data_updated: true,
  data_deleted: true,
  // Soft-delete lifecycle (ADR-281)
  soft_deleted: true,
  restored: true,
  // Webhooks
  webhook_received: true,
  // Role Management (ADR-244)
  user_suspended: true,
  user_activated: true,
  permission_set_granted: true,
  permission_set_revoked: true,
  // Project membership (ADR-244 Phase B)
  member_added: true,
  member_removed: true,
  member_updated: true,
  // Financial (ADR-255 SPEC-255E)
  financial_transition: true,
  // Procurement (ADR-267)
  "procurement.po.created": true,
  "procurement.po.approved": true,
  "procurement.po.ordered": true,
  "procurement.po.status_changed": true,
  "procurement.po.items_edited": true,
  "procurement.po.cancelled": true,
  "procurement.po.deleted": true,
  "procurement.po.delivery_recorded": true,
  "procurement.po.invoice_linked": true,

  // Asset Packs (ADR-655) — gated content libraries. Ένα entitlement system χωρίς audit trail
  // δεν είναι enterprise: πρέπει να μπορείς να απαντήσεις «ποιος ζήτησε τι και γιατί του κόπηκε».
  "asset_pack.access_denied": true,
} as const;

/** Audit action type derived from registry. */
export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Audit Target Types Registry. */
export const AUDIT_TARGET_TYPES = {
  user: true,
  project: true,
  building: true, // Building entities (AUTHZ Phase 2)
  unit: true, // Legacy — kept for backward compat (parking/storage audit)
  property: true, // ADR-269 rename
  storage: true, // Storage units (ADR-255 SPEC-255B)
  parking: true, // Parking spaces (ADR-255 SPEC-255B)
  opportunity: true, // CRM opportunities (ADR-255 SPEC-255B)
  cheque: true, // Financial cheques (ADR-255 SPEC-255E)
  loan: true, // Financial loans (ADR-255 SPEC-255E)
  // Financial (ADR-255 SPEC-255E)
  payment: true,
  invoice: true,
  journal_entry: true,
  expense_document: true,
  category: true,
  apy_certificate: true,
  commission: true,
  agreement: true,
  role: true,
  grant: true,
  api: true,
  migration: true,
  webhook: true,
  communication: true,
  purchase_order: true,
  contact: true,
  asset_pack: true, // ADR-655 — gated content libraries
} as const;

/** Audit target type derived from registry. */
export type AuditTargetType = keyof typeof AUDIT_TARGET_TYPES;

/** Typed audit change value. */
export interface AuditChangeValue {
  type:
    | "role"
    | "permission"
    | "grant"
    | "status"
    | "membership"
    | "webhook"
    | "building_update"
    | "building_delete"
    | "project_create"
    | "communication_status"
    | "task_linked"
    | "project_member"
    | "financial_status";
  value: string | string[] | Record<string, unknown>;
}

/** Audit metadata for context. */
export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  reason?: string;
  filesRestored?: number;
  filesCascaded?: number;
  filesSkipped?: number;
}

/** Complete audit log entry. */
export interface AuditLogEntry {
  companyId: string; // RFC v6 P0-2: Required for tenant isolation
  action: AuditAction;
  actorId: string;
  targetId: string;
  targetType: AuditTargetType;
  previousValue: AuditChangeValue | null;
  newValue: AuditChangeValue | null;
  timestamp: Date;
  /**
   * ADR-438 — TTL expiry instant (now + retention window at write time).
   * Firestore's TTL policy auto-deletes the document after this time.
   * Optional because audit docs written before ADR-438 lack the field.
   */
  expiresAt?: Date;
  metadata: AuditMetadata;
}
