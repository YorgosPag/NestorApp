/**
 * @fileoverview Audit Logging - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Server-side audit logging to Firestore.
 * All authorization-related events are logged for compliance and debugging.
 *
 * Firestore Path: /companies/{companyId}/audit_logs/{autoId}
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import { getAdminFirestore, isFirebaseAdminAvailable, FieldValue } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

import type {
  AuthContext,
  AuditAction,
  AuditTargetType,
  AuditLogEntry,
  AuditChangeValue,
  AuditMetadata,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const AUDIT_COLLECTION = 'audit_logs';

// =============================================================================
// 🏢 ENTERPRISE: Firestore Data Sanitization
// =============================================================================

/**
 * Remove undefined values from object (Firestore compatibility).
 *
 * Firestore throws error on undefined values. This function recursively
 * removes undefined values while preserving null values (which are valid).
 *
 * @enterprise SAP/Salesforce/Microsoft pattern: Data sanitization before persistence
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Skip undefined values
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively clean nested objects
      const cleaned = removeUndefinedValues(value as Record<string, unknown>);
      // Only include if object has keys after cleaning
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

// =============================================================================
// FIRESTORE ACCESS
// =============================================================================

/**
 * Get Firestore instance for audit logging (ADR-077: Centralized via @/lib/firebaseAdmin).
 */
function getDb(): Firestore | null {
  if (!isFirebaseAdminAvailable()) {
    return null;
  }
  return getAdminFirestore();
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log an audit event to Firestore.
 *
 * Events are written to: /companies/{companyId}/audit_logs/{autoId}
 *
 * @param ctx - Authenticated context (provides companyId and actorId)
 * @param action - Audit action type
 * @param targetId - Target entity ID
 * @param targetType - Target entity type
 * @param options - Additional audit options
 *
 * @example
 * ```typescript
 * await logAuditEvent(ctx, 'role_changed', userId, 'user', {
 *   previousValue: { type: 'role', value: 'viewer' },
 *   newValue: { type: 'role', value: 'editor' },
 *   metadata: { reason: 'Promotion request' },
 * });
 * ```
 */
export async function logAuditEvent(
  ctx: AuthContext,
  action: AuditAction,
  targetId: string,
  targetType: AuditTargetType,
  options: {
    previousValue?: AuditChangeValue | null;
    newValue?: AuditChangeValue | null;
    metadata?: Partial<AuditMetadata>;
  } = {}
): Promise<void> {
  const db = getDb();
  if (!db) {
    // Log to console as fallback
    console.log('[AUDIT] Firestore not available, logging to console:', {
      companyId: ctx.companyId,
      action,
      actorId: ctx.uid,
      targetId,
      targetType,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 🏢 ENTERPRISE: Build entry and sanitize undefined values for Firestore
  const rawEntry = {
    companyId: ctx.companyId,
    action,
    actorId: ctx.uid,
    targetId,
    targetType,
    previousValue: options.previousValue ?? null,
    newValue: options.newValue ?? null,
    timestamp: FieldValue.serverTimestamp(),
    metadata: removeUndefinedValues({
      ipAddress: options.metadata?.ipAddress,
      userAgent: options.metadata?.userAgent,
      path: options.metadata?.path,
      reason: options.metadata?.reason,
    }),
  };

  // Remove undefined from top-level (metadata might be empty object)
  const entry = removeUndefinedValues(rawEntry) as Omit<AuditLogEntry, 'timestamp'> & { timestamp: FieldValue };

  // Ensure required fields are present (Firestore compatibility)
  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    entry.metadata = {};
  }

  try {
    // Write to tenant-scoped collection: /companies/{companyId}/audit_logs/{autoId}
    await db
      .collection(COLLECTIONS.COMPANIES)
      .doc(ctx.companyId)
      .collection(AUDIT_COLLECTION)
      .add(entry);
  } catch (error) {
    // Never throw on audit failure - just log
    console.error('[AUDIT] Failed to write audit log:', error);
    console.log('[AUDIT] Fallback entry:', JSON.stringify(entry));
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Log a role change event.
 */
export async function logRoleChange(
  ctx: AuthContext,
  targetUserId: string,
  previousRole: string,
  newRole: string,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'role_changed', targetUserId, 'user', {
    previousValue: { type: 'role', value: previousRole },
    newValue: { type: 'role', value: newRole },
    metadata: { reason },
  });
}

/**
 * Log a permission grant event.
 */
export async function logPermissionGranted(
  ctx: AuthContext,
  targetUserId: string,
  permissions: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'permission_granted', targetUserId, 'user', {
    previousValue: null,
    newValue: { type: 'permission', value: permissions },
    metadata: { reason },
  });
}

/**
 * Log a permission revoke event.
 */
export async function logPermissionRevoked(
  ctx: AuthContext,
  targetUserId: string,
  permissions: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'permission_revoked', targetUserId, 'user', {
    previousValue: { type: 'permission', value: permissions },
    newValue: null,
    metadata: { reason },
  });
}

/**
 * Log a grant creation event.
 */
export async function logGrantCreated(
  ctx: AuthContext,
  grantId: string,
  scopes: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'grant_created', grantId, 'grant', {
    previousValue: null,
    newValue: { type: 'grant', value: scopes },
    metadata: { reason },
  });
}

/**
 * Log a grant revocation event.
 */
export async function logGrantRevoked(
  ctx: AuthContext,
  grantId: string,
  scopes: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'grant_revoked', grantId, 'grant', {
    previousValue: { type: 'grant', value: scopes },
    newValue: null,
    metadata: { reason },
  });
}

/**
 * Log an access denied event.
 *
 * Use this when a permission check fails to audit the denial.
 */
export async function logAccessDenied(
  ctx: AuthContext,
  resource: string,
  permission: string,
  path?: string
): Promise<void> {
  await logAuditEvent(ctx, 'access_denied', resource, 'api', {
    previousValue: null,
    newValue: { type: 'permission', value: permission },
    metadata: { path },
  });
}

/**
 * Log a claims update event.
 *
 * Use this when custom claims are updated.
 */
export async function logClaimsUpdated(
  ctx: AuthContext,
  targetUserId: string,
  previousClaims: Record<string, unknown>,
  newClaims: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'claims_updated', targetUserId, 'user', {
    previousValue: { type: 'status', value: previousClaims },
    newValue: { type: 'status', value: newClaims },
    metadata: { reason },
  });
}

/**
 * Log an ownership change event.
 */
export async function logOwnershipChanged(
  ctx: AuthContext,
  unitId: string,
  previousOwnerId: string | null,
  newOwnerId: string,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'ownership_changed', unitId, 'unit', {
    previousValue: previousOwnerId ? { type: 'membership', value: previousOwnerId } : null,
    newValue: { type: 'membership', value: newOwnerId },
    metadata: { reason },
  });
}

/**
 * Log a system bootstrap event.
 *
 * Use this for initial system setup and seed operations.
 */
export async function logSystemBootstrap(
  ctx: AuthContext,
  operation: string,
  details: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(ctx, 'system_bootstrap', operation, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: 'System initialization' },
  });
}

/**
 * Log a migration execution event.
 *
 * Use this when database migrations are executed.
 * 🏢 ENTERPRISE: Critical system-level operation audit trail.
 */
export async function logMigrationExecuted(
  ctx: AuthContext,
  migrationId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'migration_executed', migrationId, 'migration', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'Database migration executed' },
  });
}

/**
 * Log a data fix operation.
 *
 * Data fix operations are administrative corrections to existing data
 * (e.g., fixing companyIds, cleaning duplicates, updating relationships).
 *
 * @param ctx - Authenticated context (must be super_admin)
 * @param fixId - Unique identifier for this fix operation
 * @param details - Operation details (counts, affected records, etc.)
 * @param reason - Optional reason for the fix
 *
 * @example
 * ```typescript
 * await logDataFix(ctx, 'fix_project_company_ids', {
 *   totalProjects: 10,
 *   updatedProjects: 5,
 *   targetCompanyId: 'abc123'
 * }, 'Project companyIds fix by super_admin');
 * ```
 *
 * 🏢 ENTERPRISE: Data correction audit trail for compliance.
 */
export async function logDataFix(
  ctx: AuthContext,
  fixId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'data_fix_executed', fixId, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'Data fix operation executed' },
  });
}

/**
 * Log a direct database operation.
 *
 * Direct operations bypass normal application flows and use elevated
 * permissions (e.g., Firebase Admin SDK) for system-level tasks.
 *
 * @param ctx - Authenticated context (must be super_admin)
 * @param operationId - Unique identifier for this operation
 * @param details - Operation details (method, affected collections, etc.)
 * @param reason - Optional reason for the operation
 *
 * @example
 * ```typescript
 * await logDirectOperation(ctx, 'create_clean_projects', {
 *   operation: 'create-clean-projects',
 *   projectsCreated: 3,
 *   method: 'firebase_admin_sdk'
 * }, 'Clean project creation for development');
 * ```
 *
 * 🏢 ENTERPRISE: Direct operation audit trail for security compliance.
 */
export async function logDirectOperation(
  ctx: AuthContext,
  operationId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'direct_operation_executed', operationId, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'Direct database operation executed' },
  });
}

/**
 * Log a system configuration operation.
 *
 * System operations include webhook configuration, integration setup,
 * and other system-level administrative configuration changes.
 *
 * @param ctx - Authenticated context (must be super_admin)
 * @param configId - Unique identifier for this configuration
 * @param details - Configuration details (service, action, settings, etc.)
 * @param reason - Optional reason for the configuration
 *
 * @example
 * ```typescript
 * await logSystemOperation(ctx, 'telegram_webhook_set', {
 *   service: 'telegram',
 *   action: 'set_webhook',
 *   webhookUrl: 'https://...',
 *   hasSecret: true
 * }, 'Telegram webhook configuration by super_admin');
 * ```
 *
 * 🏢 ENTERPRISE: System configuration audit trail for compliance.
 */
export async function logSystemOperation(
  ctx: AuthContext,
  configId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'system_configured', configId, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'System configuration operation executed' },
  });
}

// =============================================================================
// COMMUNICATIONS AUDIT LOGGING (2026-02-06)
// =============================================================================

/**
 * Log a communication creation event.
 *
 * Use this when a new communication is created (email inbound, phone call, etc.)
 *
 * @param ctx - Authenticated context
 * @param communicationId - Communication ID
 * @param communicationType - Type of communication (email, phone, sms, etc.)
 * @param details - Communication details (from, to, subject, etc.)
 * @param reason - Optional reason
 *
 * @example
 * ```typescript
 * await logCommunicationCreated(ctx, 'comm_123', 'email', {
 *   from: 'customer@example.com',
 *   to: 'sales@company.com',
 *   subject: 'Product inquiry',
 *   direction: 'inbound'
 * });
 * ```
 *
 * 🏢 ENTERPRISE: Communications audit trail for compliance and debugging.
 */
export async function logCommunicationCreated(
  ctx: AuthContext,
  communicationId: string,
  communicationType: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'communication_created', communicationId, 'communication', {
    previousValue: null,
    newValue: { type: 'communication_status', value: { type: communicationType, ...details } },
    metadata: { reason: reason || `Communication created (${communicationType})` },
  });
}

/**
 * Log a communication approval event.
 *
 * Use this when a communication is approved and a CRM task is created.
 *
 * @param ctx - Authenticated context (admin who approved)
 * @param communicationId - Communication ID
 * @param previousStatus - Previous triage status
 * @param linkedTaskId - Created task ID
 * @param details - Additional details (assignedTo, dueDate, etc.)
 * @param reason - Optional reason for approval
 *
 * @example
 * ```typescript
 * await logCommunicationApproved(ctx, 'comm_123', 'pending', 'task_456', {
 *   assignedTo: 'user_789',
 *   dueDate: '2026-02-10',
 *   priority: 'high'
 * }, 'High priority customer inquiry');
 * ```
 *
 * 🏢 ENTERPRISE: Communications approval audit trail for accountability.
 */
export async function logCommunicationApproved(
  ctx: AuthContext,
  communicationId: string,
  previousStatus: string,
  linkedTaskId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'communication_approved', communicationId, 'communication', {
    previousValue: { type: 'communication_status', value: previousStatus },
    newValue: { type: 'task_linked', value: { status: 'approved', taskId: linkedTaskId, ...details } },
    metadata: { reason: reason || 'Communication approved and task created' },
  });
}

/**
 * Log a communication rejection event.
 *
 * Use this when a communication is rejected (no action needed).
 *
 * @param ctx - Authenticated context (admin who rejected)
 * @param communicationId - Communication ID
 * @param previousStatus - Previous triage status
 * @param reason - Reason for rejection
 *
 * @example
 * ```typescript
 * await logCommunicationRejected(ctx, 'comm_123', 'pending', 'Spam or irrelevant');
 * ```
 *
 * 🏢 ENTERPRISE: Communications rejection audit trail for accountability.
 */
export async function logCommunicationRejected(
  ctx: AuthContext,
  communicationId: string,
  previousStatus: string,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'communication_rejected', communicationId, 'communication', {
    previousValue: { type: 'communication_status', value: previousStatus },
    newValue: { type: 'communication_status', value: 'rejected' },
    metadata: { reason: reason || 'Communication rejected' },
  });
}

// =============================================================================
// REQUEST METADATA EXTRACTION
// =============================================================================

/**
 * Extract audit metadata from a request.
 *
 * @param request - NextRequest or similar
 * @returns Audit metadata
 */
export function extractRequestMetadata(request: {
  headers: { get: (name: string) => string | null };
  url?: string;
}): AuditMetadata {
  return {
    ipAddress: request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    path: request.url ? new URL(request.url).pathname : undefined,
  };
}

// =============================================================================
// WEBHOOK AUDIT LOGGING (Public Webhooks - No AuthContext)
// =============================================================================

/**
 * Log a webhook event from an external service.
 *
 * This function is designed for public webhooks (Mailgun, Telegram, etc.)
 * that don't have an AuthContext but need audit logging for compliance.
 *
 * @enterprise SAP/Salesforce/Microsoft pattern: System-level audit logs
 *
 * @param webhookSource - Source service (e.g., 'mailgun', 'telegram')
 * @param webhookId - Unique webhook event ID (from external service)
 * @param details - Webhook event details
 * @param request - NextRequest για metadata extraction
 *
 * @example
 * ```typescript
 * await logWebhookEvent(
 *   'mailgun',
 *   event.messageId,
 *   {
 *     eventType: 'delivered',
 *     recipientEmail: event.email,
 *     eventCount: events.length,
 *     success: true,
 *   },
 *   request
 * );
 * ```
 */
export async function logWebhookEvent(
  webhookSource: string,
  webhookId: string,
  details: Record<string, unknown>,
  request: { headers: { get: (name: string) => string | null }; url?: string }
): Promise<void> {
  const db = getDb();
  if (!db) {
    // Log to console as fallback
    console.log('[AUDIT] [WEBHOOK] Firestore not available, logging to console:', {
      source: webhookSource,
      webhookId,
      timestamp: new Date().toISOString(),
      details,
    });
    return;
  }

  // Extract request metadata
  const metadata = extractRequestMetadata(request);

  // 🏢 ENTERPRISE: Build entry and sanitize undefined values for Firestore
  const rawEntry = {
    companyId: 'system',  // System-level event (not tenant-specific)
    action: 'webhook_received' as const,
    actorId: `webhook:${webhookSource}`,  // Actor = external service
    targetId: webhookId,
    targetType: 'webhook' as const,
    previousValue: null,
    newValue: {
      type: 'webhook' as const,
      value: {
        source: webhookSource,
        ...details,
      },
    },
    timestamp: FieldValue.serverTimestamp(),
    metadata: removeUndefinedValues({
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      path: metadata.path,
      reason: `Webhook event received from ${webhookSource}`,
    }),
  };

  // Remove undefined from top-level
  const entry = removeUndefinedValues(rawEntry) as Omit<AuditLogEntry, 'timestamp'> & { timestamp: FieldValue };

  // Ensure metadata exists
  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    entry.metadata = { reason: `Webhook event received from ${webhookSource}` };
  }

  try {
    // Write to system-level audit logs collection
    await db
      .collection(COLLECTIONS.SYSTEM_AUDIT_LOGS)
      .add(entry);
  } catch (error) {
    // Never throw on audit failure - just log
    console.error('[AUDIT] [WEBHOOK] Failed to write webhook audit log:', error);
    console.log('[AUDIT] [WEBHOOK] Fallback entry:', JSON.stringify(entry));
  }
}
